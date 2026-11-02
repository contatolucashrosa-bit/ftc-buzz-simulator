// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
import { describe, expect, it } from "vitest";
import { solveApexLaunch } from "./autonomous";
import { TipLogic } from "../sim/hive";

describe("lançamento até o ápice", () => {
  it("chega à altura e à distância pedidas", () => {
    const { speed, pitchDeg } = solveApexLaunch(36, 44);
    const pitch = (pitchDeg * Math.PI) / 180;
    const vx = speed * Math.cos(pitch);
    const vy = speed * Math.sin(pitch);
    const t = vy / 9.81;
    expect(vx * t).toBeCloseTo(36 * 0.0254, 4);
    expect((vy * vy) / (2 * 9.81)).toBeCloseTo(44 * 0.0254, 4);
  });
});

describe("HIVE biestável (lógica de TIP)", () => {
  it("só vira quando a massa na CELL de cima passa do limiar, e troca o lado", () => {
    const logic = new TipLogic(1, 0.09, 0.5);
    expect(logic.step(0.01, 0.075)).toBe(false);
    expect(logic.tipping).toBe(false);
    logic.step(0.01, 0.09);
    expect(logic.tipping).toBe(true);
    let tipped = false;
    for (let i = 0; i < 60 && !tipped; i++) tipped = logic.step(0.01, 0);
    expect(tipped).toBe(true);
    expect(logic.upSide).toBe(-1);
    expect(logic.angle).toBeCloseTo((-30 * Math.PI) / 180, 6);
  });
});
