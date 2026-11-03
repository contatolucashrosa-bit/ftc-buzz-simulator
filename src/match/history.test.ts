// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
import { describe, expect, it } from "vitest";
import { previousBest, rankTeams, type MatchRecord } from "./history";

const match = (team: string, total: number, rankingPoints: number, result: MatchRecord["result"] = "win"): MatchRecord => ({
  id: `${team}-${total}-${rankingPoints}-${Math.random()}`,
  playedAt: 0,
  team,
  eventName: "Treino",
  robot: "generic",
  autoProgram: "leavePark",
  total,
  autoPoints: 0,
  teleopPoints: total,
  foulPointsReceived: 0,
  hiveTips: 0,
  flowersOwned: 0,
  rankingPoints,
  result,
  rp: { swarm: false, pollinator1: false, pollinator2: false },
});

describe("ranking de qualificação local", () => {
  it("ordena pela média de RP (Ranking Score)", () => {
    const rows = rankTeams([match("100", 50, 3), match("100", 40, 4), match("200", 90, 3)]);
    expect(rows.map((r) => r.team)).toEqual(["100", "200"]);
    expect(rows[0].rankingScore).toBe(3.5);
    expect(rows[0].matches).toBe(2);
    expect(rows[0].rank).toBe(1);
  });

  it("desempata pela média de pontos e depois pela maior pontuação", () => {
    const rows = rankTeams([match("A", 60, 3), match("B", 80, 3), match("C", 80, 3), match("C", 80, 3), match("B", 70, 3), match("B", 90, 3)]);
    // B: média 80, máx 90; C: média 80, máx 80; A: média 60
    expect(rows.map((r) => r.team)).toEqual(["B", "C", "A"]);
  });

  it("conta vitórias, derrotas e empates", () => {
    const [row] = rankTeams([match("1", 10, 3, "win"), match("1", 5, 0, "loss"), match("1", 7, 1, "tie")]);
    expect([row.wins, row.losses, row.ties]).toEqual([1, 1, 1]);
  });

  it("recorde anterior ignora a própria partida", () => {
    const a = match("1", 50, 3);
    const b = match("1", 70, 3);
    expect(previousBest([a, b], "1", b.id)).toBe(50);
    expect(previousBest([a], "2")).toBeNull();
  });
});
