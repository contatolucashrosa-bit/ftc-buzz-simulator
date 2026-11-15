// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// FLOWER (§9.7 p.70): tubo vertical preso à parede. Elementos entram pelo topo; POLLEN sai por baixo.
// O anel do meio deixa passar POLLEN e segura NECTAR (suposição de diâmetro, ver geometry.ts).
import * as THREE from "three";
import type { FlowerElement } from "../scoring/scoring";
import { FLOWER, INCH, toWorld, type FlowerSpec } from "./geometry";
import type { ElementManager, GameElement } from "./elements";
import { COLLISION, RAPIER, interactionGroups, type PhysicsWorld } from "./physics";

const CAGE_RADIUS = FLOWER.topOpeningRadius + FLOWER.pipeRadius; // eixo dos canos

export class Flower {
  private readonly group = new THREE.Group();

  constructor(
    readonly spec: FlowerSpec,
    physics: PhysicsWorld,
    scene: THREE.Scene,
  ) {
    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    // cores da FLOWER no vídeo da temporada: canos verdes, anel do topo amarelo, batente roxo e base preta
    const pipeMaterial = new THREE.MeshStandardMaterial({ color: 0x3fae3a, roughness: 0.45 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x26272b, roughness: 0.55, metalness: 0.2 });
    const topMaterial = new THREE.MeshStandardMaterial({ color: 0xf2c31b, roughness: 0.45 });
    const backstopMaterial = new THREE.MeshStandardMaterial({ color: 0x8a3fc4, roughness: 0.5 });
    const group = this.group;
    const base = toWorld(spec.x, spec.y, 0);
    group.position.copy(base);
    scene.add(group);

    // Peças sem atrito e regra "mínimo": com a regra padrão (média), o atrito da bola (0,7) a fazia "grudar"
    // nos contatos preditivos dos canos e anéis, parada no ar dentro da FLOWER.
    const addBox = (lx: number, ly: number, lz: number, hx: number, hy: number, hz: number, yaw: number, mat: THREE.Material, friction = 0, groups?: number) => {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const p = toWorld(spec.x + lx, spec.y + ly, lz);
      physics.world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx * INCH, hz * INCH, hy * INCH)
          .setTranslation(p.x, p.y, p.z)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
          .setFriction(friction)
          .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
          .setRestitution(0.1)
          .setCollisionGroups(groups ?? interactionGroups(COLLISION.all, COLLISION.all)),
        body,
      );
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 * INCH, hz * 2 * INCH, hy * 2 * INCH), mat);
      mesh.position.copy(p).sub(base);
      mesh.quaternion.copy(q);
      group.add(mesh);
    };

    // Anel aproximado por segmentos retos tangentes (colisor) + um toro (visual).
    const addRing = (innerRadius: number, width: number, zBottom: number, thickness: number, ringMaterial: THREE.Material, groups?: number) => {
      const segments = 12;
      const mid = innerRadius + width / 2;
      const half = ((Math.PI * 2 * mid) / segments) * 0.55;
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        // yaw em torno do Y do mundo: a tangente do segmento é perpendicular ao raio
        addBox(dx * mid, dy * mid, zBottom + thickness / 2, half, width / 2, thickness / 2, a + Math.PI / 2, ringMaterial, 0, groups);
      }
    };

    // anel de baixo (no piso): o POLLEN fica dentro dele
    addRing(FLOWER.lowerRingHoleRadius + 0.08, 0.8, 0, FLOWER.lowerRingHeight, darkMaterial);
    // anel do meio: segura só NECTAR. O POLLEN passa pelo furo; com grupos de colisão a passagem não depende
    // de milímetros de folga (o contato preditivo do Rapier chegava a segurar o POLLEN no ar).
    const middleBottom = FLOWER.lowerRingHeight + FLOWER.retrievalHeight;
    addRing(FLOWER.middleRingHoleRadius, 1.0, middleBottom, FLOWER.middleRingThickness, darkMaterial, interactionGroups(COLLISION.all, COLLISION.nectar));
    // anel do topo
    addRing(FLOWER.topOpeningRadius, 0.8, FLOWER.topHeight - 0.4, 0.4, topMaterial);

    // 4 canos (HIPS) entre o anel do meio e o do topo
    const pipeBottom = middleBottom + FLOWER.middleRingThickness;
    const pipeHalf = (FLOWER.topHeight - pipeBottom) / 2;
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const p = toWorld(spec.x + Math.cos(a) * CAGE_RADIUS, spec.y + Math.sin(a) * CAGE_RADIUS, pipeBottom + pipeHalf);
      physics.world.createCollider(
        RAPIER.ColliderDesc.cylinder(pipeHalf * INCH, FLOWER.pipeRadius * INCH)
          .setTranslation(p.x, p.y, p.z)
          .setFriction(0)
          .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min),
        body,
      );
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(FLOWER.pipeRadius * INCH, FLOWER.pipeRadius * INCH, pipeHalf * 2 * INCH, 12), pipeMaterial);
      pipe.castShadow = true;
      pipe.position.copy(p).sub(base);
      group.add(pipe);
    }

    // perfil quadrado do lado da parede (liga o anel de baixo ao do meio) e o batente do topo
    const wx = -spec.inward.x;
    const wy = -spec.inward.y;
    const wallYaw = Math.atan2(wy, wx);
    addBox(wx * (CAGE_RADIUS + 0.6), wy * (CAGE_RADIUS + 0.6), pipeBottom / 2, 0.5, 0.5, pipeBottom / 2, wallYaw, darkMaterial);
    addBox(
      wx * (FLOWER.topOpeningRadius + 0.3),
      wy * (FLOWER.topOpeningRadius + 0.3),
      FLOWER.topHeight + FLOWER.backstopHeight / 2,
      0.15,
      FLOWER.topOpeningRadius,
      FLOWER.backstopHeight / 2,
      wallYaw,
      backstopMaterial,
    );
  }

  /** Troca as peças geradas no código pelo modelo detalhado (origem no piso, no eixo; parede em +y do modelo). */
  setModel(model: THREE.Object3D): void {
    // gira o modelo até o lado da parede apontar para fora do campo
    model.rotation.y = Math.atan2(-this.spec.inward.y, -this.spec.inward.x) - Math.PI / 2;
    this.group.clear();
    this.group.add(model);
  }

  /** Elemento ao menos parcialmente no volume de pontuação (§10.5.2): entre o anel do meio e o do topo. */
  isInScoringVolume(elements: ElementManager, e: GameElement): boolean {
    const p = elements.position(e);
    const horizontal = Math.hypot(p.x - this.spec.x, p.y - this.spec.y);
    return horizontal <= FLOWER.topOpeningRadius + 0.3 && p.z + e.radius > FLOWER.scoringBottom && p.z - e.radius < FLOWER.topHeight;
  }

  /** Pilha de baixo para cima, como a calculadora oficial espera. */
  stack(elements: ElementManager): { stack: FlowerElement[]; members: GameElement[] } {
    const members = elements.elements
      .filter((e) => this.isInScoringVolume(elements, e))
      .sort((a, b) => elements.position(a).z - elements.position(b).z);
    return { stack: members.map((e) => e.kind), members };
  }

  /** Ponto de largada dos 4 POLLEN iniciais (§10.3.1 p.81). */
  stagingPositions(): Array<{ x: number; y: number; z: number }> {
    return [0, 1, 2, 3].map((i) => ({ x: this.spec.x, y: this.spec.y, z: 1.45 + i * 2.85 }));
  }
}
