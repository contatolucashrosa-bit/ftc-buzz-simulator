// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Cenário da temporada: a arena num prado aberto, cercado por colinas e por uma floresta densa de pinheiros,
// com samambaias, flores silvestres e cogumelos. As equipes são apicultores de macacão inteiro (rosa na
// aliança vermelha, lavanda na azul). Tudo é gerado no código (low-poly, sem assets de terceiros), inspirado
// no clima do vídeo de divulgação da BIOBUZZ, sem copiar modelos.
// A quantidade de objetos depende do preset de qualidade, para rodar em computadores escolares.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Quality } from "./stage";

type Alliance = "red" | "blue";
const FIELD_HALF_M = 1.83;
// ALLIANCE AREA (§9.3): 54 × 97 pol, encostada na parede lateral do campo
const AREA = { inner: FIELD_HALF_M + 0.05, outer: FIELD_HALF_M + 0.05 + 54 * 0.0254, halfDepth: (97 * 0.0254) / 2 };
const SKY_TOP = new THREE.Color(0x8fb0cc);
const SKY_HORIZON = new THREE.Color(0xc7d2d4);
/** Neblina esverdeada: a floresta ao longe vira uma parede escura e suave, como no vídeo. */
const HAZE = 0x9aa79a;

/** Macacões das equipes: cor do tecido, chapéu e luvas/botas por aliança. */
const SUIT: Record<Alliance, { cloth: number; hat: number; trim: number }> = {
  red: { cloth: 0xd9a2a8, hat: 0xe0607e, trim: 0xd0546f },
  blue: { cloth: 0xa4a9dc, hat: 0x7f85d6, trim: 0x6f75c8 },
};

/** Quantidades por preset. */
const DETAIL: Record<Quality, { trees: number; ferns: number; bushes: number; mushrooms: number; flowers: number; grassDetail: boolean }> = {
  low: { trees: 260, ferns: 0, bushes: 30, mushrooms: 12, flowers: 60, grassDetail: false },
  medium: { trees: 620, ferns: 140, bushes: 90, mushrooms: 40, flowers: 200, grassDetail: true },
  high: { trees: 750, ferns: 220, bushes: 140, mushrooms: 70, flowers: 320, grassDetail: true },
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

// ---------- céu e terreno ----------

function skyDome(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(90, 32, 16);
  const colors: number[] = [];
  const pos = geometry.attributes.position;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / 90);
    c.copy(SKY_HORIZON).lerp(SKY_TOP, Math.pow(t, 0.6));
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -1;
  return sky;
}

/**
 * Altura do terreno (m): plano onde ficam a arena e as ALLIANCE AREAS, subindo em colinas suaves
 * a partir de ~9 m, até virar uma encosta atrás da floresta (fecha o horizonte, como no vídeo).
 */
export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const t = Math.min(1, Math.max(0, (r - 9) / 14));
  const ramp = t * t * (3 - 2 * t);
  const hills = 1.2 + Math.sin(x * 0.11) * Math.cos(z * 0.09) * 1.4 + Math.sin((x - z) * 0.05) * 1.1;
  return ramp * hills + Math.max(0, r - 26) * 0.32;
}

/** Textura de grama: ruído fino em tons de verde, repetido pelo terreno (multiplica a cor dos vértices). */
function grassTexture(rand: () => number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#e4e4e4";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const v = 200 + Math.floor(rand() * 55);
    ctx.fillStyle = `rgb(${v - 20},${v},${v - 30})`;
    const x = rand() * 256;
    const y = rand() * 256;
    // folhinhas: traços curtos quase verticais
    ctx.fillRect(x, y, 1, 2 + rand() * 4);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(70, 70);
  texture.anisotropy = 4;
  return texture;
}

