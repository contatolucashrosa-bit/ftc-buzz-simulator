// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Cenário ao redor da arena, todo gerado no código (low-poly, sem assets de terceiros):
// céu, grama, floresta, cogumelos, flores, plateia, HUMAN PLAYERS apicultores e banners da equipe.
// A quantidade de objetos depende do preset de qualidade, para rodar em computadores escolares.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Quality } from "./stage";

const FIELD_HALF_M = 1.83;
const SKY_TOP = new THREE.Color(0x7fb6e6);
const SKY_HORIZON = new THREE.Color(0xdbe9df);

/** Quantidades por preset. */
const DETAIL: Record<Quality, { trees: number; mushrooms: number; flowers: number; crowd: number; animateCrowd: boolean }> = {
  low: { trees: 40, mushrooms: 0, flowers: 0, crowd: 24, animateCrowd: false },
  medium: { trees: 140, mushrooms: 40, flowers: 90, crowd: 70, animateCrowd: false },
  high: { trees: 260, mushrooms: 90, flowers: 220, crowd: 120, animateCrowd: true },
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

function skyDome(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(45, 24, 12);
  const colors: number[] = [];
  const pos = geometry.attributes.position;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / 45);
    c.copy(SKY_HORIZON).lerp(SKY_TOP, Math.pow(t, 0.6));
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -1;
  return sky;
}

function grass(rand: () => number): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(90, 90, 60, 60);
  geometry.rotateX(-Math.PI / 2);
  const colors: number[] = [];
  const base = new THREE.Color(0x4f8a3a);
  const c = new THREE.Color();
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // leves ondulações longe da arena (o centro fica plano)
    const far = Math.max(0, Math.hypot(x, z) - 7);
    pos.setY(i, -0.01 + Math.sin(x * 0.35) * Math.cos(z * 0.3) * 0.25 * Math.min(1, far / 6));
    c.copy(base).offsetHSL((rand() - 0.5) * 0.03, 0, (rand() - 0.5) * 0.08);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.receiveShadow = true;
  mesh.position.y = -0.004;
  return mesh;
}

/** Espalha objetos num anel, longe da arena e das áreas de plateia e HUMAN PLAYERS. */
function scatter(count: number, rMin: number, rMax: number, rand: () => number, avoidAudience = true): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  let guard = 0;
  while (points.length < count && guard++ < count * 20) {
    const a = rand() * Math.PI * 2;
    const r = rMin + Math.sqrt(rand()) * (rMax - rMin);
    const p = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    // arquibancada atrás do campo (-z); ALLIANCE AREAS nas laterais
    if (avoidAudience && p.z < -2.3 && p.z > -6.2 && Math.abs(p.x) < 6) continue;
    if (Math.abs(p.z) < 2.2 && Math.abs(p.x) < 4.2) continue;
    points.push(p);
  }
  return points;
}

function instanced(geometry: THREE.BufferGeometry, material: THREE.Material, transforms: THREE.Matrix4[], colors?: THREE.Color[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  transforms.forEach((m, i) => mesh.setMatrixAt(i, m));
  if (colors) colors.forEach((c, i) => mesh.setColorAt(i, c));
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function forest(count: number, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.4, 6).translate(0, 0.7, 0);
  const crownGeo = mergeGeometries([
    new THREE.ConeGeometry(1.2, 2.4, 7).translate(0, 2.4, 0),
    new THREE.ConeGeometry(0.9, 1.9, 7).translate(0, 3.4, 0),
  ])!;
  const trunks: THREE.Matrix4[] = [];
  const crowns: THREE.Matrix4[] = [];
  const crownColors: THREE.Color[] = [];
  for (const p of scatter(count, 12, 30, rand, false)) {
    const s = 0.8 + rand() * 1.1;
    const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6), new THREE.Vector3(s, s * (0.9 + rand() * 0.4), s));
    trunks.push(m);
    crowns.push(m);
    crownColors.push(new THREE.Color().setHSL(0.28 + rand() * 0.06, 0.45, 0.2 + rand() * 0.1));
  }
  group.add(instanced(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x5b4030 }), trunks));
  group.add(instanced(crownGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), crowns, crownColors));
  return group;
}

