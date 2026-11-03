// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// HIVE: gangorra biestável com 2 CELLS (§9.6 p.67–69; TIP §10.5.1 p.85).
// A HIVE é um corpo cinemático: só vira por peso na CELL de cima (G417 proíbe outras formas),
// então robôs não conseguem empurrá-la. O limiar de massa é suposição (o manual não informa).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Alliance } from "../rules/rules";
import { ELEMENTS, HIVE, HIVE_INITIAL_UP_SIDE, INCH, toWorld } from "./geometry";
import type { ElementManager, GameElement } from "./elements";
import { RAPIER, quatAboutX, type PhysicsWorld } from "./physics";

export type CellSide = 1 | -1;

/** Lógica pura da virada, separada para teste. */
export class TipLogic {
  upSide: CellSide;
  tipping = false;
  private progress = 0;

  constructor(
    initialUpSide: CellSide,
    private readonly thresholdKg = HIVE.tipThresholdKg,
    private readonly durationS = HIVE.tipDurationS,
  ) {
    this.upSide = initialUpSide;
  }

  /** Ângulo atual (rad). +30° = ponta +y levantada. */
  get angle(): number {
    const tilt = (HIVE.tiltDeg * Math.PI) / 180;
    const from = this.upSide * tilt;
    if (!this.tipping) return from;
    // Aceleração parecida com queda livre: começa devagar e termina rápido no amortecedor.
    return from + (-2 * from) * this.progress * this.progress;
  }

  /**
   * Avança a simulação. Devolve true no instante em que o TIP se completa
   * (o amortecedor do outro lado encosta na estrutura).
   */
  step(dt: number, massInUpCellKg: number): boolean {
    if (!this.tipping) {
      if (massInUpCellKg >= this.thresholdKg - 1e-9) {
        this.tipping = true;
        this.progress = 0;
      }
      return false;
    }
    this.progress += dt / this.durationS;
    if (this.progress >= 1) {
      this.tipping = false;
      this.progress = 0;
      this.upSide = (this.upSide === 1 ? -1 : 1) as CellSide;
      return true;
    }
    return false;
  }
}

interface LocalBox {
  // centro e meia-dimensão em pol, no referencial local da HIVE (x, y ao longo da barra, z para cima)
  cx: number;
  cy: number;
  cz: number;
  hx: number;
  hy: number;
  hz: number;
  /** Rotação em torno do eixo y local (para as placas do "telhado"). */
  rotY?: number;
}

function cellBoxes(side: CellSide): LocalBox[] {
  const t = 0.125; // meia-espessura das placas
  const yIn = HIVE.cellInnerY;
  const yOut = yIn + HIVE.cellDepth;
  const yc = side * (yIn + yOut) / 2;
  const hy = HIVE.cellDepth / 2;
  const bottom = HIVE.cellBottomZ;
  const wallTop = bottom + HIVE.cellWallHeight;
  const peak = bottom + HIVE.cellPeakHeight;
  const halfW = HIVE.cellWidth / 2;
  const roofRise = peak - wallTop;
  const roofLen = Math.hypot(halfW, roofRise);
  const roofAngle = Math.atan2(roofRise, halfW);
  return [
    { cx: 0, cy: yc, cz: bottom - t, hx: halfW, hy, hz: t }, // fundo (com as AprilTags por baixo)
    { cx: -halfW - t, cy: yc, cz: bottom + HIVE.cellWallHeight / 2, hx: t, hy, hz: HIVE.cellWallHeight / 2 },
    { cx: halfW + t, cy: yc, cz: bottom + HIVE.cellWallHeight / 2, hx: t, hy, hz: HIVE.cellWallHeight / 2 },
    { cx: -halfW / 2, cy: yc, cz: wallTop + roofRise / 2 + t, hx: roofLen / 2, hy, hz: t, rotY: roofAngle },
    { cx: halfW / 2, cy: yc, cz: wallTop + roofRise / 2 + t, hx: roofLen / 2, hy, hz: t, rotY: -roofAngle },
    // parede do fundo (lado do pivô); a ponta de fora é a abertura
    { cx: 0, cy: side * (yIn - t), cz: bottom + HIVE.cellPeakHeight / 2, hx: halfW, hy: t, hz: HIVE.cellPeakHeight / 2 },
  ];
}

export interface HiveTipEvent {
  alliance: Alliance;
  simTime: number;
}

export class Hive {
  readonly logic: TipLogic;
  readonly group = new THREE.Group();
  private readonly body: RAPIER.RigidBody;
  private readonly pivot: THREE.Vector3;
  private readonly inverse = new THREE.Quaternion();

  constructor(
    readonly alliance: Alliance,
    physics: PhysicsWorld,
    scene: THREE.Scene,
    color: number,
  ) {
    this.logic = new TipLogic(HIVE_INITIAL_UP_SIDE[alliance]);
    const x = HIVE.centerX[alliance];
    this.pivot = toWorld(x, 0, HIVE.pivotHeight);

    this.body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(this.pivot.x, this.pivot.y, this.pivot.z)
        .setRotation(quatAboutX(this.logic.angle)),
    );

