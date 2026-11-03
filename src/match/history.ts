// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Histórico de partidas deste aparelho e ranking de qualificação local (sem servidor).
// A turma compartilha resultados por arquivo JSON: exportar aqui, importar no outro computador.
import type { AllianceScore } from "../scoring/scoring";

export interface MatchRecord {
  id: string;
  /** Data e hora (ms desde 1970). */
  playedAt: number;
  team: string;
  eventName: string;
  robot: string;
  autoProgram: string;
  total: number;
  autoPoints: number;
  teleopPoints: number;
  foulPointsReceived: number;
  hiveTips: number;
  flowersOwned: number;
  rankingPoints: number;
  result: "win" | "tie" | "loss";
  rp: { swarm: boolean; pollinator1: boolean; pollinator2: boolean };
}

export interface RankingRow {
  rank: number;
  team: string;
  matches: number;
  /** Ranking Score: média de RANKING POINTS por partida. */
  rankingScore: number;
  averagePoints: number;
  highScore: number;
  wins: number;
  losses: number;
  ties: number;
}

const KEY = "buzz-simulator:history";
const MAX_RECORDS = 500;
const FILE_FORMAT = "buzz-simulator/matches@1";

export function recordFromScore(score: AllianceScore, info: { team: string; eventName: string; robot: string; autoProgram: string }, playedAt = Date.now()): MatchRecord {
  return {
    id: `${playedAt.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    playedAt,
    ...info,
    total: score.total,
    autoPoints: score.autoPoints,
    teleopPoints: score.teleopPoints,
    foulPointsReceived: score.foulPointsReceived,
    hiveTips: score.hiveTips,
    flowersOwned: score.flowersOwned,
    rankingPoints: score.rankingPoints,
    result: score.result,
    rp: { swarm: score.swarm.achieved, pollinator1: score.pollinator1.achieved, pollinator2: score.pollinator2.achieved },
  };
}

export function loadHistory(): MatchRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return [];
  }
}

function store(records: MatchRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(records.slice(-MAX_RECORDS)));
  } catch {
    // armazenamento indisponível: a partida só não entra no histórico
  }
}

export function saveRecord(record: MatchRecord): MatchRecord[] {
  const records = [...loadHistory(), record];
  store(records);
  return records;
}

export function clearHistory(): void {
  store([]);
}

function isRecord(x: unknown): x is MatchRecord {
  const r = x as MatchRecord;
  return !!r && typeof r.id === "string" && typeof r.team === "string" && typeof r.total === "number" && typeof r.rankingPoints === "number" && ["win", "tie", "loss"].includes(r.result);
}

/**
 * Ordem de qualificação: Ranking Score (média de RP), depois média de pontos e maior pontuação.
 * Simplificação dos critérios de desempate do manual para o treino solo.
 */
export function rankTeams(records: MatchRecord[]): RankingRow[] {
  const byTeam = new Map<string, MatchRecord[]>();
  for (const r of records) byTeam.set(r.team, [...(byTeam.get(r.team) ?? []), r]);
  const rows = [...byTeam].map(([team, list]) => ({
    rank: 0,
    team,
    matches: list.length,
    rankingScore: list.reduce((s, r) => s + r.rankingPoints, 0) / list.length,
    averagePoints: list.reduce((s, r) => s + r.total, 0) / list.length,
    highScore: Math.max(...list.map((r) => r.total)),
    wins: list.filter((r) => r.result === "win").length,
    losses: list.filter((r) => r.result === "loss").length,
    ties: list.filter((r) => r.result === "tie").length,
  }));
  rows.sort((a, b) => b.rankingScore - a.rankingScore || b.averagePoints - a.averagePoints || b.highScore - a.highScore || a.team.localeCompare(b.team));
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

/** Melhor pontuação anterior da equipe (para o "novo recorde"). */
export function previousBest(records: MatchRecord[], team: string, excludeId?: string): number | null {
  const list = records.filter((r) => r.team === team && r.id !== excludeId);
  return list.length ? Math.max(...list.map((r) => r.total)) : null;
}

export function exportHistory(records: MatchRecord[]): string {
  return JSON.stringify({ format: FILE_FORMAT, exportedAt: new Date().toISOString(), matches: records }, null, 1);
}

/** Junta um arquivo exportado ao histórico (sem duplicar partidas). Devolve quantas entraram. */
export function importHistory(text: string): { added: number; records: MatchRecord[] } {
  const parsed = JSON.parse(text) as { format?: string; matches?: unknown[] };
  if (parsed.format !== FILE_FORMAT || !Array.isArray(parsed.matches)) throw new Error("Arquivo não reconhecido: exporte pelo próprio Buzz Simulator.");
  const current = loadHistory();
  const ids = new Set(current.map((r) => r.id));
  const incoming = parsed.matches.filter(isRecord).filter((r) => !ids.has(r.id));
  const records = [...current, ...incoming].sort((a, b) => a.playedAt - b.playedAt);
  store(records);
  return { added: incoming.length, records };
}
