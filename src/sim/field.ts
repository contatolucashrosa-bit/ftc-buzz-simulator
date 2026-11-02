// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Campo estático: piso de TILES, fitas, perímetro, ALLIANCE AREAS e estrutura (frame) da HIVE.
// Modelos recriados do zero a partir das medidas do manual; nenhum asset oficial é usado.
import * as THREE from "three";
import { FIELD, GARDENS, HIVE, INCH, LOADING_ZONES, toWorld, type Rect } from "./geometry";
import { RAPIER, type PhysicsWorld } from "./physics";

export const ALLIANCE_COLORS = { red: 0xed1c24, blue: 0x0066b3 } as const; // FIRST Brand Guidelines p.9

const TEXTURE_SIZE = 1024;

function floorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d")!;
  const px = TEXTURE_SIZE / (FIELD.half * 2); // pixels por polegada
  const toPx = (x: number, y: number) => [(x + FIELD.half) * px, (FIELD.half - y) * px] as const;

  // TILES de espuma cinza com leve variação (6 × 6, §9.2)
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const shade = 92 + ((i + j) % 2) * 6;
      ctx.fillStyle = `rgb(${shade},${shade},${shade + 4})`;
      ctx.fillRect(i * 24 * px, j * 24 * px, 24 * px, 24 * px);
    }
  }
  ctx.strokeStyle = "rgba(30,30,30,0.6)";
  ctx.lineWidth = 2;
  for (let k = 1; k < 6; k++) {
    ctx.beginPath();
    ctx.moveTo(k * 24 * px, 0);
    ctx.lineTo(k * 24 * px, TEXTURE_SIZE);
    ctx.moveTo(0, k * 24 * px);
    ctx.lineTo(TEXTURE_SIZE, k * 24 * px);
    ctx.stroke();
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

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
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
    new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.95 }),
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
