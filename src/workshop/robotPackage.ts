// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Pacote .buzzrobot.zip: leva um robô da Oficina de um computador para outro (sem servidor).
// Conteúdo: robot.json (medidas, mecanismos e créditos) e model.glb (modelo já normalizado).
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { ROBOT_PRESET_IDS, type RobotPresetId } from "../config/robotPresets";
import type { StoredRobot } from "./robotStore";

export const PACKAGE_EXTENSION = ".buzzrobot.zip";
const FORMAT = "buzz-simulator-robot";
const VERSION = 1;
/** Mesmo limite da importação de CAD na Oficina. */
const MAX_GLB_BYTES = 40 * 1024 * 1024;

export interface RobotCredits {
  /** Equipe dona do robô (ex.: "WestSharksFTC #24823"). */
  team: string;
  /** Quem montou o CAD, como a equipe quer ser creditada. */
  author: string;
}

interface RobotManifest {
  format: typeof FORMAT;
  version: number;
  name: string;
  preset: RobotPresetId;
  sizeIn: StoredRobot["sizeIn"];
  sourceFile: string;
  triangles: number;
  credits: RobotCredits;
  exportedAt: number;
}

export function packRobot(robot: StoredRobot, credits: RobotCredits, now = Date.now()): Uint8Array {
  const manifest: RobotManifest = {
    format: FORMAT,
    version: VERSION,
    name: robot.name,
    preset: robot.preset,
    sizeIn: robot.sizeIn,
    sourceFile: robot.sourceFile,
    triangles: robot.triangles,
    credits,
    exportedAt: now,
  };
  return zipSync({ "robot.json": strToU8(JSON.stringify(manifest, null, 2)), "model.glb": [new Uint8Array(robot.glb), { level: 6 }] });
}

export class RobotPackageError extends Error {}

function positive(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 && v < 200;
}

/** Lê e valida um pacote. Erros vêm em pt-BR, prontos para a tela. */
export function unpackRobot(data: Uint8Array, id: string, now = Date.now()): StoredRobot & { credits: RobotCredits } {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data);
  } catch {
    throw new RobotPackageError("O arquivo não é um .zip válido.");
  }
  const json = files["robot.json"];
  const glb = files["model.glb"];
  if (!json || !glb) throw new RobotPackageError("O pacote não tem robot.json e model.glb: não foi exportado pelo Buzz Simulator.");
  let m: Partial<RobotManifest>;
  try {
    m = JSON.parse(strFromU8(json)) as Partial<RobotManifest>;
  } catch {
    throw new RobotPackageError("O robot.json do pacote está corrompido.");
  }
  if (m.format !== FORMAT) throw new RobotPackageError("O pacote não é de um robô do Buzz Simulator.");
  if (typeof m.version !== "number" || m.version > VERSION) throw new RobotPackageError("O pacote é de uma versão mais nova do Buzz Simulator. Atualize a página e tente de novo.");
  if (!m.preset || !ROBOT_PRESET_IDS.includes(m.preset)) throw new RobotPackageError("O pacote usa mecanismos desconhecidos.");
  const s = m.sizeIn;
  if (!s || !positive(s.length) || !positive(s.width) || !positive(s.height)) throw new RobotPackageError("As medidas do robô no pacote são inválidas.");
  if (glb.byteLength > MAX_GLB_BYTES) throw new RobotPackageError("O modelo do pacote passa de 40 MB.");
  // cabeçalho do GLB: "glTF" em ASCII
  if (glb[0] !== 0x67 || glb[1] !== 0x6c || glb[2] !== 0x54 || glb[3] !== 0x46) throw new RobotPackageError("O model.glb do pacote não é um GLB válido.");
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  return {
    id,
    name: text(m.name, 60) || "Robô importado",
    preset: m.preset,
    sizeIn: { length: s.length, width: s.width, height: s.height },
    sourceFile: text(m.sourceFile, 120),
    triangles: typeof m.triangles === "number" ? m.triangles : 0,
    createdAt: now,
    glb: glb.slice().buffer,
    credits: { team: text(m.credits?.team, 80), author: text(m.credits?.author, 80) },
  };
}

/** Nome de arquivo seguro a partir do nome do robô. */
export function packageFileName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${base || "robo"}${PACKAGE_EXTENSION}`;
}