function terrain(rand: () => number, detail: boolean): THREE.Mesh {
  const size = 150;
  const geometry = new THREE.PlaneGeometry(size, size, 120, 120);
  geometry.rotateX(-Math.PI / 2);
  const colors: number[] = [];
  const meadow = new THREE.Color(0x24481a);
  const shade = new THREE.Color(0x173312);
  const c = new THREE.Color();
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z) - 0.006);
    // manchas de grama mais escura e mais clara, e o chão da floresta mais sombreado
    const patch = Math.sin(x * 0.7 + Math.cos(z * 0.5)) * Math.cos(z * 0.6 - x * 0.2);
    const forestShade = Math.min(1, Math.max(0, (Math.hypot(x, z) - 15) / 10));
    c.copy(meadow).lerp(shade, 0.25 + patch * 0.2 + forestShade * 0.55).offsetHSL((rand() - 0.5) * 0.015, 0, (rand() - 0.5) * 0.03);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, map: detail ? grassTexture(rand) : null });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

/** Pontos num anel ao redor da arena, com a altura do terreno. `avoid`: raio livre perto das câmeras e das equipes. */
function scatter(count: number, rMin: number, rMax: number, rand: () => number, avoidArena = true): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  let guard = 0;
  while (points.length < count && guard++ < count * 40) {
    const a = rand() * Math.PI * 2;
    const r = rMin + Math.sqrt(rand()) * (rMax - rMin);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    // arena + ALLIANCE AREAS + espaço das câmeras da plateia (z > 0) e dos pilotos (|x| grande)
    if (avoidArena && Math.abs(x) < AREA.outer + 1.2 && Math.abs(z) < AREA.halfDepth + 1.4) continue;
    if (avoidArena && z > 2 && z < 6 && Math.abs(x) < 3) continue;
    points.push(new THREE.Vector3(x, terrainHeight(x, z), z));
  }
  return points;
}

// ---------- natureza ----------

/** Floresta de pinheiros escuros em várias camadas: os de trás formam a "parede" verde do vídeo. */
function forest(count: number, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.1, 0.18, 1.4, 5).translate(0, 0.7, 0);
  const pineGeo = mergeGeometries([
    new THREE.ConeGeometry(1.15, 2.4, 8).translate(0, 2.0, 0),
    new THREE.ConeGeometry(0.95, 2.1, 8).translate(0, 3.1, 0),
    new THREE.ConeGeometry(0.7, 1.8, 8).translate(0, 4.1, 0),
    new THREE.ConeGeometry(0.42, 1.4, 8).translate(0, 5.0, 0),
  ])!;
  const trunks: THREE.Matrix4[] = [];
  const pines: THREE.Matrix4[] = [];
  const colors: THREE.Color[] = [];
  for (const p of scatter(count, 17, 62, rand)) {
    const s = 1.1 + rand() * 1.3;
    const m = new THREE.Matrix4().compose(p, yawQ(rand() * 6), new THREE.Vector3(s, s * (1.05 + rand() * 0.5), s));
    trunks.push(m);
    pines.push(m);
    colors.push(new THREE.Color().setHSL(0.36 + rand() * 0.04, 0.5 + rand() * 0.15, 0.028 + rand() * 0.022));
  }
  group.add(instanced(trunkGeo, lambert(0x2e2118), trunks));
  group.add(instanced(pineGeo, lambert(0xffffff, { flatShading: true }), pines, colors));
  return group;
}

/** Samambaias: folhas finas em leque, arqueadas para fora. */
function ferns(count: number, rand: () => number): THREE.Object3D {
  if (!count) return new THREE.Group();
  const fronds: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.ConeGeometry(0.07, 0.62, 4, 1).scale(1, 1, 0.18).translate(0, 0.31, 0);
    leaf.rotateX(0.95 + (i % 2) * 0.15);
    leaf.rotateY((i / 7) * Math.PI * 2);
    fronds.push(leaf);
  }
  const geometry = mergeGeometries(fronds)!;
  const transforms: THREE.Matrix4[] = [];
  const colors: THREE.Color[] = [];
  for (const p of scatter(count, 5.5, 20, rand)) {
    const s = 0.45 + rand() * 0.5;
    transforms.push(new THREE.Matrix4().compose(p, yawQ(rand() * 6), new THREE.Vector3(s, s, s)));
    colors.push(new THREE.Color().setHSL(0.28 + rand() * 0.05, 0.6, 0.06 + rand() * 0.03));
  }
  return instanced(geometry, lambert(0xffffff, { side: THREE.DoubleSide, flatShading: true }), transforms, colors);
}

