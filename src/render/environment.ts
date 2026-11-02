// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Cenário de evento ao redor da arena, todo gerado no código (low-poly, sem assets de terceiros):
// céu com nuvens, gramado, floresta, cogumelos e flores; painel de fundo e laterais com os banners da equipe;
// arquibancadas com plateia; DRIVE TEAMS e HUMAN PLAYERS apicultores nas ALLIANCE AREAS.
// A quantidade de objetos depende do preset de qualidade, para rodar em computadores escolares.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Quality } from "./stage";

type Alliance = "red" | "blue";
const FIELD_HALF_M = 1.83;
// ALLIANCE AREA (§9.3): 54 × 97 pol, encostada na parede lateral do campo
const AREA = { inner: FIELD_HALF_M + 0.05, outer: FIELD_HALF_M + 0.05 + 54 * 0.0254, halfDepth: (97 * 0.0254) / 2 };
const SKY_TOP = new THREE.Color(0x5d9be0);
const SKY_HORIZON = new THREE.Color(0xd8ecf2);
const NAVY = 0x0b1a2e;
const BANNER_WIDTH = 1.75;
const ALLIANCE_HEX: Record<Alliance, number> = { red: 0xed1c24, blue: 0x0066b3 };

/** Quantidades por preset. */
const DETAIL: Record<Quality, { trees: number; bushes: number; mushrooms: number; flowers: number; clouds: number; crowdRows: number; animateCrowd: boolean }> = {
  low: { trees: 50, bushes: 0, mushrooms: 0, flowers: 0, clouds: 0, crowdRows: 2, animateCrowd: false },
  medium: { trees: 140, bushes: 60, mushrooms: 30, flowers: 120, clouds: 8, crowdRows: 4, animateCrowd: false },
  high: { trees: 240, bushes: 120, mushrooms: 60, flowers: 260, clouds: 14, crowdRows: 5, animateCrowd: true },
};

/** Gerador pseudoaleatório com semente: o cenário é sempre igual (bom para replays e capturas). */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lambert = (color: number, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

function instanced(geometry: THREE.BufferGeometry, material: THREE.Material, transforms: THREE.Matrix4[], colors?: THREE.Color[], shadows = false): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, transforms.length));
  mesh.count = transforms.length;
  transforms.forEach((m, i) => mesh.setMatrixAt(i, m));
  if (colors) colors.forEach((c, i) => mesh.setColorAt(i, c));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = shadows;
  return mesh;
}

const yawQ = (a: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
const place = (x: number, y: number, z: number, yaw = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), yawQ(yaw), new THREE.Vector3(s, s, s));

// ---------- céu e chão ----------

function skyDome(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(60, 32, 16);
  const colors: number[] = [];
  const pos = geometry.attributes.position;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / 60);
    c.copy(SKY_HORIZON).lerp(SKY_TOP, Math.pow(t, 0.55));
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -1;
  return sky;
}

function clouds(count: number, rand: () => number): THREE.Object3D {
  if (!count) return new THREE.Group();
  const puff = mergeGeometries([
    new THREE.IcosahedronGeometry(1.4, 1).translate(0, 0, 0),
    new THREE.IcosahedronGeometry(1.1, 1).translate(1.5, -0.2, 0.2),
    new THREE.IcosahedronGeometry(1.0, 1).translate(-1.4, -0.3, -0.1),
    new THREE.IcosahedronGeometry(0.8, 1).translate(0.4, 0.6, 0.4),
  ])!;
  const transforms: THREE.Matrix4[] = [];
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const r = 28 + rand() * 18;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * r, 13 + rand() * 9, Math.sin(a) * r), yawQ(rand() * 6), new THREE.Vector3(1.6 + rand(), 0.8 + rand() * 0.4, 1.2 + rand() * 0.6));
    transforms.push(m);
  }
  return instanced(puff, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xb8c6d6, flatShading: true, fog: false }), transforms);
}

