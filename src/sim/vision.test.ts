// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
import { describe, expect, it } from "vitest";
import { cameraFrame, DEFAULT_MOUNT, detectTags, hiveTags } from "./vision";
import { HIVE } from "./geometry";

const tilt = (HIVE.tiltDeg * Math.PI) / 180;

describe("AprilTags simuladas", () => {
  it("16 tags, 4 por CELL, com os IDs do manual", () => {
    const ids = [...hiveTags("red", -tilt), ...hiveTags("blue", tilt)].map((t) => t.id).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 16 }, (_, i) => 30 + i));
  });

  it("a CELL de cima fica mais alta e as tags dela apontam para baixo e para fora", () => {
    const tags = hiveTags("red", -tilt); // HIVE vermelha começa com a CELL da plateia (-y) em cima
    const audience = tags.find((t) => t.id === 34)!;
    const rear = tags.find((t) => t.id === 30)!;
    expect(audience.center.z).toBeGreaterThan(rear.center.z);
    expect(audience.normal.z).toBeLessThan(-0.8);
    expect(audience.normal.y).toBeLessThan(0);
  });

  it("câmera com pitch -90 olha para a frente do robô", () => {
    const cam = cameraFrame({ x: 0, y: 0, heading: Math.PI / 2 }, { x: 0, y: 0, z: 8, yaw: 0, pitch: -90, roll: 0 });
    expect(cam.forward.y).toBeCloseTo(1, 6);
    expect(cam.up.z).toBeCloseTo(1, 6);
    expect(cam.right.x).toBeCloseTo(1, 6);
  });

  it("vê as tags da CELL de cima de frente para a HIVE, com distância e direção coerentes", () => {
    const robot = { x: HIVE.centerX.red, y: -80, heading: Math.PI / 2 };
    const seen = detectTags(robot, hiveTags("red", -tilt));
    // as 4 mais próximas são as da CELL de cima; as da CELL de baixo aparecem mais longe, por baixo da barra
    const near = seen.slice(0, 4);
    expect(near.map((d) => d.id).sort()).toEqual([34, 35, 36, 37]);
    for (const d of near) {
      expect(d.y).toBeGreaterThan(0);
      expect(d.range).toBeGreaterThan(60);
      expect(d.range).toBeLessThan(90);
      expect(Math.abs(d.bearing)).toBeLessThan(10);
    }
    // a tag à direita do robô (x maior) aparece à direita na imagem e com bearing negativo
    const right = seen.find((d) => d.id === 37)!;
    const left = seen.find((d) => d.id === 34)!;
    expect(right.centerPx.x).toBeGreaterThan(left.centerPx.x);
    expect(right.bearing).toBeLessThan(left.bearing);
  });

  it("não vê nada de costas para a HIVE nem longe demais", () => {
    expect(detectTags({ x: HIVE.centerX.red, y: -80, heading: -Math.PI / 2 }, hiveTags("red", -tilt))).toEqual([]);
    expect(detectTags({ x: HIVE.centerX.red, y: -70, heading: Math.PI / 2 }, hiveTags("red", -tilt), { ...DEFAULT_MOUNT, pitch: -90 }).length).toBe(0);
  });
});
