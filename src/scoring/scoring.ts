// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Motor de pontuação puro (sem 3D): recebe o "retrato" da partida e devolve pontos e RP.
// Referência: Tabela 10-2 (p.89) e critérios da seção 10.5 do manual BIOBUZZ TU07.
import { RULES, type Alliance, type GameRules, opponentOf } from "../rules/rules";

export type FlowerElement = "pollen" | "redNectar" | "blueNectar";
export type FlowerId = "redAllianceFlower" | "blueAllianceFlower" | "audienceFlower" | "scoringFlower";
export const FLOWER_IDS: readonly FlowerId[] = ["redAllianceFlower", "blueAllianceFlower", "audienceFlower", "scoringFlower"];

/** Conquistas de uma aliança. Robôs indexados 0 e 1. */
export interface AllianceAchievements {
  autoLeave: [boolean, boolean];
  autoPark: [boolean, boolean];
  autoHiveTips: number;
  teleopHiveTips: number;
  teleopPark: [boolean, boolean];
  /** Elementos (qualquer cor) na CELL virada para cima da HIVE desta aliança, no fim. */
  cellElements: number;
  /** Elementos ao menos parcialmente no GARDEN desta aliança, no fim. */
  gardenElements: number;
  /** Faltas COMETIDAS por esta aliança (os pontos vão para a adversária). */
  minorFouls: number;
  majorFouls: number;
}

export interface MatchSnapshot {
  red: AllianceAchievements;
  blue: AllianceAchievements;
  /** Pilha de cada FLOWER dentro do volume de pontuação, de baixo para cima. */
  flowers: Record<FlowerId, FlowerElement[]>;
}

export interface FlowerResult {
  owner: Alliance | null;
  bottomNectar: Alliance | null;
  elements: number;
}

export interface AllianceScore {
  autoLeavePoints: number;
  autoParkPoints: number;
  autoHivePoints: number;
  autoPoints: number;
  teleopHivePoints: number;
  teleopCellPoints: number;
  teleopFlowerPoints: number;
  teleopGardenPoints: number;
  teleopParkPoints: number;
  teleopPoints: number;
  /** Pontos recebidos por faltas da adversária. */
  foulPointsReceived: number;
  /** Pontos dados à adversária por faltas próprias. */
  foulPointsCommitted: number;
  total: number;
  flowersOwned: number;
  hiveTips: number;
  swarm: { progress: number; threshold: number; achieved: boolean };
  pollinator1: { progress: number; threshold: number; achieved: boolean };
  pollinator2: { progress: number; threshold: number; achieved: boolean };
  rankingPoints: number;
  result: "win" | "tie" | "loss";
}

export interface MatchScore {
  red: AllianceScore;
  blue: AllianceScore;
  flowers: Record<FlowerId, FlowerResult>;
}

export function emptyAchievements(): AllianceAchievements {
  return {
    autoLeave: [false, false],
    autoPark: [false, false],
    autoHiveTips: 0,
    teleopHiveTips: 0,
    teleopPark: [false, false],
    cellElements: 0,
    gardenElements: 0,
    minorFouls: 0,
    majorFouls: 0,
  };
}

export function emptySnapshot(): MatchSnapshot {
  return {
    red: emptyAchievements(),
    blue: emptyAchievements(),
    flowers: { redAllianceFlower: [], blueAllianceFlower: [], audienceFlower: [], scoringFlower: [] },
  };
}

function nectarAlliance(element: FlowerElement): Alliance | null {
  if (element === "redNectar") return "red";
  if (element === "blueNectar") return "blue";
  return null;
}

/**
 * Dona = cor do NECTAR mais alto; bônus = cor do NECTAR mais baixo (§10.5.2 p.86, Fig. 10-5).
 * O POLLEN é ignorado na hora de achar o NECTAR, mas conta para os pontos da dona.
 */
export function evaluateFlower(stack: readonly FlowerElement[]): FlowerResult {
  const nectars = stack.map(nectarAlliance).filter((a): a is Alliance => a !== null);
  return {
    owner: nectars.length > 0 ? nectars[nectars.length - 1] : null,
    bottomNectar: nectars.length > 0 ? nectars[0] : null,
    elements: stack.length,
  };
}

