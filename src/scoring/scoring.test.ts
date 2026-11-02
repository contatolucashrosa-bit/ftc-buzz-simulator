// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Um teste por linha da Tabela 10-2 (p.89) + RP (Tabela 10-3) + faltas (Tabela 10-4).
import { describe, expect, it } from "vitest";
import { computeScore, emptySnapshot, evaluateFlower } from "./scoring";

describe("Tabela 10-2: pontos de AUTO", () => {
  it("LEAVE vale 3 por robô", () => {
    const s = emptySnapshot();
    s.red.autoLeave = [true, true];
    expect(computeScore(s).red.autoLeavePoints).toBe(6);
  });

  it("PARK no AUTO vale 5 por robô", () => {
    const s = emptySnapshot();
    s.red.autoPark = [true, false];
    expect(computeScore(s).red.autoParkPoints).toBe(5);
  });

  it("HIVE TIP no AUTO vale 20", () => {
    const s = emptySnapshot();
    s.blue.autoHiveTips = 2;
    expect(computeScore(s).blue.autoPoints).toBe(40);
  });
});

describe("Tabela 10-2: pontos de TELEOP", () => {
  it("HIVE TIP no TELEOP vale 20", () => {
    const s = emptySnapshot();
    s.red.teleopHiveTips = 3;
    expect(computeScore(s).red.teleopHivePoints).toBe(60);
  });

  it("elemento na CELL vale 2", () => {
    const s = emptySnapshot();
    s.red.cellElements = 5;
    expect(computeScore(s).red.teleopCellPoints).toBe(10);
  });

  it("elemento no GARDEN vale 1", () => {
    const s = emptySnapshot();
    s.blue.gardenElements = 7;
    expect(computeScore(s).blue.teleopGardenPoints).toBe(7);
  });

  it("PARK no fim vale 5 por robô", () => {
    const s = emptySnapshot();
    s.blue.teleopPark = [true, true];
    expect(computeScore(s).blue.teleopParkPoints).toBe(10);
  });
});

describe("FLOWER (§10.5.2, Fig. 10-5)", () => {
  it("dona = NECTAR mais alto; bônus = NECTAR mais baixo, ignorando POLLEN", () => {
    expect(evaluateFlower(["pollen", "blueNectar", "pollen", "redNectar", "pollen"])).toEqual({
      owner: "red",
      bottomNectar: "blue",
      elements: 5,
    });
  });

  it("FLOWER só com POLLEN não tem dona", () => {
    expect(evaluateFlower(["pollen", "pollen"]).owner).toBeNull();
  });

  it("dona recebe 2 × todos os elementos e o bônus de 5 é por FLOWER", () => {
    const s = emptySnapshot();
    s.flowers.audienceFlower = ["redNectar", "pollen", "pollen", "redNectar"];
    s.flowers.scoringFlower = ["redNectar", "blueNectar"];
    const score = computeScore(s);
    // audiência: dona vermelha (4 × 2 = 8) + bônus vermelho (5); scoring: bônus vermelho (5), dona azul (2 × 2 = 4)
    expect(score.red.teleopFlowerPoints).toBe(8 + 5 + 5);
    expect(score.blue.teleopFlowerPoints).toBe(4);
    expect(score.red.flowersOwned).toBe(1);
  });
});

describe("Tabela 10-3: RANKING POINTS", () => {
  it("SWARM exige 16 pontos de LEAVE + PARK", () => {
    const s = emptySnapshot();
    s.red.autoLeave = [true, true]; // 6
    s.red.teleopPark = [true, true]; // 10
    expect(computeScore(s).red.swarm).toEqual({ progress: 16, threshold: 16, achieved: true });
  });

  it("POLLINATOR 1 com 4 TIPs e POLLINATOR 2 com 7 TIPs", () => {
    const s = emptySnapshot();
    s.blue.autoHiveTips = 1;
    s.blue.teleopHiveTips = 5;
    const blue = computeScore(s).blue;
    expect(blue.pollinator1.achieved).toBe(true);
    expect(blue.pollinator2.achieved).toBe(false);
  });

  it("vitória vale 3 RP e empate 1 RP", () => {
    const win = emptySnapshot();
    win.red.gardenElements = 1;
    const score = computeScore(win);
    expect(score.red.result).toBe("win");
    expect(score.red.rankingPoints).toBe(3);
    expect(score.blue.rankingPoints).toBe(0);

    const tie = computeScore(emptySnapshot());
    expect(tie.red.rankingPoints).toBe(1);
    expect(tie.blue.rankingPoints).toBe(1);
  });
});

describe("Tabela 10-4: faltas", () => {
  it("MINOR = 5 e MAJOR = 20 creditados à adversária", () => {
    const s = emptySnapshot();
    s.red.minorFouls = 1;
    s.red.majorFouls = 2;
    const score = computeScore(s);
    expect(score.blue.total).toBe(45);
    expect(score.blue.foulPointsReceived).toBe(45);
    expect(score.red.total).toBe(0);
  });
});
