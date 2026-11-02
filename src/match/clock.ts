// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Relógio oficial da partida: AUTO 30 s → transição 8 s → TELEOP 2:00 (§10.4 p.83; Tabela 9-1 p.77).
import { RULES, type GameRules } from "../rules/rules";

export type MatchPhase = "pre" | "auto" | "transition" | "teleop" | "post";

export interface ClockState {
  phase: MatchPhase;
  /** Segundos restantes na contagem do placar (2:30→2:00 no AUTO, 0:08→0:00 na transição, 2:00→0:00 no TELEOP). */
  displaySeconds: number;
  /** Segundos restantes na partida inteira, contando só os períodos jogados (para as regras de "1:00 restante"). */
  matchSecondsRemaining: number;
  /** NECTAR pode entrar nas FLOWERS (G410) e todo NECTAR restante pode ser introduzido (G426). */
  flowerUnlocked: boolean;
  /** Robôs podem se mover por energia própria (proibido na transição e após o fim: G403/G404). */
  robotsEnabled: boolean;
  /** O piloto pode controlar (só no TELEOP; G401 proíbe interação no AUTO). */
  driverControl: boolean;
}

export function matchDuration(rules: GameRules = RULES): number {
  return rules.periods.auto + rules.periods.transition + rules.periods.teleop;
}

/** @param elapsed segundos desde o início da partida (negativo = antes do início). */
export function clockAt(elapsed: number, rules: GameRules = RULES): ClockState {
  const { auto, transition, teleop } = rules.periods;
  const base = { flowerUnlocked: false, robotsEnabled: false, driverControl: false };

  if (elapsed < 0) {
    return { ...base, phase: "pre", displaySeconds: auto + teleop, matchSecondsRemaining: auto + teleop };
  }
  if (elapsed < auto) {
    return {
      ...base,
      phase: "auto",
      displaySeconds: auto + teleop - elapsed,
      matchSecondsRemaining: auto + teleop - elapsed,
      robotsEnabled: true,
    };
  }
  if (elapsed < auto + transition) {
    return {
      ...base,
      phase: "transition",
      displaySeconds: auto + transition - elapsed,
      matchSecondsRemaining: teleop,
    };
  }
  const teleopElapsed = elapsed - auto - transition;
  if (teleopElapsed < teleop) {
    const remaining = teleop - teleopElapsed;
    return {
      phase: "teleop",
      displaySeconds: remaining,
      matchSecondsRemaining: remaining,
      flowerUnlocked: remaining <= rules.flowerUnlockClock,
      robotsEnabled: true,
      driverControl: true,
    };
  }
  return { ...base, phase: "post", displaySeconds: 0, matchSecondsRemaining: 0, flowerUnlocked: true };
}

/** Formata como no placar oficial: "2:30", "0:08". Arredonda para cima para nunca mostrar 0:00 antes da hora. */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds - 1e-9));
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * NECTAR que o HUMAN PLAYER ainda pode introduzir (G426 p.114):
 * 1 por TIP da própria HIVE, ou todo o restante quando faltam 60 s ou menos.
 */
export function nectarAllowance(params: {
  inAllianceArea: number;
  alreadyIntroducedFromStaging: number;
  ownHiveTips: number;
  matchSecondsRemaining: number;
  phase: MatchPhase;
  rules?: GameRules;
}): number {
  const rules = params.rules ?? RULES;
  if (params.phase === "pre" || params.phase === "post") return 0;
  const releaseAll = params.phase === "teleop" && params.matchSecondsRemaining <= rules.nectarReleaseAllClock;
  if (releaseAll) return params.inAllianceArea;
  const earned = params.ownHiveTips - params.alreadyIntroducedFromStaging;
  return Math.max(0, Math.min(params.inAllianceArea, earned));
}
