// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Ponte tipada entre o arquivo de regras (data/rules/*.json) e o motor do jogo.
import rawRules from "../../data/rules/biobuzz-tu07.json";

export type Alliance = "red" | "blue";
export const ALLIANCES: readonly Alliance[] = ["red", "blue"];

export function opponentOf(alliance: Alliance): Alliance {
  return alliance === "red" ? "blue" : "red";
}

export interface ScoringItem {
  id: string;
  auto: number | null;
  teleop: number | null;
}

export interface RankingPointRule {
  id: string;
  rp: number;
  threshold?: number;
}

export interface MatchPeriod {
  id: "auto" | "transition" | "teleop";
  duration: number;
}

/** Valores que o motor realmente usa, extraídos do JSON e validados na carga. */
export interface GameRules {
  manualVersion: string;
  points: {
    leave: number;
    autoPark: number;
    teleopPark: number;
    autoHiveTip: number;
    teleopHiveTip: number;
    cellElement: number;
    bottomNectarBonus: number;
    ownedFlowerElement: number;
    garden: number;
  };
  fouls: { minor: number; major: number };
  rp: { swarmThreshold: number; pollinator1Threshold: number; pollinator2Threshold: number; win: number; tie: number; swarm: number; pollinator1: number; pollinator2: number };
  periods: { auto: number; transition: number; teleop: number };
  flowerUnlockClock: number;
  nectarReleaseAllClock: number;
  maxControlledElements: number;
}

function item(id: string): ScoringItem {
  const found = (rawRules.scoring.items as ScoringItem[]).find((i) => i.id === id);
  if (!found) throw new Error(`rules: scoring item '${id}' missing`);
  return found;
}

function rpRule(id: string): RankingPointRule {
  const found = (rawRules.scoring.rankingPoints as RankingPointRule[]).find((r) => r.id === id);
  if (!found) throw new Error(`rules: ranking point '${id}' missing`);
  return found;
}

function required(value: number | null | undefined, name: string): number {
  if (value === null || value === undefined) throw new Error(`rules: '${name}' missing`);
  return value;
}

function period(id: MatchPeriod["id"]): number {
  const found = (rawRules.match.periods as MatchPeriod[]).find((p) => p.id === id);
  return required(found?.duration, `period ${id}`);
}

function milestone(id: string): number {
  const found = rawRules.match.milestones.find((m) => m.id === id);
  return required(found?.clock, `milestone ${id}`);
}

export const RULES: GameRules = {
  manualVersion: rawRules.meta.manualVersion,
  points: {
    leave: required(item("leave").auto, "leave.auto"),
    autoPark: required(item("park").auto, "park.auto"),
    teleopPark: required(item("park").teleop, "park.teleop"),
    autoHiveTip: required(item("hiveTip").auto, "hiveTip.auto"),
    teleopHiveTip: required(item("hiveTip").teleop, "hiveTip.teleop"),
    cellElement: required(item("cellRemaining").teleop, "cellRemaining.teleop"),
    bottomNectarBonus: required(item("bottomNectarBonus").teleop, "bottomNectarBonus.teleop"),
    ownedFlowerElement: required(item("ownedFlowerElement").teleop, "ownedFlowerElement.teleop"),
    garden: required(item("garden").teleop, "garden.teleop"),
  },
  fouls: { minor: rawRules.penalties.values.minor, major: rawRules.penalties.values.major },
  rp: {
    swarmThreshold: required(rpRule("swarm").threshold, "swarm.threshold"),
    pollinator1Threshold: required(rpRule("pollinator1").threshold, "pollinator1.threshold"),
    pollinator2Threshold: required(rpRule("pollinator2").threshold, "pollinator2.threshold"),
    swarm: rpRule("swarm").rp,
    pollinator1: rpRule("pollinator1").rp,
    pollinator2: rpRule("pollinator2").rp,
    win: rpRule("win").rp,
    tie: rpRule("tie").rp,
  },
  periods: { auto: period("auto"), transition: period("transition"), teleop: period("teleop") },
  flowerUnlockClock: milestone("flowerUnlock"),
  nectarReleaseAllClock: rawRules.humanPlayer.nectarEntry.allRemainingAtClock,
  maxControlledElements: rawRules.robot.maxControlledElements,
};

/** Acesso ao JSON completo, para geometria do campo e textos de referência. */
export const RAW_RULES = rawRules;