function grass(rand: () => number): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(110, 110, 80, 80);
  geometry.rotateX(-Math.PI / 2);
  const colors: number[] = [];
  const near = new THREE.Color(0x5f9a3f);
  const far = new THREE.Color(0x7aa84c);
  const c = new THREE.Color();
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const d = Math.hypot(x, z);
    // colinas suaves só longe do evento; perto fica plano
    const hill = Math.max(0, d - 12) / 10;
    pos.setY(i, -0.02 + (Math.sin(x * 0.18) * Math.cos(z * 0.15) + 0.6 * Math.sin((x + z) * 0.07)) * 0.9 * Math.min(1, hill));
    c.copy(near).lerp(far, Math.min(1, d / 40)).offsetHSL((rand() - 0.5) * 0.02, 0, (rand() - 0.5) * 0.06);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.receiveShadow = true;
  mesh.position.y = -0.006;
  return mesh;
}

/** Piso do evento (lona escura) ao redor do campo, das arquibancadas e do painel de fundo. */
function venueFloor(): THREE.Mesh {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(13.4, 10.6), lambert(0x2f343c));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.003, -0.6);
  floor.receiveShadow = true;
  return floor;
}

/** Pontos num anel, fora da área do evento. */
function scatter(count: number, rMin: number, rMax: number, rand: () => number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  let guard = 0;
  while (points.length < count && guard++ < count * 30) {
    const a = rand() * Math.PI * 2;
    const r = rMin + Math.sqrt(rand()) * (rMax - rMin);
    const p = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    if (Math.abs(p.x) < 7.6 && p.z > -6.8 && p.z < 5.6) continue; // evento (piso, arquibancadas, câmeras)
    points.push(p);
  }
  return points;
}

// ---------- natureza ----------

function forest(count: number, bushes: number, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 1.6, 6).translate(0, 0.8, 0);
  const pineGeo = mergeGeometries([
    new THREE.ConeGeometry(1.25, 2.2, 7).translate(0, 2.1, 0),
    new THREE.ConeGeometry(0.95, 1.8, 7).translate(0, 3.0, 0),
    new THREE.ConeGeometry(0.6, 1.3, 7).translate(0, 3.8, 0),
  ])!;
  const roundGeo = mergeGeometries([
    new THREE.IcosahedronGeometry(1.25, 0).translate(0, 2.5, 0),
    new THREE.IcosahedronGeometry(0.9, 0).translate(0.7, 2.1, 0.3),
    new THREE.IcosahedronGeometry(0.85, 0).translate(-0.6, 2.2, -0.4),
  ])!;
  const trunks: THREE.Matrix4[] = [];
  const pines: THREE.Matrix4[] = [];
  const pineColors: THREE.Color[] = [];
  const rounds: THREE.Matrix4[] = [];
  const roundColors: THREE.Color[] = [];
  for (const p of scatter(count, 11, 34, rand)) {
    const s = 0.85 + rand() * 1.1;
    const m = new THREE.Matrix4().compose(p, yawQ(rand() * 6), new THREE.Vector3(s, s * (0.9 + rand() * 0.35), s));
    trunks.push(m);
    if (rand() < 0.55) {
      pines.push(m);
      pineColors.push(new THREE.Color().setHSL(0.36 + rand() * 0.04, 0.45, 0.22 + rand() * 0.08));
    } else {
      rounds.push(m);
      roundColors.push(new THREE.Color().setHSL(0.24 + rand() * 0.08, 0.5, 0.32 + rand() * 0.1));
    }
  }
  const leaf = lambert(0xffffff, { flatShading: true });
  group.add(instanced(trunkGeo, lambert(0x6b4a33), trunks, undefined, true));
  group.add(instanced(pineGeo, leaf, pines, pineColors, true));
  group.add(instanced(roundGeo, leaf, rounds, roundColors, true));

  if (bushes) {
    const bushGeo = mergeGeometries([new THREE.IcosahedronGeometry(0.45, 0).translate(0, 0.3, 0), new THREE.IcosahedronGeometry(0.32, 0).translate(0.38, 0.22, 0.1)])!;
    const transforms: THREE.Matrix4[] = [];
    const colors: THREE.Color[] = [];
    for (const p of scatter(bushes, 8.5, 16, rand)) {
      transforms.push(new THREE.Matrix4().compose(p, yawQ(rand() * 6), new THREE.Vector3(1, 0.8 + rand() * 0.5, 1).multiplyScalar(0.8 + rand() * 0.8)));
      colors.push(new THREE.Color().setHSL(0.27 + rand() * 0.06, 0.5, 0.28 + rand() * 0.08));
    }
    group.add(instanced(bushGeo, leaf, transforms, colors));
  }
  return group;
}