    // como no vídeo da temporada: painéis de policarbonato transparente e molduras de perfil na cor da aliança
    const panel = new THREE.MeshStandardMaterial({ color: 0xe6edf2, transparent: true, opacity: 0.22, roughness: 0.15, side: THREE.DoubleSide, depthWrite: false });
    const frameMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.25 });
    const frameParts: THREE.BufferGeometry[] = [];
    const boxes: LocalBox[] = [...cellBoxes(1), ...cellBoxes(-1)];
    // barra que liga as CELLS
    boxes.push({ cx: 0, cy: 0, cz: HIVE.cellBottomZ - 1.2, hx: 1, hy: HIVE.cellInnerY + 0.5, hz: 1 });

    for (const b of boxes) {
      const rotation = b.rotY ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), b.rotY) : new THREE.Quaternion();
      // local manual (x, y, z) → local mundo (x, z, -y)
      const desc = RAPIER.ColliderDesc.cuboid(b.hx * INCH, b.hz * INCH, b.hy * INCH)
        .setTranslation(b.cx * INCH, b.cz * INCH, -b.cy * INCH)
        .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w })
        .setFriction(0.5)
        .setRestitution(0.1);
      physics.world.createCollider(desc, this.body);

      const isBar = b.hx === 1 && b.hz === 1;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.hx * 2 * INCH, b.hz * 2 * INCH, b.hy * 2 * INCH), isBar ? frameMat : panel);
      mesh.position.set(b.cx * INCH, b.cz * INCH, -b.cy * INCH);
      mesh.quaternion.copy(rotation);
      this.group.add(mesh);
      if (!isBar) {
        // cada aresta da placa vira um perfil quadrado de 0,9 pol (todas juntas numa malha só)
        mesh.updateMatrix();
        const edges = new THREE.EdgesGeometry(mesh.geometry).applyMatrix4(mesh.matrix).attributes.position;
        for (let i = 0; i < edges.count; i += 2) {
          const a = new THREE.Vector3().fromBufferAttribute(edges, i);
          const b = new THREE.Vector3().fromBufferAttribute(edges, i + 1);
          const length = a.distanceTo(b);
          if (length < 0.6 * INCH) continue; // arestas da espessura da placa
          const strut = new THREE.BoxGeometry(0.9 * INCH, length + 0.9 * INCH, 0.9 * INCH);
          strut.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
          strut.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
          frameParts.push(strut);
        }
      }
    }
    const frame = new THREE.Mesh(mergeGeometries(frameParts)!, frameMat);
    frame.castShadow = true;
    this.group.add(frame);
    this.group.position.copy(this.pivot);
    scene.add(this.group);
    this.syncVisual();
  }

  /** Posição de um ponto local da HIVE (pol) no sistema do manual, já considerando a inclinação atual. */
  localToField(lx: number, ly: number, lz: number): { x: number; y: number; z: number } {
    const a = this.logic.angle;
    const y = ly * Math.cos(a) - lz * Math.sin(a);
    const z = ly * Math.sin(a) + lz * Math.cos(a);
    return { x: HIVE.centerX[this.alliance] + lx, y, z: HIVE.pivotHeight + z };
  }

  /** O elemento está dentro da CELL do lado indicado? */
  isInCell(e: GameElement, side: CellSide): boolean {
    const t = e.body.translation();
    const q = quatAboutX(-this.logic.angle);
    this.inverse.set(q.x, q.y, q.z, q.w);
    const local = new THREE.Vector3(t.x, t.y, t.z).sub(this.pivot).applyQuaternion(this.inverse);
    const lx = local.x / INCH;
    const ly = -local.z / INCH;
    const lz = local.y / INCH;
    const yIn = HIVE.cellInnerY;
    return (
      Math.abs(lx) <= HIVE.cellWidth / 2 &&
      side * ly >= yIn &&
      side * ly <= yIn + HIVE.cellDepth &&
      lz >= HIVE.cellBottomZ - 0.5 &&
      lz <= HIVE.cellBottomZ + HIVE.cellPeakHeight
    );
  }

  elementsInUpCell(elements: ElementManager): GameElement[] {
    return elements.elements.filter((e) => this.isInCell(e, this.logic.upSide));
  }

  /** Um passo de física. Devolve true quando um TIP se completa. */
  step(dt: number, elements: ElementManager): boolean {
    const mass = this.elementsInUpCell(elements).reduce(
      (sum, e) => sum + (e.kind === "pollen" ? ELEMENTS.pollenMassKg : ELEMENTS.nectarMassKg),
      0,
    );
    const tipped = this.logic.step(dt, mass);
    this.body.setNextKinematicRotation(quatAboutX(this.logic.angle));
    return tipped;
  }

  syncVisual(angle = this.logic.angle): void {
    const q = quatAboutX(angle);
    this.group.quaternion.set(q.x, q.y, q.z, q.w);
  }
}
