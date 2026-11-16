// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Galpão industrial em volta da arena (modelado no Blender por scripts/blender/build_venue.py) e a plateia
// sentada na arquibancada. O modelo é só visual; as texturas (concreto, chapa) são geradas aqui.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const DIR = `${import.meta.env.BASE_URL}models/venue`;

interface SeatRow {
  y: number;
  z: number;
  segments: Array<[number, number]>;
}

/** Desenha numa textura quadrada que se repete sem emenda (cada traço é repetido nas bordas). */
function tileTexture(size: number, draw: (ctx: CanvasRenderingContext2D, wrap: (fn: (dx: number, dy: number) => void) => void) => void): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const wrap = (fn: (dx: number, dy: number) => void) => {
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) fn(dx, dy);
  };
  draw(ctx, wrap);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

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

/** Concreto polido: manchas suaves, pontinhos de agregado e a junta de dilatação na borda de cada placa de 4 m. */
function concreteTexture(rand: () => number): THREE.CanvasTexture {
  const texture = tileTexture(512, (ctx, wrap) => {
    ctx.fillStyle = "rgb(214,214,210)";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 70; i++) {
      const x = rand() * 512;
      const y = rand() * 512;
      const r = 30 + rand() * 110;
      const dark = rand() > 0.45;
      wrap((dx, dy) => {
        const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        g.addColorStop(0, dark ? "rgba(120,120,118,0.16)" : "rgba(255,255,250,0.14)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      });
    }
    for (let i = 0; i < 9000; i++) {
      const v = 150 + rand() * 90;
      ctx.fillStyle = `rgba(${v},${v},${v - 4},0.5)`;
      ctx.fillRect(rand() * 512, rand() * 512, 1 + rand(), 1 + rand());
    }
    // junta serrada (aparece a cada repetição da textura)
    ctx.fillStyle = "rgba(70,70,70,0.75)";
    ctx.fillRect(0, 0, 512, 3);
    ctx.fillRect(0, 0, 3, 512);
  });
  texture.repeat.set(9, 7);
  return texture;
}

/** Chapa pintada: escorridos verticais bem leves (sujeira e desgaste). */
function panelTexture(rand: () => number): THREE.CanvasTexture {
  const texture = tileTexture(256, (ctx) => {
    ctx.fillStyle = "rgb(225,227,228)";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 160; i++) {
      const x = rand() * 256;
      const w = 1 + rand() * 5;
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.5 + rand() * 0.5, `rgba(90,92,95,${0.04 + rand() * 0.08})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, w, 256);
    }
  });
  texture.repeat.set(6, 2);
  return texture;
}

function materials(rand: () => number): Record<string, THREE.Material> {
  const standard = (color: number, roughness: number, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  const concrete = concreteTexture(rand);
  const panel = panelTexture(rand);
  return {
    concrete: standard(0x8b8c8b, 0.82, 0, { map: concrete }),
    "concrete-dark": standard(0x5a5b5c, 0.9),
    "wall-panel": standard(0xa3a8ad, 0.6, 0.35, { map: panel }),
    "roof-panel": standard(0x55595e, 0.7, 0.3),
    steel: standard(0x3b4148, 0.55, 0.6),
    "steel-light": standard(0x8c9198, 0.45, 0.6),
    "safety-yellow": standard(0xf2b705, 0.55),
    seat: standard(0x4b5059, 0.6),
    bleacher: standard(0x7a7c7e, 0.85, 0, { map: concrete }),
    light: new THREE.MeshBasicMaterial({ color: 0xfffbea, fog: false }),
    "container-blue": standard(0x2b4d78, 0.6, 0.3),
    "container-orange": standard(0xa64f1f, 0.6, 0.3),
    "container-gray": standard(0x7d8185, 0.6, 0.3),
    "container-green": standard(0x2f5a3c, 0.6, 0.3),
    door: standard(0xa9adb1, 0.5, 0.4),
    "banner-red": standard(0xc41d24, 0.8, 0, { side: THREE.DoubleSide }),
    "banner-blue": standard(0x0d5aa7, 0.8, 0, { side: THREE.DoubleSide }),
    wood: standard(0x8a6a44, 0.85),
  };
}

/** Piso provisório enquanto o galpão carrega (e se o arquivo faltar). */
export function placeholderFloor(): THREE.Mesh {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6f706f, roughness: 0.85 }));
  floor.position.y = -0.006;
  floor.receiveShadow = true;
  return floor;
}

export interface Venue {
  root: THREE.Object3D;
  /** Anima a plateia: balanço leve sempre e pulos enquanto `cheer` > 0. */
  update(time: number, cheer: number): void;
}

/** Plateia sentada: 3 malhas instanciadas (camisa, cabeça, calça), com cores variadas. */
function audience(rows: SeatRow[], rand: () => number): { group: THREE.Group; update: (time: number, cheer: number) => void } {
  const group = new THREE.Group();
  const seats: Array<{ x: number; y: number; z: number; phase: number; jump: number }> = [];
  for (const row of rows) {
    for (const [a, b] of row.segments) {
      for (let x = a; x <= b; x += 0.55) {
        if (rand() < 0.68) seats.push({ x: x + (rand() - 0.5) * 0.08, y: row.y, z: row.z, phase: rand() * Math.PI * 2, jump: 0.6 + rand() * 0.6 });
      }
    }
  }
  const torsoGeo = new THREE.CapsuleGeometry(0.17, 0.32, 3, 8).translate(0, 0.38, -0.04);
  const headGeo = new THREE.SphereGeometry(0.11, 10, 8).translate(0, 0.78, -0.04);
  const legsGeo = mergeGeometries([
    new THREE.BoxGeometry(0.13, 0.13, 0.42).translate(-0.09, 0.08, -0.22),
    new THREE.BoxGeometry(0.13, 0.13, 0.42).translate(0.09, 0.08, -0.22),
    new THREE.BoxGeometry(0.12, 0.3, 0.12).translate(-0.09, -0.07, -0.42),
    new THREE.BoxGeometry(0.12, 0.3, 0.12).translate(0.09, -0.07, -0.42),
  ])!;
  const make = (geo: THREE.BufferGeometry) => {
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), seats.length);
    group.add(mesh);
    return mesh;
  };
  const torso = make(torsoGeo);
  const head = make(headGeo);
  const legs = make(legsGeo);
  // camisas de equipe (vivas) no meio de roupas comuns; tons de pele variados
  const shirts = [0xd62f2f, 0x2563c9, 0xf2b705, 0xf57e25, 0x2f9e5b, 0x7a4fc2, 0xffffff, 0x2a2d33, 0x8a8f96, 0x1f3f6e];
  const skins = [0xf1c9a5, 0xd9a47a, 0xb67b52, 0x8a5634, 0x5c3a24];
  const c = new THREE.Color();
  seats.forEach((_, i) => {
    torso.setColorAt(i, c.setHex(shirts[Math.floor(rand() * shirts.length)]));
    head.setColorAt(i, c.setHex(skins[Math.floor(rand() * skins.length)]));
    legs.setColorAt(i, c.setHex(rand() < 0.7 ? 0x2b3442 : 0x5b5f66));
  });
  const m = new THREE.Matrix4();
  // a geometria já olha para -z, de frente para a arena
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const pose = (time: number, cheer: number) => {
    seats.forEach((s, i) => {
      const bob = Math.sin(time * 1.3 + s.phase) * 0.008;
      const up = cheer > 0 ? Math.max(0, Math.sin(time * 9 * s.jump + s.phase)) * 0.12 * Math.min(1, cheer * 2) : 0;
      p.set(s.x, s.y + bob + up, s.z);
      m.compose(p, q, one);
      torso.setMatrixAt(i, m);
      head.setMatrixAt(i, m);
      legs.setMatrixAt(i, m);
    });
    for (const mesh of [torso, head, legs]) mesh.instanceMatrix.needsUpdate = true;
  };
  pose(0, 0);
  let still = false;
  return {
    group,
    update(time, cheer) {
      // fora da comemoração, a plateia só balança a cada poucos quadros (custo baixo)
      if (cheer <= 0 && still && Math.floor(time * 10) % 3 !== 0) return;
      still = cheer <= 0;
      pose(time, cheer);
    },
  };
}

/** Carrega o galpão; a plateia só entra no preset Alto. Devolve null se o arquivo faltar. */
export async function loadVenue(withAudience: boolean): Promise<Venue | null> {
  try {
    const [gltf, info] = await Promise.all([
      new GLTFLoader().loadAsync(`${DIR}/warehouse.glb`),
      fetch(`${DIR}/warehouse.json`).then((r) => r.json() as Promise<{ seatRows: SeatRow[] }>),
    ]);
    const rand = seeded(24823);
    const mats = materials(rand);
    gltf.scene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const name = (mesh.material as THREE.Material).name;
      mesh.material = mats[name] ?? mesh.material;
      // só o piso recebe sombra (das peças da arena); o resto do galpão não entra no mapa de sombras
      mesh.receiveShadow = name === "concrete" || name === "safety-yellow";
      mesh.castShadow = false;
    });
    const root = new THREE.Group();
    root.add(gltf.scene);
    const crowd = withAudience ? audience(info.seatRows, rand) : null;
    if (crowd) root.add(crowd.group);
    return { root, update: (time, cheer) => crowd?.update(time, cheer) };
  } catch {
    return null;
  }
}
