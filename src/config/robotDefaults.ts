// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Valores padrão do robô genérico, num módulo leve (a página inicial não precisa carregar o motor 3D).

/** Tempo entre lançamentos na rajada (s). Suposição: lançadores típicos de FTC fazem 3 a 4 bolas por segundo. */
export const DEFAULT_LAUNCH_INTERVAL_S = 0.3;
export const LAUNCH_INTERVAL_LIMITS = { min: 0.05, max: 2 } as const;

export function clampLaunchInterval(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LAUNCH_INTERVAL_S;
  return Math.min(LAUNCH_INTERVAL_LIMITS.max, Math.max(LAUNCH_INTERVAL_LIMITS.min, value));
}
