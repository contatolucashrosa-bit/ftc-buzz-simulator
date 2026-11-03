// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Identidade, créditos e preferências locais do aplicativo.
import type { Quality } from "../render/stage";
import type { AutoProgramId } from "../game/autonomous";
import { DEFAULT_LAUNCH_INTERVAL_S } from "./robotDefaults";
import type { RobotPresetId } from "./robotPresets";

export const APP = {
  name: "Buzz Simulator",
  version: "0.1.0",
  tagline: "Projete, programe e jogue FTC — direto do navegador.",
  author: "Lucas Hochmann Rosa",
  authorUrl: "https://github.com/contatolucashrosa-bit",
  partner: "WestSharksFTC #24823",
  partnerUrl: "https://www.westsharksftc.com/",
  license: "MIT",
  manualVersion: "TU07",
};

export const DISCLAIMER =
  "O Buzz Simulator é um projeto independente, sem afiliação nem endosso da FIRST®. FIRST®, FIRST® Tech Challenge e BIOBUZZ™ são marcas registradas da For Inspiration and Recognition of Science and Technology (FIRST).";

export interface Preferences {
  teamNumber: string;
  quality: Quality;
  autoProgram: AutoProgramId;
  eventName: string;
  /** Tempo entre lançamentos na rajada (s). Padrão do robô genérico; a Oficina vai calcular pelo mecanismo. */
  launchIntervalS: number;
  robotPreset: RobotPresetId;
  /** Robô importado na Oficina (id no IndexedDB); vazio = modelo próprio do simulador. */
  robotModelId: string;
  /** OpModes Java escolhidos ("<projeto>|<classe>"); vazio = programa de exemplo / pilotagem manual. */
  javaAuto: string;
  javaTeleop: string;
  /** Robôs-bot: parceiro na aliança vermelha, adversários azuis (0–2) e nível. */
  botPartner: boolean;
  /** O parceiro vermelho é um 2º jogador no mesmo computador (teclado IJKL ou 2º controle). */
  partnerPlayer: boolean;
  botOpponents: 0 | 1 | 2;
  botLevel: "easy" | "medium" | "hard";
}

const PREFS_KEY = "buzz-simulator:prefs";
const STATS_KEY = "buzz-simulator:stats";

export function defaultQuality(): Quality {
  // Aparelhos com pouca memória ou tela de toque começam no "baixo".
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return memory <= 4 || coarse ? "low" : "medium";
}

export function loadPrefs(): Preferences {
  const fallback: Preferences = { teamNumber: "24823", quality: defaultQuality(), autoProgram: "leavePark", eventName: "Treino da equipe", launchIntervalS: DEFAULT_LAUNCH_INTERVAL_S, robotPreset: "generic", robotModelId: "", javaAuto: "", javaTeleop: "", botPartner: true, partnerPlayer: false, botOpponents: 2, botLevel: "medium" };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<Preferences>) } : fallback;
  } catch {
    return fallback;
  }
}

export function savePrefs(prefs: Preferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // armazenamento indisponível (janela anônima): segue sem salvar
  }
}

/** Contagem real de partidas jogadas neste aparelho (nada é enviado para fora). */
export function loadStats(): { matchesPlayed: number } {
  try {
    return { matchesPlayed: 0, ...(JSON.parse(localStorage.getItem(STATS_KEY) ?? "{}") as object) };
  } catch {
    return { matchesPlayed: 0 };
  }
}

export function recordMatchPlayed(): void {
  try {
    const stats = loadStats();
    localStorage.setItem(STATS_KEY, JSON.stringify({ ...stats, matchesPlayed: stats.matchesPlayed + 1 }));
  } catch {
    // idem
  }
}