function mushrooms(count: number, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  if (!count) return group;
  const stemGeo = new THREE.CylinderGeometry(0.03, 0.045, 0.2, 6).translate(0, 0.1, 0);
  const capGeo = mergeGeometries([
    new THREE.SphereGeometry(0.12, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.18, 0),
    new THREE.CircleGeometry(0.12, 10).rotateX(Math.PI / 2).translate(0, 0.18, 0),
  ])!;
  const transforms: THREE.Matrix4[] = [];
  const caps: THREE.Color[] = [];
  const palette = [0xd8342c, 0xe0663a, 0xc9a227];
  // em grupinhos, como no campo de verdade
  for (const center of scatter(Math.ceil(count / 4), 8.5, 15, rand)) {
    const capColor = palette[Math.floor(rand() * palette.length)];
    for (let i = 0; i < 4; i++) {
      const s = 0.6 + rand() * 0.9;
      transforms.push(place(center.x + (rand() - 0.5) * 0.6, 0, center.z + (rand() - 0.5) * 0.6, rand() * 6, s));
      caps.push(new THREE.Color(capColor));
    }
  }
  group.add(instanced(stemGeo, lambert(0xf1ead8), transforms));
  group.add(instanced(capGeo, lambert(0xffffff, { side: THREE.DoubleSide }), transforms, caps));
  return group;
}

function wildflowers(count: number, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  if (!count) return group;
  const stemGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.22, 4).translate(0, 0.11, 0);
  const headGeo = new THREE.CircleGeometry(0.05, 6).rotateX(-Math.PI / 2.4).translate(0, 0.23, 0);
  const transforms: THREE.Matrix4[] = [];
  const colors: THREE.Color[] = [];
  const palette = [0xf7e326, 0xffffff, 0xe85d9b, 0xf57e25, 0x9a7be0];
  for (const center of scatter(Math.ceil(count / 10), 8, 18, rand)) {
    const c = palette[Math.floor(rand() * palette.length)];
    for (let i = 0; i < 10; i++) {
      transforms.push(new THREE.Matrix4().compose(new THREE.Vector3(center.x + (rand() - 0.5) * 1.6, 0, center.z + (rand() - 0.5) * 1.6), yawQ(rand() * 6), new THREE.Vector3(1, 0.7 + rand() * 0.7, 1)));
      colors.push(new THREE.Color(c));
    }
  }
  group.add(instanced(stemGeo, lambert(0x2f6b2a), transforms));
  group.add(instanced(headGeo, lambert(0xffffff, { side: THREE.DoubleSide }), transforms, colors));
  return group;
}

// ---------- estrutura do evento ----------

/**
 * Faixa "WESTSHARKS · FTC #24823". O texto é medido e reduzido até caber, para nunca sair cortado.
 * A logo oficial entra por /branding/westsharks-logo.png, se a equipe colocar o arquivo autorizado.
 */
