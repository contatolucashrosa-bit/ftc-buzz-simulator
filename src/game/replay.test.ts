// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { REPLAY_SECONDS, ReplayPlayer, ReplayRecorder } from "./replay";

function scene() {
  const robot = new THREE.Object3D();
  const ball = new THREE.Mesh();
  const elements = [{ id: 7, kind: "pollen" as const, mesh: ball }];
  return { robot, ball, elements };
}

describe("replay", () => {
  it("guarda só os últimos segundos, a 30 quadros por segundo", () => {
    const rec = new ReplayRecorder();
    const s = scene();
    for (let i = 0; i < 60 * 45; i++) rec.capture(1 / 60, { clockText: "1:00", scores: { red: 0, blue: 0 }, robot: s.robot, hiveAngles: { red: 0, blue: 0 }, elements: s.elements });
    const clip = rec.clip();
    expect(clip[0].t).toBe(0);
    expect(clip[clip.length - 1].t).toBeLessThanOrEqual(REPLAY_SECONDS);
    expect(clip[clip.length - 1].t).toBeGreaterThan(REPLAY_SECONDS - 0.2);
    expect(clip.length).toBeGreaterThan(REPLAY_SECONDS * 29);
  });

  it("reproduz as poses gravadas com interpolação e devolve a cena ao sair", () => {
    const rec = new ReplayRecorder();
    const s = scene();
    for (let i = 0; i <= 60; i++) {
      s.robot.position.set(i / 60, 0, 0);
      s.ball.position.set(0, i / 60, 0);
      rec.capture(1 / 60, { clockText: "0:10", scores: { red: i, blue: 0 }, robot: s.robot, hiveAngles: { red: 0, blue: 0 }, elements: s.elements });
    }
    const target = new THREE.Object3D();
    const added: THREE.Object3D[] = [];
    let live = true;
    const player = new ReplayPlayer(rec.clip(), {
      scene: { add: (o: THREE.Object3D) => added.push(o), remove: () => undefined } as unknown as THREE.Scene,
      robot: target,
      setHiveAngles: () => undefined,
      meshFor: () => new THREE.Mesh(),
      setLiveElementsVisible: (v) => (live = v),
    });
    expect(live).toBe(false);
    player.seek(0.5);
    expect(target.position.x).toBeCloseTo(0.5, 1);
    expect(added).toHaveLength(1);
    expect(added[0].position.y).toBeCloseTo(0.5, 1);
    player.playing = true;
    player.update(10);
    expect(player.playing).toBe(false);
    expect(target.position.x).toBeCloseTo(1, 1);
    player.dispose();
    expect(live).toBe(true);
  });
});
