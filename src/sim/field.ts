// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Campo estático: piso de TILES, fitas, perímetro, ALLIANCE AREAS e estrutura (frame) da HIVE.
// Modelos recriados do zero a partir das medidas do manual; nenhum asset oficial é usado.
import * as THREE from "three";
import { FIELD, GARDENS, HIVE, INCH, LOADING_ZONES, toWorld, type Rect } from "./geometry";
import { RAPIER, type PhysicsWorld } from "./physics";

export const ALLIANCE_COLORS = { red: 0xed1c24, blue: 0x0066b3 } as const; // FIRST Brand Guidelines p.9

const TEXTURE_SIZE = 1024;

/** Gerador pseudoaleatório fixo: a textura sai igual em toda partida (e nos replays). */
function seeded(seed: number): () => number {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

/** Bordas de encaixe dos TILES de espuma: dentes de 1 pol alternando de lado ao longo da junta. */
function seamPath(ctx: CanvasRenderingContext2D, px: number, along: "x" | "y", at: number, length: number): void {
  const tooth = 0.7 * px;
  const step = 1.5 * px;
  ctx.beginPath();
  for (let s = 0, k = 0; s <= length; s += step, k++) {
    const off = k % 2 ? tooth / 2 : -tooth / 2;
    if (along === "x") {
      ctx.lineTo(s, at + off);
      ctx.lineTo(s + step, at + off);
    } else {
      ctx.lineTo(at + off, s);
      ctx.lineTo(at + off, s + step);
    }
  }
  ctx.stroke();
}

function floorTexture(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d")!;
  // relevo: claro = alto; as juntas e os poros da espuma ficam mais baixos
  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = bumpCanvas.height = TEXTURE_SIZE / 2;
  const bump = bumpCanvas.getContext("2d")!;
  const px = TEXTURE_SIZE / (FIELD.half * 2); // pixels por polegada
  const toPx = (x: number, y: number) => [(x + FIELD.half) * px, (FIELD.half - y) * px] as const;
  const rand = seeded(24823);

  // TILES de espuma cinza (6 × 6, §9.2): cada um com tom levemente diferente e textura de poros
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const shade = 150 + Math.round(rand() * 10);
      ctx.fillStyle = `rgb(${shade},${shade + 1},${shade + 5})`;
      ctx.fillRect(i * 24 * px, j * 24 * px, 24 * px, 24 * px);
    }
  }
  bump.fillStyle = "#c0c0c0";
  bump.fillRect(0, 0, bumpCanvas.width, bumpCanvas.height);
  for (let n = 0; n < 26000; n++) {
    const x = rand() * TEXTURE_SIZE;
    const y = rand() * TEXTURE_SIZE;
    const v = rand();
    ctx.fillStyle = v > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)";
    ctx.fillRect(x, y, 1.4, 1.4);
    bump.fillStyle = v > 0.5 ? "#d0d0d0" : "#a8a8a8";
    bump.fillRect(x / 2, y / 2, 1, 1);
  }

  // juntas com encaixe
  ctx.strokeStyle = "rgba(60,62,68,0.45)";
  ctx.lineWidth = 1.5;
  bump.strokeStyle = "#202020";
  bump.lineWidth = 2;
  for (let k = 1; k < 6; k++) {
    seamPath(ctx, px, "y", k * 24 * px, TEXTURE_SIZE);
    seamPath(ctx, px, "x", k * 24 * px, TEXTURE_SIZE);
    seamPath(bump, px / 2, "y", (k * 24 * px) / 2, TEXTURE_SIZE / 2);
    seamPath(bump, px / 2, "x", (k * 24 * px) / 2, TEXTURE_SIZE / 2);
  }

  const tapeRect = (r: Rect, color: string, filled: boolean) => {
    const [x0, y0] = toPx(r.xMin, r.yMax);
    const [x1, y1] = toPx(r.xMax, r.yMin);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    if (filled) {
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    } else {
      ctx.lineWidth = 2 * px; // fita de 2 pol (§9.3)
      ctx.strokeRect(x0 + px, y0 + px, x1 - x0 - 2 * px, y1 - y0 - 2 * px);
    }
  };
  tapeRect(LOADING_ZONES.red, "#ed1c24", false);
  tapeRect(LOADING_ZONES.blue, "#1e7fd0", false);
  tapeRect(GARDENS.red, "#ed1c24", true);
  tapeRect(GARDENS.blue, "#1e7fd0", true);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return { map, bump: new THREE.CanvasTexture(bumpCanvas) };
}

export interface FieldVisuals {
  /** Estrutura das HIVEs: começa com as peças geradas no código; o jogo pode trocar pelo modelo detalhado. */
  hiveFrame: THREE.Group;
}

