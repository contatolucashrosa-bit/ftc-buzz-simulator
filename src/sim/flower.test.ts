// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Física da FLOWER (§9.7): o POLLEN desce quando o de baixo é retirado; o NECTAR entra pelo topo e para no anel do meio.
import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import { RAPIER, createWorld, initPhysics, type PhysicsWorld } from "./physics";
import { ElementManager } from "./elements";
import { Flower } from "./flower";
import { FLOWER, FLOWERS } from "./geometry";

const SPEC = FLOWERS.find((f) => f.id === "scoringFlower")!;

function setup(): { physics: PhysicsWorld; elements: ElementManager; flower: Flower } {
  const physics = createWorld(1 / 120);
  const ground = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  physics.world.createCollider(RAPIER.ColliderDesc.cuboid(5, 0.05, 5).setTranslation(0, -0.05, 0), ground);
  const scene = new THREE.Scene();
  const flower = new Flower(SPEC, physics, scene);
  const elements = new ElementManager(physics, scene, 8);
  return { physics, elements, flower };
}

function run(physics: PhysicsWorld, seconds: number): void {
  for (let i = 0; i < seconds * 120; i++) physics.world.step();
}

function heights(elements: ElementManager): number[] {
  return elements.elements.map((e) => elements.position(e).z).sort((a, b) => a - b);
}

describe("FLOWER (física)", () => {
  beforeAll(async () => {
    await initPhysics();
  });

  it("os POLLEN de cima descem quando o de baixo é retirado pelo intake", () => {
    const { physics, elements, flower } = setup();
    for (const p of flower.stagingPositions()) elements.spawn("pollen", p.x, p.y, p.z);
    run(physics, 2);
    const before = heights(elements);
    expect(before[0]).toBeLessThan(1.6);

    // retira os dois de baixo, como o intake faz
    elements.remove(elements.elements.find((e) => elements.position(e).z < 2)!);
    run(physics, 0.02);
    elements.remove(elements.elements.find((e) => elements.position(e).z < 4.5)!);
    run(physics, 2);

    const after = heights(elements);
    expect(after).toHaveLength(2);
    expect(after[0]).toBeCloseTo(1.4, 0); // apoiado no piso, dentro do anel de baixo
    expect(after[1]).toBeLessThan(4.6);
  });

  it("o NECTAR solto sobre o eixo entra pela boca e fica retido no anel do meio", () => {
    const { physics, elements } = setup();
    elements.spawn("redNectar", SPEC.x, SPEC.y, 24.5);
    run(physics, 3);
    const z = elements.position(elements.elements[0]).z;
    expect(z).toBeLessThan(FLOWER.topHeight - 3); // passou pela boca
    expect(z).toBeGreaterThan(FLOWER.scoringBottom); // não passou pelo anel do meio
  });

  it("dois NECTAR seguidos empilham dentro da FLOWER", () => {
    const { physics, elements } = setup();
    elements.spawn("redNectar", SPEC.x, SPEC.y, 24.5);
    run(physics, 1.5);
    elements.spawn("blueNectar", SPEC.x, SPEC.y, 24.5);
    run(physics, 3);
    const [low, high] = heights(elements);
    expect(high - low).toBeGreaterThan(3.3); // um sobre o outro
    expect(high).toBeLessThan(FLOWER.topHeight - 1);
  });
});
