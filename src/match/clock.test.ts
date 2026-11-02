// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
import { describe, expect, it } from "vitest";
import { clockAt, formatClock, matchDuration, nectarAllowance } from "./clock";

describe("relógio da partida (§10.4, Tabela 9-1)", () => {
  it("dura 30 + 8 + 120 = 158 s", () => {
    expect(matchDuration()).toBe(158);
  });

  it("AUTO começa em 2:30 e só o programa controla o robô", () => {
    const c = clockAt(0);
    expect(c.phase).toBe("auto");
    expect(formatClock(c.displaySeconds)).toBe("2:30");
    expect(c.driverControl).toBe(false);
    expect(c.robotsEnabled).toBe(true);
  });

  it("transição conta 0:08 e os robôs ficam parados (G403)", () => {
    const c = clockAt(30);
    expect(c.phase).toBe("transition");
    expect(formatClock(c.displaySeconds)).toBe("0:08");
    expect(c.robotsEnabled).toBe(false);
  });

  it("TELEOP começa em 2:00", () => {
    const c = clockAt(38);
    expect(c.phase).toBe("teleop");
    expect(formatClock(c.displaySeconds)).toBe("2:00");
    expect(c.flowerUnlocked).toBe(false);
  });

  it("FLOWERS liberadas com 1:00 restante (G410)", () => {
    expect(clockAt(38 + 59.9).flowerUnlocked).toBe(false);
    expect(clockAt(38 + 60).flowerUnlocked).toBe(true);
  });

  it("depois de 0:00 os robôs param (G404)", () => {
    const c = clockAt(158);
    expect(c.phase).toBe("post");
    expect(c.robotsEnabled).toBe(false);
  });
});

describe("NECTAR do HUMAN PLAYER (G426)", () => {
  it("1 NECTAR por TIP da própria HIVE", () => {
    expect(nectarAllowance({ inAllianceArea: 5, alreadyIntroducedFromStaging: 0, ownHiveTips: 2, matchSecondsRemaining: 100, phase: "teleop" })).toBe(2);
    expect(nectarAllowance({ inAllianceArea: 5, alreadyIntroducedFromStaging: 2, ownHiveTips: 2, matchSecondsRemaining: 100, phase: "teleop" })).toBe(0);
  });

  it("todo o NECTAR restante com 60 s ou menos", () => {
    expect(nectarAllowance({ inAllianceArea: 4, alreadyIntroducedFromStaging: 1, ownHiveTips: 1, matchSecondsRemaining: 60, phase: "teleop" })).toBe(4);
  });

  it("nada antes do início da partida", () => {
    expect(nectarAllowance({ inAllianceArea: 5, alreadyIntroducedFromStaging: 0, ownHiveTips: 3, matchSecondsRemaining: 150, phase: "pre" })).toBe(0);
  });
});
