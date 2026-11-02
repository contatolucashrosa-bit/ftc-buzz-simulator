// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// SCORING ELEMENTS: POLLEN (amarelo, 2.8 pol) e NECTAR (vermelho/azul, 3.6 pol) — §9.8 p.72.
import * as THREE from "three";
import type { Alliance } from "../rules/rules";
import type { FlowerElement } from "../scoring/scoring";
import { ELEMENTS, INCH, toWorld } from "./geometry";
import { COLLISION, RAPIER, interactionGroups, type PhysicsWorld } from "./physics";

export type ElementKind = FlowerElement;

export interface GameElement {
  id: number;
  kind: ElementKind;
  radius: number; // pol
  body: RAPIER.RigidBody;
  mesh: THREE.Mesh;
  /** Aliança do último robô que lançou/colocou este elemento (para G410). */
  lastLaunchedBy: Alliance | null;
  /** Já gerou falta G410 nesta partida. */
  earlyFlowerFoul: boolean;
  /** Momento (s de simulação) em que saiu do campo, ou null. */
  outSince: number | null;
}

export function nectarOf(alliance: Alliance): ElementKind {
  return alliance === "red" ? "redNectar" : "blueNectar";
}

export function allianceOfNectar(kind: ElementKind): Alliance | null {
  return kind === "redNectar" ? "red" : kind === "blueNectar" ? "blue" : null;
}

export const ELEMENT_COLORS: Record<ElementKind, number> = {
  pollen: 0xf7e326, // amarelo BIOBUZZ (FIRST CANOPY Brand Guide p.15)
  redNectar: 0xed1c24, // vermelho FIRST
  blueNectar: 0x0066b3, // azul FIRST
};

/** Cria e remove elementos; mantém a lista viva para a pontuação. */
export class ElementManager {
  readonly elements: GameElement[] = [];
  private nextId = 1;
  private readonly geometries: Record<"pollen" | "nectar", THREE.SphereGeometry>;
  private readonly materials: Record<ElementKind, THREE.MeshStandardMaterial>;

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly scene: THREE.Scene,
    segments: number,
  ) {
    this.geometries = {
      pollen: new THREE.SphereGeometry(ELEMENTS.pollenRadius * INCH, segments, Math.max(6, segments / 2)),
      nectar: new THREE.SphereGeometry(ELEMENTS.nectarRadius * INCH, segments, Math.max(6, segments / 2)),
    };
    this.materials = {
      pollen: new THREE.MeshStandardMaterial({ color: ELEMENT_COLORS.pollen, roughness: 0.55 }),
      redNectar: new THREE.MeshStandardMaterial({ color: ELEMENT_COLORS.redNectar, roughness: 0.5 }),
      blueNectar: new THREE.MeshStandardMaterial({ color: ELEMENT_COLORS.blueNectar, roughness: 0.5 }),
    };
  }

  /** Cria um elemento na posição do manual (pol), com velocidade inicial opcional (m/s, mundo). */
  spawn(kind: ElementKind, x: number, y: number, z: number, velocity?: THREE.Vector3): GameElement {
    const radius = kind === "pollen" ? ELEMENTS.pollenRadius : ELEMENTS.nectarRadius;
    const mass = kind === "pollen" ? ELEMENTS.pollenMassKg : ELEMENTS.nectarMassKg;
    const p = toWorld(x, y, z);
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(p.x, p.y, p.z)
      .setCcdEnabled(true)
      .setLinearDamping(0.15)
      .setAngularDamping(0.6);
    const body = this.physics.world.createRigidBody(desc);
    const group = kind === "pollen" ? COLLISION.pollen : COLLISION.nectar;
    this.physics.world.createCollider(
      RAPIER.ColliderDesc.ball(radius * INCH)
        .setMass(mass)
        .setRestitution(0.35)
        .setFriction(0.7)
        .setCollisionGroups(interactionGroups(group, COLLISION.all)),
      body,
    );
    if (velocity) body.setLinvel(velocity, true);

    const mesh = new THREE.Mesh(this.geometries[kind === "pollen" ? "pollen" : "nectar"], this.materials[kind]);
    mesh.castShadow = true;
    this.scene.add(mesh);

    const element: GameElement = {
      id: this.nextId++,
      kind,
      radius,
      body,
      mesh,
      lastLaunchedBy: null,
      earlyFlowerFoul: false,
      outSince: null,
    };
    this.elements.push(element);
    this.syncOne(element);
    return element;
  }

  remove(element: GameElement): void {
    const i = this.elements.indexOf(element);
    if (i >= 0) this.elements.splice(i, 1);
    const removedAt = element.body.translation();
    this.physics.world.removeRigidBody(element.body);
    this.scene.remove(element.mesh);
    // O Rapier "adormece" corpos parados e remover um vizinho não os acorda: sem isso, os POLLEN
    // de cima ficariam flutuando na FLOWER quando o de baixo é retirado pelo intake.
    const wakeRadius = 0.6; // m, cobre uma pilha inteira de FLOWER
    for (const other of this.elements) {
      const p = other.body.translation();
      if ((p.x - removedAt.x) ** 2 + (p.y - removedAt.y) ** 2 + (p.z - removedAt.z) ** 2 < wakeRadius ** 2) other.body.wakeUp();
    }
  }

  /** Posição atual no sistema do manual (pol). */
  position(element: GameElement): { x: number; y: number; z: number } {
    const t = element.body.translation();
    return { x: t.x / INCH, y: -t.z / INCH, z: t.y / INCH };
  }

  sync(): void {
    for (const e of this.elements) this.syncOne(e);
  }

  private syncOne(e: GameElement): void {
    const t = e.body.translation();
    const r = e.body.rotation();
    e.mesh.position.set(t.x, t.y, t.z);
    e.mesh.quaternion.set(r.x, r.y, r.z, r.w);
  }

  dispose(): void {
    for (const e of [...this.elements]) this.remove(e);
    Object.values(this.geometries).forEach((g) => g.dispose());
    Object.values(this.materials).forEach((m) => m.dispose());
  }
}