function mushrooms(count: number, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  if (count === 0) return group;
  const stemGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.22, 6).translate(0, 0.11, 0);
  const capGeo = new THREE.SphereGeometry(0.13, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.2, 0);
  const stems: THREE.Matrix4[] = [];
  const caps: THREE.Color[] = [];
  const palette = [0xd8342c, 0xe0663a, 0x7a5bd1, 0x3f7fd9, 0xe8c547];
  for (const p of scatter(count, 3.6, 11, rand)) {
    const s = 0.7 + rand() * 1.4;
    stems.push(new THREE.Matrix4().compose(p, new THREE.Quaternion(), new THREE.Vector3(s, s, s)));
    caps.push(new THREE.Color(palette[Math.floor(rand() * palette.length)]));
  }
  group.add(instanced(stemGeo, new THREE.MeshLambertMaterial({ color: 0xf1ead8 }), stems));
  group.add(instanced(capGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), stems, caps));
  return group;
}

function flowers(count: number, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  if (count === 0) return group;
  const stemGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.25, 4).translate(0, 0.125, 0);
  const headGeo = new THREE.CircleGeometry(0.06, 6).rotateX(-Math.PI / 2.4).translate(0, 0.26, 0);
  const transforms: THREE.Matrix4[] = [];
  const colors: THREE.Color[] = [];
  const palette = [0xf7e326, 0xffffff, 0xe85d9b, 0xf57e25, 0x9a7be0];
  for (const p of scatter(count, 3.2, 12, rand)) {
    transforms.push(new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6), new THREE.Vector3(1, 0.7 + rand() * 0.8, 1)));
    colors.push(new THREE.Color(palette[Math.floor(rand() * palette.length)]));
  }
  group.add(instanced(stemGeo, new THREE.MeshLambertMaterial({ color: 0x2f6b2a }), transforms));
  const headMat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  group.add(instanced(headGeo, headMat, transforms, colors));
  return group;
}

/** Boneco apicultor low-poly (sem textura), com braços articulados para animar. */
export function beekeeper(suitColor: number, hatColor: number): { root: THREE.Group; rightArm: THREE.Group; leftArm: THREE.Group } {
  const suit = new THREE.MeshLambertMaterial({ color: suitColor });
  const hatMat = new THREE.MeshLambertMaterial({ color: hatColor });
  const veil = new THREE.MeshLambertMaterial({ color: 0x2a2a35, transparent: true, opacity: 0.85 });
  const root = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z = 0, parent: THREE.Object3D = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  add(new THREE.CapsuleGeometry(0.09, 0.62, 4, 8), suit, -0.1, 0.4); // pernas
  add(new THREE.CapsuleGeometry(0.09, 0.62, 4, 8), suit, 0.1, 0.4);
  add(new THREE.CapsuleGeometry(0.2, 0.42, 4, 10), suit, 0, 1.08); // tronco
  add(new THREE.SphereGeometry(0.15, 12, 10), veil, 0, 1.52); // cabeça com véu
  add(new THREE.CylinderGeometry(0.34, 0.34, 0.02, 16), hatMat, 0, 1.64); // aba do chapéu
  add(new THREE.CylinderGeometry(0.15, 0.17, 0.14, 12), hatMat, 0, 1.72); // copa
  const arm = (side: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.27, 1.32, 0);
    root.add(shoulder);
    add(new THREE.CapsuleGeometry(0.07, 0.5, 4, 8), suit, 0, -0.3, 0, shoulder);
    add(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshLambertMaterial({ color: hatColor }), 0, -0.62, 0, shoulder); // luva
    return shoulder;
  };
  return { root, rightArm: arm(1), leftArm: arm(-1) };
}