export function buildField(physics: PhysicsWorld, scene: THREE.Scene): FieldVisuals {
  const size = FIELD.half * 2 * INCH;
  const ground = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

  // Piso
  physics.world.createCollider(
    RAPIER.ColliderDesc.cuboid(size, 0.05, size).setTranslation(0, -0.05, 0).setFriction(0.8).setRestitution(0.2),
    ground,
  );
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    (() => {
      const { map, bump } = floorTexture();
      return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.2, roughness: 0.93, envMapIntensity: 0.3 });
    })(),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Base escura sob o campo (aparece como uma borda rente à grama) e ALLIANCE AREAS (97 × 54 pol, §9.3;
  // vermelha à esquerda da plateia, §9.5), só como um tom suave na grama
  const base = new THREE.Mesh(new THREE.BoxGeometry(size + 0.16, 0.03, size + 0.16), new THREE.MeshStandardMaterial({ color: 0x1e1f22, roughness: 0.8 }));
  base.position.y = -0.016;
  base.receiveShadow = true;
  scene.add(base);
  for (const [alliance, sign] of [["red", -1], ["blue", 1]] as const) {
    const area = new THREE.Mesh(
      new THREE.PlaneGeometry(54 * INCH, 97 * INCH),
      new THREE.MeshStandardMaterial({ color: ALLIANCE_COLORS[alliance], transparent: true, opacity: 0.1, depthWrite: false }),
    );
    area.rotation.x = -Math.PI / 2;
    const p = toWorld(sign * (FIELD.half + 2 + 27), 0, 0);
    area.position.set(p.x, 0.001, p.z);
    scene.add(area);
  }

  // Perímetro: policarbonato transparente com perfis pretos no topo e na base (como no CAD e no vídeo da temporada)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xdfeaf2, transparent: true, opacity: 0.14, roughness: 0.08, metalness: 0.1, depthWrite: false });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x18191c, metalness: 0.4, roughness: 0.45 });
  const h = FIELD.wallHeight;
  const t = FIELD.wallThickness;
  const walls: Array<[number, number, number, number]> = [
    // x, y (centro, pol), meia-largura em x, meia-largura em y
    [0, FIELD.half + t / 2, FIELD.half + t, t / 2],
    [0, -FIELD.half - t / 2, FIELD.half + t, t / 2],
    [FIELD.half + t / 2, 0, t / 2, FIELD.half + t],
    [-FIELD.half - t / 2, 0, t / 2, FIELD.half + t],
  ];
  for (const [x, y, hx, hy] of walls) {
    const p = toWorld(x, y, h / 2);
    // colisor bem mais alto que o visual para elementos lançados não "vazarem" com facilidade
    physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx * INCH, (h / 2) * INCH, hy * INCH).setTranslation(p.x, p.y, p.z).setFriction(0.4).setRestitution(0.3),
      ground,
    );
    const wall = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 * INCH, h * INCH, hy * 2 * INCH), wallMat);
    wall.position.copy(p);
    scene.add(wall);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 * INCH + 0.01, 1.5 * INCH, hy * 2 * INCH + 0.01), railMat);
    rail.position.copy(toWorld(x, y, h));
    rail.castShadow = true;
    scene.add(rail);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 * INCH + 0.01, 1.2 * INCH, hy * 2 * INCH + 0.012), railMat);
    foot.position.copy(toWorld(x, y, 0.6));
    scene.add(foot);
  }

  return { hiveFrame: buildHiveFrame(physics, scene, ground) };
}

/**
 * Estrutura das HIVEs (§9.6.1, Fig. 9-8): dois "A" ligados por uma travessa de 24 pol no topo. As pernas saem
 * dos cantos de cima (perto de cada pivô) e abrem até os pés, nos cantos da base de 49,46 × 38,95 pol.
 * Medidas dos cantos e da travessa: CAD oficial (am-5874, am-5875, am-5876).
 */
function buildHiveFrame(physics: PhysicsWorld, scene: THREE.Scene, ground: RAPIER.RigidBody): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x6f7278, metalness: 0.6, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.5 });
  const half = 0.5; // perfil de 1 pol
  const cornerZ = 39.6;
  const footX = HIVE.frameWidth / 2 - 1;
  const footY = HIVE.frameDepth / 2 - 1;
  const up = new THREE.Vector3(0, 1, 0);

  const addBox = (center: THREE.Vector3, hx: number, hy: number, hz: number, q: THREE.Quaternion, material: THREE.Material, solid = true) => {
    if (solid) {
      physics.world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx * INCH, hy * INCH, hz * INCH).setTranslation(center.x, center.y, center.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
        ground,
      );
    }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 * INCH, hy * 2 * INCH, hz * 2 * INCH), material);
    mesh.position.copy(center);
    mesh.quaternion.copy(q);
    mesh.castShadow = true;
    group.add(mesh);
  };
  const none = new THREE.Quaternion();

  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const top = toWorld(sx * 12.6, sy * 0.8, cornerZ - 0.3);
      const foot = toWorld(sx * footX, sy * footY, 1.6);
      const q = new THREE.Quaternion().setFromUnitVectors(up, foot.clone().sub(top).normalize());
      addBox(top.clone().add(foot).multiplyScalar(0.5), half, top.distanceTo(foot) / INCH / 2, half, q, mat);
      addBox(toWorld(sx * footX, sy * footY, 1.05), 1.15, 1.05, 1.15, none, dark);
    }
    // canto de cima (segura as pernas, a travessa e o eixo da HIVE)
    addBox(toWorld(sx * 12.6, 0, cornerZ + 0.4), 1.6, 2.35, 1.7, none, dark);
    // barra de base (só visual: fica rente ao piso, presa por baixo dos TILES)
    addBox(toWorld(sx * footX, 0, 1), half, 1, HIVE.frameDepth / 2, none, mat, false);
  }
  // travessa do topo, ao longo de x, entre os dois cantos
  addBox(toWorld(0, 0, cornerZ), 12, half, half, none, mat);

  // Painel amarelo genérico de cada lado (o painel oficial tem o logotipo, que não reproduzimos).
  const lean = Math.atan2(footY - 0.8, cornerZ - 1.9);
  for (const sy of [-1, 1]) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), sy * lean);
    addBox(toWorld(0, sy * 5.6, 30.4), 15.08, 3.23, 0.06, q, new THREE.MeshStandardMaterial({ color: 0xf7e326, roughness: 0.6 }), false);
  }
  scene.add(group);
  return group;
}