function bushes(count: number, rand: () => number): THREE.Object3D {
  if (!count) return new THREE.Group();
  const geometry = mergeGeometries([new THREE.IcosahedronGeometry(0.42, 0).translate(0, 0.28, 0), new THREE.IcosahedronGeometry(0.3, 0).translate(0.35, 0.2, 0.1)])!;
  const transforms: THREE.Matrix4[] = [];
  const colors: THREE.Color[] = [];
  for (const p of scatter(count, 9, 22, rand)) {
    transforms.push(new THREE.Matrix4().compose(p, yawQ(rand() * 6), new THREE.Vector3(1, 0.8 + rand() * 0.5, 1).multiplyScalar(0.7 + rand() * 0.8)));
    colors.push(new THREE.Color().setHSL(0.3 + rand() * 0.04, 0.65, 0.032 + rand() * 0.02));
  }
  return instanced(geometry, lambert(0xffffff, { flatShading: true }), transforms, colors);
}

/** Cogumelos de chapéu vermelho em grupinhos. */
function mushrooms(count: number, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  if (!count) return group;
  const stemGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.24, 7).translate(0, 0.12, 0);
  const capGeo = mergeGeometries([
    new THREE.SphereGeometry(0.15, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1).translate(0, 0.22, 0),
    new THREE.CircleGeometry(0.15, 12).rotateX(Math.PI / 2).translate(0, 0.22, 0),
  ])!;
  const transforms: THREE.Matrix4[] = [];
  for (const center of scatter(Math.ceil(count / 3), 6, 18, rand)) {
    for (let i = 0; i < 3; i++) {
      const s = 0.6 + rand() * 1.0;
      const x = center.x + (rand() - 0.5) * 0.5;
      const z = center.z + (rand() - 0.5) * 0.5;
      transforms.push(new THREE.Matrix4().compose(new THREE.Vector3(x, terrainHeight(x, z), z), yawQ(rand() * 6), new THREE.Vector3(s, s, s)));
    }
  }
  group.add(instanced(stemGeo, lambert(0xf3eee2), transforms));
  group.add(instanced(capGeo, lambert(0xd3262c, { side: THREE.DoubleSide }), transforms));
  return group;
}

/** Flores silvestres em touceiras: roxas, azuis, brancas e amarelas. */
function wildflowers(count: number, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  if (!count) return group;
  const stemGeo = new THREE.CylinderGeometry(0.007, 0.009, 0.3, 4).translate(0, 0.15, 0);
  const headGeo = mergeGeometries([
    new THREE.CircleGeometry(0.045, 6).rotateX(-Math.PI / 2.3).translate(0, 0.31, 0),
    new THREE.SphereGeometry(0.018, 6, 4).translate(0, 0.315, 0.004),
  ])!;
  const transforms: THREE.Matrix4[] = [];
  const colors: THREE.Color[] = [];
  const palette = [0x8a6fd6, 0x5a7fe0, 0xffffff, 0xf2d43a, 0xd65ca8];
  for (const center of scatter(Math.ceil(count / 8), 4.5, 20, rand)) {
    const c = palette[Math.floor(rand() * palette.length)];
    for (let i = 0; i < 8; i++) {
      const x = center.x + (rand() - 0.5) * 1.2;
      const z = center.z + (rand() - 0.5) * 1.2;
      transforms.push(new THREE.Matrix4().compose(new THREE.Vector3(x, terrainHeight(x, z), z), yawQ(rand() * 6), new THREE.Vector3(1, 0.7 + rand() * 0.8, 1)));
      colors.push(new THREE.Color(c));
    }
  }
  group.add(instanced(stemGeo, lambert(0x2f6b2a), transforms));
  group.add(instanced(headGeo, lambert(0xffffff, { side: THREE.DoubleSide }), transforms, colors));
  return group;
}

// ---------- equipes: apicultores ----------

/** Apicultor low-poly de macacão inteiro, com braços articulados para animar. */
export interface Person {
  root: THREE.Group;
  rightArm: THREE.Group;
  leftArm: THREE.Group;
}

