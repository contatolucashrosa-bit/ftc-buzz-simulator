// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Variantes de robô baseadas nos starter bots públicos do BIOBUZZ (goBILDA, REV DUO e AndyMark Robits).
// Só os parâmetros vêm dos CADs e das páginas dos fabricantes; o modelo 3D é nosso (os CADs não são redistribuídos).
// Módulo leve: a página inicial usa a lista sem carregar o motor 3D. Detalhes em docs/starter-bots.md.
import { DEFAULT_LAUNCH_INTERVAL_S } from "./robotDefaults";

export type RobotPresetId = "generic" | "gobilda" | "revDuo" | "andymark";
export type Drivetrain = "mecanum" | "tank";
/**
 * Como o robô tira POLLEN de dentro da FLOWER:
 * - "intake": o próprio intake alcança o POLLEN dentro do anel de baixo e o puxa (goBILDA, robô genérico);
 * - "servo": um servo empurra o POLLEN para fora da FLOWER, e o intake o recolhe do chão (REV DUO e AndyMark).
 */
export type FlowerRetrieval = "intake" | "servo";

export interface RobotPreset {
  id: RobotPresetId;
  label: string;
  description: string;
  /** Comprimento (frente–trás) e largura da base, em polegadas (R102: até 18 × 18). */
  length: number;
  width: number;
  /** Altura do topo do mecanismo de lançamento, em polegadas. */
  height: number;
  drivetrain: Drivetrain;
  massKg: number;
  maxSpeed: number; // m/s
  maxAccel: number; // m/s²
  maxTurnRate: number; // rad/s
  launchIntervalS: number;
  launcherSpeed: number; // m/s
  launcherPitchDeg: number;
  /** Consegue colocar elementos dentro da FLOWER (pontuar na FLOWER). */
  canPlace: boolean;
  flowerRetrieval: FlowerRetrieval;
  /** Largura útil do intake (pol). */
  intakeWidth: number;
  /** Cores do nosso modelo (estrutura e destaque), inspiradas no material de cada kit. */
  frameColor: number;
  accentColor: number;
}

export const ROBOT_PRESETS: Record<RobotPresetId, RobotPreset> = {
  generic: {
    id: "generic",
    label: "Robô de treino (mecanum)",
    description: "Base mecanum de 18 × 18 pol, intake, lançador e colocador na FLOWER. Bom para aprender o jogo inteiro.",
    length: 18,
    width: 18,
    height: 16,
    drivetrain: "mecanum",
    massKg: 13,
    maxSpeed: 1.6,
    maxAccel: 4,
    maxTurnRate: 3.5,
    launchIntervalS: DEFAULT_LAUNCH_INTERVAL_S,
    launcherSpeed: 6.2,
    launcherPitchDeg: 42,
    canPlace: true,
    flowerRetrieval: "intake",
    intakeWidth: 14,
    frameColor: 0x2b2f36,
    accentColor: 0xf57e25,
  },
  gobilda: {
    id: "gobilda",
    label: "goBILDA Starter Bot",
    description: "6WD drop-center (não anda de lado), intake de rodas Gecko que puxa o POLLEN de dentro da FLOWER, lançador. Até 4 elementos.",
    length: 17,
    width: 16.5,
    height: 15,
    drivetrain: "tank",
    massKg: 11,
    maxSpeed: 1.5,
    maxAccel: 3.5,
    maxTurnRate: 3.2,
    launchIntervalS: 0.45,
    launcherSpeed: 6.2,
    launcherPitchDeg: 45,
    canPlace: false,
    flowerRetrieval: "intake",
    intakeWidth: 13,
    frameColor: 0x2c2f33,
    accentColor: 0xf2c200,
  },
  revDuo: {
    id: "revDuo",
    label: "REV DUO Starter Bot",
    description: "Tração tanque por correias, intake, lançador e um servo \"cutucador\" que tira o POLLEN da FLOWER para o chão.",
    length: 17.5,
    width: 17,
    height: 14,
    drivetrain: "tank",
    massKg: 10,
    maxSpeed: 1.3,
    maxAccel: 3.2,
    maxTurnRate: 3,
    launchIntervalS: 0.5,
    launcherSpeed: 6.0,
    launcherPitchDeg: 46,
    canPlace: false,
    flowerRetrieval: "servo",
    intakeWidth: 14,
    frameColor: 0x3a3d42,
    accentColor: 0xe0e3e8,
  },
  andymark: {
    id: "andymark",
    label: "AndyMark Robits Starter Bot",
    description: "Tração tanque com rodas omni e stealth (gira fácil), intake de rodas complacentes, lançador com capô e servo que solta o POLLEN da FLOWER.",
    length: 17,
    width: 17,
    height: 15,
    drivetrain: "tank",
    massKg: 11,
    maxSpeed: 1.4,
    maxAccel: 3.4,
    maxTurnRate: 3.8,
    launchIntervalS: 0.4,
    launcherSpeed: 6.1,
    launcherPitchDeg: 40,
    canPlace: false,
    flowerRetrieval: "servo",
    intakeWidth: 13,
    frameColor: 0x24272b,
    accentColor: 0x6cc24a,
  },
};

export const ROBOT_PRESET_IDS = Object.keys(ROBOT_PRESETS) as RobotPresetId[];

export function robotPreset(id: string | undefined): RobotPreset {
  return ROBOT_PRESETS[id as RobotPresetId] ?? ROBOT_PRESETS.generic;
}
