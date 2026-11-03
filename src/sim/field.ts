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
      const shade = 76 + Math.round(rand() * 8);
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
  ctx.strokeStyle = "rgba(20,21,25,0.5)";
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

export function buildField(physics: PhysicsWorld, scene: THREE.Scene): void {
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

  // Tablado do evento ao redor do campo (o gramado fica por conta do cenário) e ALLIANCE AREAS (97 × 54 pol, §9.3; vermelha à esquerda da plateia, §9.5)
  const outside = new THREE.Mesh(
    new THREE.PlaneGeometry(7.4, 5.2),
    new THREE.MeshStandardMaterial({ color: 0x3a3e46, roughness: 1 }),
  );
  outside.rotation.x = -Math.PI / 2;
  outside.position.y = -0.002;
  scene.add(outside);
  for (const [alliance, sign] of [["red", -1], ["blue", 1]] as const) {
    const area = new THREE.Mesh(
      new THREE.PlaneGeometry(54 * INCH, 97 * INCH),
      new THREE.MeshStandardMaterial({ color: ALLIANCE_COLORS[alliance], transparent: true, opacity: 0.35 }),
    );
    area.rotation.x = -Math.PI / 2;
    const p = toWorld(sign * (FIELD.half + 2 + 27), 0, 0);
    area.position.set(p.x, 0.001, p.z);
    scene.add(area);
  }

  // Perímetro: policarbonato transparente com trilho de alumínio no topo
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xcfe3ff, transparent: true, opacity: 0.18, depthWrite: false });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x9a989a, metalness: 0.6, roughness: 0.4 });
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
    scene.add(rail);
  }

  buildHiveFrame(physics, scene, ground);
}

/** Estrutura triangular da HIVE (§9.6.1, Fig. 9-8): dois "A" ligados por uma travessa no topo. */
function buildHiveFrame(physics: PhysicsWorld, scene: THREE.Scene, ground: RAPIER.RigidBody): void {
  const mat = new THREE.MeshStandardMaterial({ color: 0x9a989a, metalness: 0.7, roughness: 0.35 });
  const halfDepth = HIVE.frameDepth / 2;
  const apex = HIVE.pivotHeight + 1.5;
  const legLength = Math.hypot(halfDepth, apex);
  const legAngle = Math.atan2(halfDepth, apex);
  const side = 0.75; // meia-seção da barra (pol)

  for (const x of [-HIVE.frameWidth / 2, HIVE.frameWidth / 2]) {
    for (const dir of [-1, 1]) {
      // perna inclinada de (y = dir·halfDepth, z = 0) até (y = 0, z = apex)
      const center = toWorld(x, (dir * halfDepth) / 2, apex / 2);
      // inclinação no plano y-z do manual = rotação em torno do X do mundo
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dir * legAngle);
      physics.world.createCollider(
        RAPIER.ColliderDesc.cuboid(side * INCH, (legLength / 2) * INCH, side * INCH)
          .setTranslation(center.x, center.y, center.z)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
        ground,
      );
      const leg = new THREE.Mesh(new THREE.BoxGeometry(side * 2 * INCH, legLength * INCH, side * 2 * INCH), mat);
      leg.position.copy(center);
      leg.quaternion.copy(q);
      leg.castShadow = true;
      scene.add(leg);
    }
    // barra de base (só visual: fica rente ao piso, presa por baixo dos TILES)
    const base = new THREE.Mesh(new THREE.BoxGeometry(side * 2 * INCH, 0.4 * INCH, HIVE.frameDepth * INCH), mat);
    base.position.copy(toWorld(x, 0, 0.2));
    scene.add(base);
  }
  // travessa do topo, ao longo de x, na altura dos pivôs
  const bar = new THREE.Mesh(new THREE.BoxGeometry(HIVE.frameWidth * INCH, 1.5 * INCH, 1.5 * INCH), mat);
  bar.position.copy(toWorld(0, 0, apex));
  scene.add(bar);
  physics.world.createCollider(
    RAPIER.ColliderDesc.cuboid((HIVE.frameWidth / 2) * INCH, 0.75 * INCH, 0.75 * INCH).setTranslation(bar.position.x, bar.position.y, bar.position.z),
    ground,
  );

  // Painel amarelo genérico no frame (o painel oficial tem o logotipo, que não reproduzimos).
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(HIVE.frameWidth * 0.55 * INCH, 6 * INCH, 0.3 * INCH),
    new THREE.MeshStandardMaterial({ color: 0xf7e326, roughness: 0.6 }),
  );
  panel.position.copy(toWorld(0, 0, apex + 5));
  scene.add(panel);
}