function beekeeper(alliance: Alliance, holding: "controller" | "none"): Person {
  const colors = SUIT[alliance];
  const root = new THREE.Group();
  const cloth = lambert(colors.cloth);
  const trim = lambert(colors.trim);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z = 0, parent: THREE.Object3D = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  // pernas largas do macacão e botas de borracha
  for (const side of [-1, 1]) {
    add(new THREE.CapsuleGeometry(0.095, 0.5, 4, 10), cloth, side * 0.1, 0.42);
    const boot = add(new THREE.CapsuleGeometry(0.075, 0.12, 4, 8), trim, side * 0.1, 0.08, 0.04);
    boot.rotation.x = Math.PI / 2;
  }
  // tronco "fofo" do macacão, com cinto
  const torso = add(new THREE.CapsuleGeometry(0.21, 0.42, 4, 14), cloth, 0, 1.0);
  torso.scale.set(1, 1, 0.78);
  const belt = add(new THREE.CylinderGeometry(0.205, 0.205, 0.035, 16), trim, 0, 0.84);
  belt.scale.set(1, 1, 0.8);
  // capuz, véu escuro na frente do rosto e chapéu de abas largas
  add(new THREE.SphereGeometry(0.16, 16, 12), cloth, 0, 1.43, -0.015);
  add(new THREE.SphereGeometry(0.135, 14, 10).scale(1, 1.05, 0.9), lambert(0x22232b), 0, 1.45, 0.05);
  add(new THREE.CylinderGeometry(0.17, 0.2, 0.2, 18, 1, true), lambert(0x2a2c35, { transparent: true, opacity: 0.55, side: THREE.DoubleSide }), 0, 1.45);
  const hat = lambert(colors.hat);
  // chapéu de apicultor: aba larga e caída, copa baixa e arredondada
  add(new THREE.CylinderGeometry(0.2, 0.34, 0.06, 24), hat, 0, 1.57);
  add(new THREE.SphereGeometry(0.17, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.62, 1), hat, 0, 1.59);

  const arm = (side: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.27, 1.25, 0);
    root.add(shoulder);
    add(new THREE.CapsuleGeometry(0.068, 0.44, 4, 8), cloth, 0, -0.27, 0, shoulder);
    add(new THREE.SphereGeometry(0.07, 10, 8), trim, 0, -0.57, 0.01, shoulder); // luva
    return shoulder;
  };
  const person = { root, rightArm: arm(1), leftArm: arm(-1) };
  if (holding === "controller") {
    // controle na frente do peito, segurado com as duas mãos
    const pad = new THREE.Group();
    add(new THREE.BoxGeometry(0.17, 0.035, 0.08), lambert(0x2b2d33), 0, 0, 0, pad);
    add(new THREE.BoxGeometry(0.05, 0.036, 0.05), lambert(0x2bc4d8), -0.075, 0.001, -0.01, pad);
    add(new THREE.BoxGeometry(0.05, 0.036, 0.05), lambert(0x2bc4d8), 0.075, 0.001, -0.01, pad);
    pad.position.set(0, 0.93, 0.27);
    pad.rotation.x = 0.5;
    root.add(pad);
  }
  return person;
}

// ---------- ambiente completo ----------

interface AnimatedPerson extends Person {
  role: "humanPlayer" | "driver" | "coach";
  phase: number;
  home: THREE.Vector3;
  facing: number;
}

/**
 * HUMAN PLAYER que entrega NECTAR (G426/G427): vai até a cesta da ALLIANCE AREA, pega um NECTAR,
 * volta para a borda da LOADING ZONE e o coloca no campo. O elemento só aparece no campo no instante
 * em que é solto (callback `release`).
 */
type DeliveryState = "idle" | "toCrate" | "pick" | "toZone" | "release";

interface Delivery {
  person: AnimatedPerson;
  crate: THREE.Vector3;
  state: DeliveryState;
  t: number;
  queue: Array<() => void>;
  current: (() => void) | null;
  ball: THREE.Mesh;
  crateBalls: THREE.Mesh[];
}

const WALK_SPEED = 1.3; // m/s
const PICK_S = 0.4;
const RELEASE_S = 0.7;
const ALLIANCE_HEX: Record<Alliance, number> = { red: 0xed1c24, blue: 0x0066b3 };