function crowdGeometry(): { body: THREE.BufferGeometry; head: THREE.BufferGeometry; hat: THREE.BufferGeometry } {
  return {
    body: mergeGeometries([
      new THREE.CapsuleGeometry(0.17, 0.75, 3, 8).translate(0, 0.65, 0),
      new THREE.CapsuleGeometry(0.06, 0.45, 3, 6).rotateZ(0.25).translate(-0.22, 1.0, 0),
      new THREE.CapsuleGeometry(0.06, 0.45, 3, 6).rotateZ(-0.25).translate(0.22, 1.0, 0),
    ])!,
    head: new THREE.SphereGeometry(0.12, 10, 8).translate(0, 1.38, 0),
    hat: mergeGeometries([new THREE.CylinderGeometry(0.26, 0.26, 0.02, 12).translate(0, 1.48, 0), new THREE.CylinderGeometry(0.12, 0.13, 0.11, 10).translate(0, 1.54, 0)])!,
  };
}

/** Faixa com o nome da equipe. A logo oficial entra por /branding/westsharks-logo.png, se a equipe colocar o arquivo autorizado. */
function bannerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 160;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#050608";
  ctx.fillRect(0, 0, 1024, 160);
  ctx.fillStyle = "#0079ff";
  ctx.fillRect(0, 140, 1024, 20);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 64px Roboto, Arial, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("WEST SHARKS", 196, 70);
  ctx.fillStyle = "#0079ff";
  ctx.fillText("FTC #24823", 196 + ctx.measureText("WEST SHARKS ").width, 70);
  // espaço reservado para a logo autorizada
  ctx.strokeStyle = "#0079ff";
  ctx.lineWidth = 4;
  ctx.strokeRect(36, 18, 124, 108);
  ctx.fillStyle = "#7e8794";
  ctx.font = "500 18px Roboto, Arial, sans-serif";
  ctx.fillText("LOGO", 70, 72);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const logo = new Image();
  logo.onload = () => {
    ctx.fillStyle = "#050608";
    ctx.fillRect(30, 12, 136, 120);
    const s = Math.min(124 / logo.width, 108 / logo.height);
    ctx.drawImage(logo, 98 - (logo.width * s) / 2, 72 - (logo.height * s) / 2, logo.width * s, logo.height * s);
    texture.needsUpdate = true;
  };
  logo.src = `${import.meta.env.BASE_URL}branding/westsharks-logo.png`;
  return texture;
}

export interface HumanPlayer {
  root: THREE.Group;
  rightArm: THREE.Group;
  leftArm: THREE.Group;
  /** 0 = parado; > 0 = tempo restante da animação de entrega (s). */
  tossTime: number;
}

const TOSS_DURATION = 1.1;

export class Environment {
  readonly group = new THREE.Group();
  readonly humanPlayers: Record<"red" | "blue", HumanPlayer>;
  private readonly crowd: THREE.InstancedMesh[] = [];
  private readonly crowdBase: THREE.Matrix4[] = [];
  private readonly crowdPhase: number[] = [];
  private readonly animateCrowd: boolean;
  private time = 0;