function bannerTexture(): THREE.CanvasTexture {
  const W = 2048;
  const H = 384;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const logoBox = { x: 40, y: 40, size: H - 80 };
  const draw = (logo?: HTMLImageElement) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, "#10223a");
    gradient.addColorStop(1, "#070f1c");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#0079ff";
    ctx.fillRect(0, H - 22, W, 22);
    ctx.fillStyle = "#f7e326";
    ctx.fillRect(0, 0, W, 8);
    if (logo) {
      const s = Math.min(logoBox.size / logo.width, logoBox.size / logo.height);
      ctx.drawImage(logo, logoBox.x + (logoBox.size - logo.width * s) / 2, logoBox.y + (logoBox.size - logo.height * s) / 2, logo.width * s, logo.height * s);
    } else {
      // tubarão estilizado como marcador até a logo autorizada chegar
      ctx.fillStyle = "#0079ff";
      ctx.beginPath();
      const cx = logoBox.x + logoBox.size / 2;
      const cy = logoBox.y + logoBox.size / 2;
      ctx.moveTo(cx - 110, cy + 60);
      ctx.quadraticCurveTo(cx - 10, cy - 30, cx + 20, cy - 120);
      ctx.quadraticCurveTo(cx + 50, cy - 20, cx + 120, cy + 60);
      ctx.closePath();
      ctx.fill();
    }
    const textLeft = logoBox.x + logoBox.size + 50;
    const maxWidth = W - textLeft - 50;
    let size = 220;
    const fit = () => {
      ctx.font = `900 ${size}px Roboto, Arial, sans-serif`;
      return ctx.measureText("WESTSHARKS").width + ctx.measureText("  FTC #24823").width * 0.62;
    };
    while (fit() > maxWidth && size > 40) size -= 4;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 ${size}px Roboto, Arial, sans-serif`;
    const baseline = H / 2 + size * 0.36;
    // centraliza o texto no espaço à direita da logo
    const x0 = textLeft + Math.max(0, (maxWidth - fit()) / 2);
    ctx.font = `900 ${size}px Roboto, Arial, sans-serif`;
    ctx.fillText("WESTSHARKS", x0, baseline);
    const w1 = ctx.measureText("WESTSHARKS").width;
    ctx.fillStyle = "#4da3ff";
    ctx.font = `700 ${Math.round(size * 0.62)}px Roboto, Arial, sans-serif`;
    ctx.fillText("  FTC #24823", x0 + w1, baseline);
  };
  draw();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const logo = new Image();
  logo.onload = () => {
    draw(logo);
    texture.needsUpdate = true;
  };
  logo.src = `${import.meta.env.BASE_URL}branding/westsharks-logo.png`;
  return texture;
}

/** Painel de fundo com treliças nas pontas e duas faixas da equipe, fora da sombra da HIVE na câmera da plateia. */
function backdrop(length: number, bannerMat: THREE.Material, bannerOffsets: number[]): THREE.Group {
  const group = new THREE.Group();
  const height = 1.25;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(length, height, 0.06), lambert(NAVY));
  panel.position.y = height / 2;
  panel.receiveShadow = true;
  group.add(panel);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(length, 0.05, 0.065), lambert(0xf7e326));
  stripe.position.y = height - 0.04;
  group.add(stripe);
  for (const x of bannerOffsets) {
    // proporção da textura (2048 × 384)
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(BANNER_WIDTH, BANNER_WIDTH * (384 / 2048)), bannerMat);
    banner.position.set(x, 0.72, 0.034);
    group.add(banner);
  }
  // treliças de alumínio nas pontas
  const truss = lambert(0x9aa1ab);
  for (const x of [-length / 2 - 0.15, length / 2 + 0.15]) {
    for (const [dx, dz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.6, 6), truss);
      pole.position.set(x + dx, 1.3, dz);
      group.add(pole);
    }
    for (let y = 0.3; y < 2.6; y += 0.45) {
      const ring = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.26), truss);
      ring.position.set(x, y, 0);
      group.add(ring);
    }
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(length + 0.6, 0.18, 0.18), truss);
  beam.position.y = 2.6;
  group.add(beam);
  return group;
}

/** Arquibancada em degraus; devolve os pontos de assento (para a plateia). */
function bleachers(rows: number, length: number): { mesh: THREE.Group; seats: Array<{ x: number; y: number; z: number }> } {
  const group = new THREE.Group();
  const step = { depth: 0.7, rise: 0.38 };
  const seats: Array<{ x: number; y: number; z: number }> = [];
  for (let r = 0; r < rows; r++) {
    const h = (r + 1) * step.rise;
    const tier = new THREE.Mesh(new THREE.BoxGeometry(length, h, step.depth), lambert(r % 2 ? 0x59606b : 0x6a717d));
    tier.position.set(0, h / 2, -(r + 0.5) * step.depth);
    tier.receiveShadow = true;
    group.add(tier);
    for (let x = -length / 2 + 0.35; x <= length / 2 - 0.35; x += 0.55) seats.push({ x, y: h, z: -(r + 0.45) * step.depth });
  }
  // grade da frente
  const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.05, 0.05), lambert(0xc9ced6));
  rail.position.set(0, 0.95, 0.05);
  group.add(rail);
  return { mesh: group, seats };
}

// ---------- pessoas ----------

const SKIN = [0xf1c9a5, 0xd9a47c, 0xb57a52, 0x8a5636, 0x5e3a24];

/** Pessoa low-poly (sem textura), com braços articulados para animar. */
export interface Person {
  root: THREE.Group;
  rightArm: THREE.Group;
  leftArm: THREE.Group;
}

function person(opts: { shirt: number; pants: number; skin: number; hat?: "beekeeper" | "cap"; hatColor?: number; accent?: number }): Person {
  const root = new THREE.Group();
  const shirt = lambert(opts.shirt);
  const pants = lambert(opts.pants);
  const skin = lambert(opts.skin);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z = 0, parent: THREE.Object3D = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  add(new THREE.CapsuleGeometry(0.075, 0.6, 4, 8), pants, -0.09, 0.38);
  add(new THREE.CapsuleGeometry(0.075, 0.6, 4, 8), pants, 0.09, 0.38);
  add(new THREE.BoxGeometry(0.13, 0.07, 0.24), lambert(0x222428), -0.09, 0.035, 0.04);
  add(new THREE.BoxGeometry(0.13, 0.07, 0.24), lambert(0x222428), 0.09, 0.035, 0.04);
  const torso = add(new THREE.CapsuleGeometry(0.19, 0.38, 4, 12), shirt, 0, 1.0);
  torso.scale.set(1, 1, 0.72);
  if (opts.accent !== undefined) {
    // faixa da aliança no peito
    const band = add(new THREE.CylinderGeometry(0.195, 0.195, 0.08, 14), lambert(opts.accent), 0, 1.12);
    band.scale.set(1, 1, 0.74);
  }
  add(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 8), skin, 0, 1.36);
  const head = opts.hat === "beekeeper" ? lambert(0x2a2a35, { transparent: true, opacity: 0.9 }) : skin;
  add(new THREE.SphereGeometry(0.115, 14, 10), head, 0, 1.5);
  if (opts.hat === "beekeeper") {
    const hatMat = lambert(opts.hatColor ?? 0xffffff);
    add(new THREE.CylinderGeometry(0.27, 0.27, 0.015, 20), hatMat, 0, 1.6);
    add(new THREE.CylinderGeometry(0.12, 0.13, 0.12, 14), hatMat, 0, 1.67);
    // véu de tela
    add(new THREE.CylinderGeometry(0.15, 0.2, 0.22, 16, 1, true), lambert(0x30323a, { transparent: true, opacity: 0.45, side: THREE.DoubleSide }), 0, 1.49);
  } else if (opts.hat === "cap") {
    const capMat = lambert(opts.hatColor ?? 0x222222);
    add(new THREE.SphereGeometry(0.12, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat, 0, 1.53);
    add(new THREE.BoxGeometry(0.16, 0.012, 0.1), capMat, 0, 1.54, 0.12);
  }
  const arm = (side: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.25, 1.26, 0);
    root.add(shoulder);
    add(new THREE.CapsuleGeometry(0.058, 0.46, 4, 8), shirt, 0, -0.28, 0, shoulder);
    add(new THREE.SphereGeometry(0.06, 8, 6), opts.hat === "beekeeper" ? lambert(opts.hatColor ?? 0xffffff) : skin, 0, -0.58, 0, shoulder);
    return shoulder;
  };
  return { root, rightArm: arm(1), leftArm: arm(-1) };
}

/** Plateia instanciada: 3 malhas (roupa, pele, calça) para centenas de pessoas sentadas. */
function crowd(seats: Array<{ x: number; y: number; z: number; yaw: number }>, rand: () => number): { meshes: THREE.InstancedMesh[]; base: THREE.Matrix4[]; phase: number[] } {
  const shirtGeo = mergeGeometries([
    new THREE.CapsuleGeometry(0.17, 0.32, 3, 8).scale(1, 1, 0.75).translate(0, 0.42, 0),
    new THREE.CapsuleGeometry(0.05, 0.36, 3, 6).rotateX(-0.9).translate(-0.22, 0.42, 0.12),
    new THREE.CapsuleGeometry(0.05, 0.36, 3, 6).rotateX(-0.9).translate(0.22, 0.42, 0.12),
  ])!;
  const skinGeo = mergeGeometries([new THREE.SphereGeometry(0.105, 10, 8).translate(0, 0.86, 0), new THREE.SphereGeometry(0.05, 6, 4).translate(-0.24, 0.2, 0.3), new THREE.SphereGeometry(0.05, 6, 4).translate(0.24, 0.2, 0.3)])!;
  const legGeo = mergeGeometries([
    new THREE.CapsuleGeometry(0.07, 0.3, 3, 6).rotateX(Math.PI / 2).translate(-0.09, 0.12, 0.2),
    new THREE.CapsuleGeometry(0.07, 0.3, 3, 6).rotateX(Math.PI / 2).translate(0.09, 0.12, 0.2),
  ])!;
  // camisetas de equipes: cores variadas, com mais vermelho e azul (torcidas das alianças)
  const shirts = [0xed1c24, 0x0066b3, 0xffffff, 0xf7e326, 0x2e8b57, 0xf57e25, 0x7a4fd1, 0x222222, 0x0079ff, 0xd8342c];
  const transforms: THREE.Matrix4[] = [];
  const shirtColors: THREE.Color[] = [];
  const skinColors: THREE.Color[] = [];
  const legColors: THREE.Color[] = [];
  const phase: number[] = [];
  for (const s of seats) {
    if (rand() < 0.12) continue; // lugares vazios
    const m = new THREE.Matrix4().compose(new THREE.Vector3(s.x + (rand() - 0.5) * 0.12, s.y, s.z), yawQ(s.yaw + (rand() - 0.5) * 0.4), new THREE.Vector3(1, 0.92 + rand() * 0.16, 1));
    transforms.push(m);
    shirtColors.push(new THREE.Color(shirts[Math.floor(rand() * shirts.length)]));
    skinColors.push(new THREE.Color(SKIN[Math.floor(rand() * SKIN.length)]));
    legColors.push(new THREE.Color(rand() < 0.6 ? 0x2b3a55 : 0x3b3b40));
    phase.push(rand() * Math.PI * 2);
  }
  const white = () => lambert(0xffffff);
  const meshes = [instanced(shirtGeo, white(), transforms, shirtColors), instanced(skinGeo, white(), transforms, skinColors), instanced(legGeo, white(), transforms, legColors)];
  return { meshes, base: transforms.map((m) => m.clone()), phase };
}

// ---------- ambiente completo ----------

interface AnimatedPerson extends Person {
  role: "humanPlayer" | "driver" | "coach";
  /** > 0 = tempo restante da animação de entrega do NECTAR (s). */
  tossTime: number;
  phase: number;
}

const TOSS_DURATION = 1.1;

export class Environment {
  readonly group = new THREE.Group();
  /** Pessoas de cada ALLIANCE AREA (DRIVE TEAMS e HUMAN PLAYERS). */
  readonly alliances: Record<Alliance, THREE.Group> = { red: new THREE.Group(), blue: new THREE.Group() };
  private readonly people: Record<Alliance, AnimatedPerson[]> = { red: [], blue: [] };
  private readonly crowdMeshes: THREE.InstancedMesh[] = [];
  private crowdBase: THREE.Matrix4[] = [];
  private crowdPhase: number[] = [];
  private readonly animateCrowd: boolean;
  private time = 0;

  constructor(scene: THREE.Scene, quality: Quality) {
    const detail = DETAIL[quality];
    const rand = seeded(24823);
    this.animateCrowd = detail.animateCrowd;

    scene.background = SKY_HORIZON.clone();
    scene.fog = new THREE.Fog(SKY_HORIZON.getHex(), 18, quality === "low" ? 34 : 52);
    this.group.add(skyDome(), clouds(detail.clouds, rand), grass(rand), venueFloor());
    this.group.add(forest(detail.trees, detail.bushes, rand), mushrooms(detail.mushrooms, rand), wildflowers(detail.flowers, rand));

    // Painéis com as faixas da equipe: fundo (visto da câmera da plateia, uma faixa de cada lado da HIVE)
    // e laterais (vistos da câmera do piloto, nas pontas, fora de trás do DRIVE TEAM). Nenhuma faixa fica atrás da HIVE.
    const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTexture(), toneMapped: false });
    // a HIVE cobre |x| < ~1 m do painel visto da plateia; as faixas ficam entre ela e a borda da tela
    const back = backdrop(6.6, bannerMat, [-1.95, 1.95]);
    back.position.set(0, 0, -2.75);
    const left = backdrop(5.2, bannerMat, [-1.55, 1.55]);
    left.position.set(-(AREA.outer + 0.35), 0, 0);
    left.rotation.y = Math.PI / 2;
    const right = backdrop(5.2, bannerMat, [-1.55, 1.55]);
    right.position.set(AREA.outer + 0.35, 0, 0);
    right.rotation.y = -Math.PI / 2;
    this.group.add(back, left, right);

    // Arquibancadas atrás dos painéis (fundo e laterais), mais altas que eles
    const seats: Array<{ x: number; y: number; z: number; yaw: number }> = [];
    const addStand = (length: number, x: number, z: number, yaw: number) => {
      const stand = bleachers(detail.crowdRows, length);
      stand.mesh.position.set(x, 0, z);
      stand.mesh.rotation.y = yaw;
      this.group.add(stand.mesh);
      const m = new THREE.Matrix4().compose(stand.mesh.position, yawQ(yaw), new THREE.Vector3(1, 1, 1));
      for (const s of stand.seats) {
        const p = new THREE.Vector3(s.x, s.y, s.z).applyMatrix4(m);
        seats.push({ x: p.x, y: p.y, z: p.z, yaw });
      }
    };
    addStand(7.2, 0, -3.25, 0);
    addStand(5.6, -(AREA.outer + 0.95), 0.2, Math.PI / 2);
    addStand(5.6, AREA.outer + 0.95, 0.2, -Math.PI / 2);
    const audience = crowd(seats, rand);
    this.crowdMeshes.push(...audience.meshes);
    this.crowdBase = audience.base;
    this.crowdPhase = audience.phase;
    this.group.add(...audience.meshes);

    // ALLIANCE AREAS: 2 HUMAN PLAYERS apicultores perto da LOADING ZONE, 2 pilotos e 1 técnico por aliança
    for (const alliance of ["red", "blue"] as const) {
      const sign = alliance === "red" ? -1 : 1;
      const color = ALLIANCE_HEX[alliance];
      const facing = alliance === "red" ? Math.PI / 2 : -Math.PI / 2; // de frente para o campo
      // LOADING ZONE vermelha fica em z < 0 (lado oposto à plateia); a azul, em z > 0
      const lz = alliance === "red" ? -1 : 1;
      const spots: Array<{ role: AnimatedPerson["role"]; x: number; z: number }> = [
        { role: "humanPlayer", x: AREA.inner + 0.3, z: lz * 0.95 },
        { role: "humanPlayer", x: AREA.inner + 0.75, z: lz * 0.55 },
        // DRIVE TEAM no fundo da ALLIANCE AREA, para não tapar o campo na câmera da plateia
        { role: "driver", x: AREA.outer - 0.3, z: -lz * 0.2 },
        { role: "driver", x: AREA.outer - 0.3, z: -lz * 0.75 },
        { role: "coach", x: AREA.outer - 0.15, z: -lz * 1.1 },
      ];
      for (const spot of spots) {
        const p =
          spot.role === "humanPlayer"
            ? person({ shirt: 0xf4f4f0, pants: 0xf4f4f0, skin: SKIN[Math.floor(rand() * SKIN.length)], hat: "beekeeper", hatColor: color, accent: color })
            : person({ shirt: color, pants: 0x2b2f38, skin: SKIN[Math.floor(rand() * SKIN.length)], hat: spot.role === "coach" ? undefined : "cap", hatColor: 0x1d1f24 });
        p.root.position.set(sign * spot.x, 0, spot.z);
        p.root.rotation.y = facing;
        if (spot.role === "driver") {
          // segurando o controle
          p.rightArm.rotation.x = -0.9;
          p.leftArm.rotation.x = -0.9;
          p.rightArm.rotation.z = 0.35;
          p.leftArm.rotation.z = -0.35;
        }
        this.alliances[alliance].add(p.root);
        this.people[alliance].push({ ...p, role: spot.role, tossTime: 0, phase: rand() * 6 });
      }
      this.group.add(this.alliances[alliance]);
    }

    scene.add(this.group);
  }

  /** HUMAN PLAYER mais perto da LOADING ZONE entrega um NECTAR. */
  tossNectar(alliance: Alliance): void {
    const hp = this.people[alliance].find((p) => p.role === "humanPlayer");
    if (hp) hp.tossTime = TOSS_DURATION;
  }

  /** `camera`: posição da câmera; quem estiver colado a ela some, para não tapar a tela (câmera do robô). */
  update(dt: number, camera?: THREE.Vector3): void {
    this.time += dt;
    for (const list of Object.values(this.people)) {
      for (const p of list) {
        if (camera) p.root.visible = Math.hypot(camera.x - p.root.position.x, camera.z - p.root.position.z) > 0.9;
        if (p.role === "driver") {
          // pequenos ajustes no controle
          p.rightArm.rotation.x = -0.9 + Math.sin(this.time * 3 + p.phase) * 0.04;
          p.leftArm.rotation.x = -0.9 + Math.sin(this.time * 3.3 + p.phase) * 0.04;
          continue;
        }
        if (p.tossTime > 0) {
          p.tossTime = Math.max(0, p.tossTime - dt);
          const lift = Math.sin((1 - p.tossTime / TOSS_DURATION) * Math.PI);
          p.rightArm.rotation.x = -lift * 1.9;
          p.leftArm.rotation.x = -lift * 1.5;
        } else {
          const idle = Math.sin(this.time * 1.4 + p.phase) * 0.06;
          p.rightArm.rotation.x = idle;
          p.leftArm.rotation.x = -idle;
          p.root.position.y = Math.max(0, Math.sin(this.time * 1.4 + p.phase)) * 0.004;
        }
      }
    }
    if (this.animateCrowd) {
      const m = new THREE.Matrix4();
      const lift = new THREE.Matrix4();
      for (let i = 0; i < this.crowdBase.length; i++) {
        const bob = Math.max(0, Math.sin(this.time * 2 + this.crowdPhase[i])) * 0.03;
        m.copy(this.crowdBase[i]).premultiply(lift.makeTranslation(0, bob, 0));
        for (const mesh of this.crowdMeshes) mesh.setMatrixAt(i, m);
      }
      for (const mesh of this.crowdMeshes) mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