export class Environment {
  readonly group = new THREE.Group();
  /** Pessoas de cada ALLIANCE AREA (DRIVE TEAMS e HUMAN PLAYERS). */
  readonly alliances: Record<Alliance, THREE.Group> = { red: new THREE.Group(), blue: new THREE.Group() };
  private readonly people: Record<Alliance, AnimatedPerson[]> = { red: [], blue: [] };
  private readonly delivery = {} as Record<Alliance, Delivery>;
  private time = 0;

  constructor(scene: THREE.Scene, quality: Quality) {
    const detail = DETAIL[quality];
    const rand = seeded(24823);

    scene.background = SKY_HORIZON.clone();
    scene.fog = new THREE.Fog(HAZE, 22, quality === "low" ? 55 : 75);
    this.group.add(skyDome(), terrain(rand, detail.grassDetail));
    this.group.add(forest(detail.trees, rand), ferns(detail.ferns, rand), bushes(detail.bushes, rand), mushrooms(detail.mushrooms, rand), wildflowers(detail.flowers, rand));

    // ALLIANCE AREAS: 2 HUMAN PLAYERS perto da LOADING ZONE, 2 pilotos e 1 técnico por aliança
    for (const alliance of ["red", "blue"] as const) {
      const sign = alliance === "red" ? -1 : 1;
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
        const p = beekeeper(alliance, spot.role === "driver" ? "controller" : "none");
        p.root.position.set(sign * spot.x, 0, spot.z);
        p.root.rotation.y = facing;
        if (spot.role === "driver") {
          // braços dobrados segurando o controle
          p.rightArm.rotation.x = -0.95;
          p.leftArm.rotation.x = -0.95;
          p.rightArm.rotation.z = 0.32;
          p.leftArm.rotation.z = -0.32;
        }
        this.alliances[alliance].add(p.root);
        this.people[alliance].push({ ...p, role: spot.role, phase: rand() * 6, home: p.root.position.clone(), facing });
      }

      // cesta de vime com os NECTAR da aliança ainda fora do campo, atrás do HUMAN PLAYER
      const crate = new THREE.Vector3(sign * (AREA.inner + 1.0), 0, lz * 1.05);
      const basket = new THREE.Group();
      const wicker = lambert(0xa07a48);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.19, 0.22, 16, 1, true), lambert(0xa07a48, { side: THREE.DoubleSide }));
      body.position.y = 0.11;
      body.castShadow = true;
      const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.19, 16).rotateX(-Math.PI / 2), wicker);
      bottom.position.y = 0.01;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.015, 6, 20).rotateX(Math.PI / 2), lambert(0x7d5a32));
      rim.position.y = 0.22;
      basket.add(body, bottom, rim);
      basket.position.copy(crate);
      const ballGeo = new THREE.SphereGeometry(0.046, 12, 8);
      const ballMat = lambert(ALLIANCE_HEX[alliance]);
      const crateBalls = Array.from({ length: 8 }, (_, i) => {
        const b = new THREE.Mesh(ballGeo, ballMat);
        const a = (i / 4) * Math.PI * 2 + (i >= 4 ? 0.5 : 0);
        const r = i >= 4 ? 0.06 : 0.11;
        b.position.set(Math.cos(a) * r, 0.06 + (i >= 4 ? 0.08 : 0), Math.sin(a) * r);
        basket.add(b);
        return b;
      });
      this.alliances[alliance].add(basket);
      const hp = this.people[alliance].find((p) => p.role === "humanPlayer")!;
      // NECTAR na mão (aparece entre pegar e soltar)
      const ball = new THREE.Mesh(ballGeo, ballMat);
      ball.position.set(0, -0.66, 0.04);
      ball.visible = false;
      hp.rightArm.add(ball);
      this.delivery[alliance] = { person: hp, crate, state: "idle", t: 0, queue: [], current: null, ball, crateBalls };
      this.group.add(this.alliances[alliance]);
    }

    scene.add(this.group);
  }

  /** Pede ao HUMAN PLAYER que entregue um NECTAR; `release` é chamado quando ele o solta na LOADING ZONE. */
  requestNectar(alliance: Alliance, release: () => void): void {
    this.delivery[alliance].queue.push(release);
  }

  /** Quantos NECTAR ainda estão na ALLIANCE AREA (aparecem na cesta). */
  setNectarStock(alliance: Alliance, count: number): void {
    const d = this.delivery[alliance];
    // a bola que está na mão já saiu da cesta
    const inCrate = Math.max(0, count - (d.ball.visible ? 1 : 0));
    d.crateBalls.forEach((b, i) => (b.visible = i < inCrate));
  }

  /** Andar até um ponto; devolve true ao chegar. Balança braços e corpo enquanto anda. */
  private walk(p: AnimatedPerson, to: THREE.Vector3, dt: number): boolean {
    const pos = p.root.position;
    const dx = to.x - pos.x;
    const dz = to.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.02) return true;
    const step = Math.min(dist, WALK_SPEED * dt);
    pos.x += (dx / dist) * step;
    pos.z += (dz / dist) * step;
    p.root.rotation.y = Math.atan2(dx, dz);
    const swing = Math.sin(this.time * 9) * 0.5;
    p.rightArm.rotation.x = swing;
    p.leftArm.rotation.x = -swing;
    pos.y = Math.abs(Math.sin(this.time * 9)) * 0.03;
    return false;
  }

  private updateDelivery(d: Delivery, dt: number): void {
    const p = d.person;
    d.t += dt;
    switch (d.state) {
      case "idle":
        if (d.queue.length) {
          d.current = d.queue.shift()!;
          d.state = "toCrate";
          d.t = 0;
        }
        return;
      case "toCrate": {
        // para ao lado da cesta (sem entrar nela)
        const side = new THREE.Vector3().subVectors(p.home, d.crate).setLength(0.34).add(d.crate);
        if (this.walk(p, side, dt)) {
          d.state = "pick";
          d.t = 0;
        }
        return;
      }
      case "pick": {
        // abaixa o braço até a cesta e pega
        const k = Math.min(1, d.t / PICK_S);
        p.root.rotation.y = Math.atan2(d.crate.x - p.root.position.x, d.crate.z - p.root.position.z);
        p.rightArm.rotation.x = -Math.sin(k * Math.PI) * 0.9;
        if (k > 0.5) d.ball.visible = true;
        if (k >= 1) {
          d.state = "toZone";
          d.t = 0;
        }
        return;
      }
      case "toZone":
        if (this.walk(p, p.home, dt)) {
          d.state = "release";
          d.t = 0;
        }
        p.rightArm.rotation.x = -0.7; // segura o NECTAR à frente
        return;
      case "release": {
        const k = Math.min(1, d.t / RELEASE_S);
        p.root.rotation.y = p.facing;
        p.root.position.y = 0;
        const lift = Math.sin(k * Math.PI);
        p.rightArm.rotation.x = -0.7 - lift * 1.1;
        p.leftArm.rotation.x = -lift * 0.6;
        if (k >= 0.5 && d.current) {
          d.ball.visible = false;
          d.current();
          d.current = null;
        }
        if (k >= 1) {
          d.state = "idle";
          d.t = 0;
        }
        return;
      }
    }
  }

  /** `camera`: posição da câmera; quem estiver colado a ela some, para não tapar a tela (câmera do robô). */
  update(dt: number, camera?: THREE.Vector3): void {
    this.time += dt;
    for (const list of Object.values(this.people)) {
      for (const p of list) {
        if (camera) p.root.visible = Math.hypot(camera.x - p.root.position.x, camera.z - p.root.position.z) > 0.9;
        if (p.role === "driver") {
          // pequenos ajustes no controle
          p.rightArm.rotation.x = -0.95 + Math.sin(this.time * 3 + p.phase) * 0.04;
          p.leftArm.rotation.x = -0.95 + Math.sin(this.time * 3.3 + p.phase) * 0.04;
          continue;
        }
        const d = p.role === "humanPlayer" ? Object.values(this.delivery).find((x) => x.person === p) : undefined;
        if (d && (d.state !== "idle" || d.queue.length)) {
          this.updateDelivery(d, dt);
        } else {
          const idle = Math.sin(this.time * 1.4 + p.phase) * 0.06;
          p.rightArm.rotation.x = idle;
          p.leftArm.rotation.x = -idle;
          p.root.position.y = Math.max(0, Math.sin(this.time * 1.4 + p.phase)) * 0.004;
        }
      }
    }
  }
}