  constructor(scene: THREE.Scene, quality: Quality) {
    const detail = DETAIL[quality];
    const rand = seeded(24823);
    this.animateCrowd = detail.animateCrowd;

    scene.background = SKY_HORIZON.clone();
    scene.fog = new THREE.Fog(SKY_HORIZON.getHex(), 14, quality === "low" ? 26 : 40);
    this.group.add(skyDome(), grass(rand), forest(detail.trees, rand), mushrooms(detail.mushrooms, rand), flowers(detail.flowers, rand));

    // Plateia em arquibancada do lado oposto à câmera da plateia: aparece ao fundo, como numa transmissão
    const geo = crowdGeometry();
    const transforms: THREE.Matrix4[] = [];
    const bodyColors: THREE.Color[] = [];
    const hatColors: THREE.Color[] = [];
    const suit = [0xe8b4ae, 0xb7c3ee, 0xf2f2f2, 0xd9d0b8];
    for (let i = 0; i < detail.crowd; i++) {
      const row = i % 4;
      const col = Math.floor(i / 4);
      const perRow = Math.ceil(detail.crowd / 4);
      const x = (col - perRow / 2) * (9 / perRow) + (rand() - 0.5) * 0.25;
      const z = -(3.1 + row * 0.75) + (rand() - 0.5) * 0.2;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, row * 0.3, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rand() - 0.5) * 0.5), new THREE.Vector3(1, 0.9 + rand() * 0.2, 1));
      transforms.push(m);
      this.crowdBase.push(m.clone());
      this.crowdPhase.push(rand() * Math.PI * 2);
      bodyColors.push(new THREE.Color(suit[Math.floor(rand() * suit.length)]));
      hatColors.push(new THREE.Color(rand() < 0.5 ? 0xed1c24 : 0x0066b3));
    }
    const bodies = instanced(geo.body, new THREE.MeshLambertMaterial({ color: 0xffffff }), transforms, bodyColors);
    const heads = instanced(geo.head, new THREE.MeshLambertMaterial({ color: 0x2a2a35 }), transforms);
    const hats = instanced(geo.hat, new THREE.MeshLambertMaterial({ color: 0xffffff }), transforms, hatColors);
    this.crowd.push(bodies, heads, hats);
    this.group.add(bodies, heads, hats);
    // arquibancada simples sob as fileiras de trás
    for (let row = 1; row < 4; row++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(10, row * 0.3, 0.75), new THREE.MeshLambertMaterial({ color: 0x8a8f99 }));
      step.position.set(0, (row * 0.3) / 2, -(3.1 + row * 0.75));
      step.receiveShadow = true;
      this.group.add(step);
    }

    // Banners da equipe na grade em frente à arquibancada e atrás das ALLIANCE AREAS
    const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTexture() });
    for (const [x, z, ry] of [[-1.7, -2.65, 0], [1.7, -2.65, 0], [-3.6, 0, Math.PI / 2], [3.6, 0, -Math.PI / 2]] as const) {
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.5), bannerMat);
      banner.position.set(x, 0.55, z);
      banner.rotation.y = ry;
      const post = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.06, 0.06), new THREE.MeshLambertMaterial({ color: 0x222428 }));
      post.position.set(x, 0.27, z);
      post.rotation.y = ry;
      this.group.add(banner, post);
    }

    // HUMAN PLAYERS (um por aliança), dentro da ALLIANCE AREA, perto da LOADING ZONE
    const red = beekeeper(0xe8b0aa, 0xed1c24);
    const blue = beekeeper(0xb4c0ec, 0x0066b3);
    // na ponta da LOADING ZONE mais longe do piloto, para não tapar a câmera do piloto
    red.root.position.set(-(FIELD_HALF_M + 0.35), 0, -1.15);
    red.root.rotation.y = Math.PI / 2;
    blue.root.position.set(FIELD_HALF_M + 0.35, 0, 1.15);
    blue.root.rotation.y = -Math.PI / 2;
    this.humanPlayers = { red: { ...red, tossTime: 0 }, blue: { ...blue, tossTime: 0 } };
    this.group.add(red.root, blue.root);

    scene.add(this.group);
  }

  /** Começa a animação do HUMAN PLAYER entregando um NECTAR na LOADING ZONE. */
  tossNectar(alliance: "red" | "blue"): void {
    this.humanPlayers[alliance].tossTime = TOSS_DURATION;
  }

  update(dt: number): void {
    this.time += dt;
    for (const player of Object.values(this.humanPlayers)) {
      if (player.tossTime > 0) {
        player.tossTime = Math.max(0, player.tossTime - dt);
        // braço sobe para frente e solta (meia senoide), o outro acompanha um pouco
        const phase = 1 - player.tossTime / TOSS_DURATION;
        const lift = Math.sin(phase * Math.PI);
        player.rightArm.rotation.x = -lift * 1.9;
        player.leftArm.rotation.x = -lift * 0.5;
      } else {
        // respiração/balanço parado
        const idle = Math.sin(this.time * 1.6) * 0.05;
        player.rightArm.rotation.x = idle;
        player.leftArm.rotation.x = -idle;
      }
    }
    if (this.animateCrowd) {
      const m = new THREE.Matrix4();
      for (let i = 0; i < this.crowdBase.length; i++) {
        const bob = Math.max(0, Math.sin(this.time * 2.2 + this.crowdPhase[i])) * 0.04;
        m.copy(this.crowdBase[i]).premultiply(new THREE.Matrix4().makeTranslation(0, bob, 0));
        for (const mesh of this.crowd) mesh.setMatrixAt(i, m);
      }
      for (const mesh of this.crowd) mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