function count(flags: readonly boolean[]): number {
  return flags.filter(Boolean).length;
}

function scoreAlliance(
  alliance: Alliance,
  snapshot: MatchSnapshot,
  flowers: Record<FlowerId, FlowerResult>,
  rules: GameRules,
): Omit<AllianceScore, "foulPointsReceived" | "total" | "rankingPoints" | "result"> {
  const a = snapshot[alliance];
  const p = rules.points;

  const autoLeavePoints = count(a.autoLeave) * p.leave;
  const autoParkPoints = count(a.autoPark) * p.autoPark;
  const autoHivePoints = a.autoHiveTips * p.autoHiveTip;

  let teleopFlowerPoints = 0;
  let flowersOwned = 0;
  for (const result of Object.values(flowers)) {
    if (result.owner === alliance) {
      teleopFlowerPoints += result.elements * p.ownedFlowerElement;
      flowersOwned++;
    }
    if (result.bottomNectar === alliance) teleopFlowerPoints += p.bottomNectarBonus;
  }

  const teleopHivePoints = a.teleopHiveTips * p.teleopHiveTip;
  const teleopCellPoints = a.cellElements * p.cellElement;
  const teleopGardenPoints = a.gardenElements * p.garden;
  const teleopParkPoints = count(a.teleopPark) * p.teleopPark;

  const hiveTips = a.autoHiveTips + a.teleopHiveTips;
  // SWARM soma LEAVE + PARK do AUTO + PARK do fim (Tabela 10-2; confirmado na calculadora oficial).
  const swarmProgress = autoLeavePoints + autoParkPoints + teleopParkPoints;

  return {
    autoLeavePoints,
    autoParkPoints,
    autoHivePoints,
    autoPoints: autoLeavePoints + autoParkPoints + autoHivePoints,
    teleopHivePoints,
    teleopCellPoints,
    teleopFlowerPoints,
    teleopGardenPoints,
    teleopParkPoints,
    teleopPoints: teleopHivePoints + teleopCellPoints + teleopFlowerPoints + teleopGardenPoints + teleopParkPoints,
    foulPointsCommitted: a.minorFouls * rules.fouls.minor + a.majorFouls * rules.fouls.major,
    flowersOwned,
    hiveTips,
    swarm: { progress: swarmProgress, threshold: rules.rp.swarmThreshold, achieved: swarmProgress >= rules.rp.swarmThreshold },
    pollinator1: { progress: hiveTips, threshold: rules.rp.pollinator1Threshold, achieved: hiveTips >= rules.rp.pollinator1Threshold },
    pollinator2: { progress: hiveTips, threshold: rules.rp.pollinator2Threshold, achieved: hiveTips >= rules.rp.pollinator2Threshold },
  };
}

export function computeScore(snapshot: MatchSnapshot, rules: GameRules = RULES): MatchScore {
  const flowers = Object.fromEntries(
    Object.entries(snapshot.flowers).map(([id, stack]) => [id, evaluateFlower(stack)]),
  ) as Record<FlowerId, FlowerResult>;

  const partial = { red: scoreAlliance("red", snapshot, flowers, rules), blue: scoreAlliance("blue", snapshot, flowers, rules) };

  const totals = {
    red: partial.red.autoPoints + partial.red.teleopPoints + partial.blue.foulPointsCommitted,
    blue: partial.blue.autoPoints + partial.blue.teleopPoints + partial.red.foulPointsCommitted,
  };

  const finish = (alliance: Alliance): AllianceScore => {
    const base = partial[alliance];
    const mine = totals[alliance];
    const theirs = totals[opponentOf(alliance)];
    const result = mine > theirs ? "win" : mine === theirs ? "tie" : "loss";
    const rankingPoints =
      (base.swarm.achieved ? rules.rp.swarm : 0) +
      (base.pollinator1.achieved ? rules.rp.pollinator1 : 0) +
      (base.pollinator2.achieved ? rules.rp.pollinator2 : 0) +
      (result === "win" ? rules.rp.win : result === "tie" ? rules.rp.tie : 0);
    return { ...base, foulPointsReceived: partial[opponentOf(alliance)].foulPointsCommitted, total: mine, rankingPoints, result };
  };

  return { red: finish("red"), blue: finish("blue"), flowers };
}
