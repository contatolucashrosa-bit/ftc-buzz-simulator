// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
import { describe, expect, it } from "vitest";
import { BotBrain, type BotWorld } from "./bot";
import { hiveShot } from "./autonomous";

function world(overrides: Partial<BotWorld> & { at?: { x: number; y: number; heading: number }; hopper?: number } = {}): BotWorld & { aim: number[]; bursts: number } {
  const w = {
    aim: [] as number[],
    bursts: 0,
    pose: () => overrides.at ?? { x: -40, y: -40, heading: 0 },
    hopperCount: () => overrides.hopper ?? 0,
    pickups: () => [{ id: 1, x: -20, y: -40, z: 1.4 }],
    hiveUpSide: () => -1 as const,
    launchExit: () => ({ forward: 6.5, z: 15 }),
    setAim: (speed: number, pitch: number) => w.aim.push(speed, pitch),
    startBurst: () => w.bursts++,
    bursting: () => false,
    others: () => [],
    allies: () => [],
    secondsLeft: () => 100,
    isAuto: () => false,
  };
  return Object.assign(w, overrides);
}

describe("robô-bot", () => {
  it("vai até o POLLEN mais perto com o intake ligado", () => {
    const brain = new BotBrain("red", "hard", () => 0.5);
    const out = brain.update(0.01, world());
    expect(out.intake).toBe(true);
    expect(out.drive.forward).toBeGreaterThan(0); // POLLEN está à frente (+x)
    expect(brain.currentState).toBe("collect");
  });

  it("ignora POLLEN dentro de FLOWER e embaixo da HIVE", () => {
    const brain = new BotBrain("red", "hard", () => 0.5);
    const out = brain.update(0.01, world({ hopper: 1, pickups: () => [{ id: 1, x: -68.5, y: -24, z: 1.4 }, { id: 2, x: 0, y: 0, z: 1.4 }] }));
    // nada alcançável: vai lançar o que tem
    expect(out.intake).toBe(false);
    expect(brain.currentState).toBe("toShoot");
  });

  it("com o depósito cheio, vai até a frente da HIVE, mira e lança", () => {
    const brain = new BotBrain("red", "hard", () => 0.5);
    const shot = hiveShot("red", -1, { forward: 6.5, z: 15 });
    const w = world({ hopper: 4, at: { x: shot.x, y: shot.y, heading: shot.heading } });
    brain.update(0.01, w); // collect → toShoot
    brain.update(0.01, w); // chegou: mira
    expect(brain.currentState).toBe("shoot");
    expect(w.aim[0]).toBeCloseTo(shot.aim.speed, 3); // com rand 0,5 o erro de mira é zero
    for (let i = 0; i < 40; i++) brain.update(0.01, w);
    expect(w.bursts).toBeGreaterThan(0);
  });

  it("espera ao lado quando o parceiro já ocupa o ponto de lançamento", () => {
    const brain = new BotBrain("blue", "hard", () => 0.5);
    const shot = hiveShot("blue", 1, { forward: 6.5, z: 15 });
    const w = world({ hopper: 4, at: { x: shot.x + 30, y: shot.y - 20, heading: 0 }, hiveUpSide: () => 1, allies: () => [{ x: shot.x, y: shot.y }] });
    brain.update(0.01, w);
    brain.update(0.01, w);
    expect(brain.currentState).toBe("toShoot");
    expect(w.bursts).toBe(0);
  });

  it("no AUTO não vai buscar POLLEN no lado adversário (G402)", () => {
    const brain = new BotBrain("blue", "hard", () => 0.5);
    brain.update(0.01, world({ hopper: 1, at: { x: 30, y: 0, heading: Math.PI }, isAuto: () => true, pickups: () => [{ id: 1, x: -20, y: 0, z: 1.4 }] }));
    expect(brain.currentState).toBe("toShoot");
  });

  it("estaciona na LOADING ZONE nos últimos segundos", () => {
    const brain = new BotBrain("blue", "medium", () => 0.5);
    brain.update(0.01, world({ secondsLeft: () => 8, at: { x: 40, y: 40, heading: Math.PI } }));
    expect(brain.currentState).toBe("park");
  });
});
