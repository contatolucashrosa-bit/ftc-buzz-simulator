// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Projeto Java da equipe (TeamCode do Android Studio): arquivos, OpModes, bibliotecas e nomes de hardware.
// Só lê o código-fonte (sem compilar), por isso é leve e testável.
import { tx } from "../workshop/db";

export type LibId = "sdk" | "pedro" | "rrCore" | "rrActions" | "rrFtc" | "dashCore" | "dash" | "kotlin";
export type DeviceKind = "motor" | "servo" | "crservo" | "imu" | "odometry" | "distance" | "touch" | "digital" | "analog";

export interface OpModeInfo {
  /** Nome completo da classe (pacote + classe). */
  className: string;
  /** Nome mostrado no Driver Station (anotação). */
  name: string;
  type: "teleop" | "autonomous";
  group: string;
  disabled: boolean;
  file: string;
}

export interface HardwareUse {
  name: string;
  kind: DeviceKind;
}

export interface JavaProject {
  id: string;
  name: string;
  files: Record<string, string>;
  opModes: OpModeInfo[];
  libs: LibId[];
  hardware: HardwareUse[];
  /** Nome usado no código → dispositivo do robô simulado (ex.: "fl" → "leftFront"). */
  deviceMap: Record<string, string>;
  importedAt: number;
}

const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/** Fica só com o código da equipe: dentro de TeamCode/src/main/java, se o projeto inteiro foi importado. */
export function selectTeamCode(entries: Array<{ path: string; text: string }>): Record<string, string> {
  const java = entries.filter((e) => e.path.toLowerCase().endsWith(".java")).map((e) => ({ ...e, path: e.path.replace(/\\/g, "/") }));
  const teamCode = java.filter((e) => /(^|\/)TeamCode\/src\/main\/java\//.test(e.path));
  const chosen = teamCode.length ? teamCode : java.filter((e) => !/(^|\/)FtcRobotController\//.test(e.path));
  const files: Record<string, string> = {};
  for (const e of chosen) {
    const short = e.path.replace(/^.*?TeamCode\/src\/main\/java\//, "");
    files[short] = e.text;
  }
  return files;
}

/** Anotações logo antes de uma posição (desde o fim da última instrução ou bloco). */
function annotationsBefore(code: string, index: number): string {
  const before = code.slice(0, index);
  return before.slice(Math.max(before.lastIndexOf(";"), before.lastIndexOf("}")) + 1);
}

export function parseOpModes(files: Record<string, string>): OpModeInfo[] {
  const out: OpModeInfo[] = [];
  for (const [file, raw] of Object.entries(files)) {
    const code = stripComments(raw);
    const pkg = /^\s*package\s+([\w.]+)\s*;/m.exec(code)?.[1];
    // anotação @TeleOp/@Autonomous seguida (com outras anotações no meio) da declaração da classe
    const re = /@(TeleOp|Autonomous)\s*(\(([^)]*)\))?([\s\S]*?)\bclass\s+(\w+)/g;
    for (const m of code.matchAll(re)) {
      const args = m[3] ?? "";
      const className = m[5];
      const between = m[4] ?? "";
      out.push({
        className: pkg ? `${pkg}.${className}` : className,
        name: /name\s*=\s*"([^"]*)"/.exec(args)?.[1] ?? /^\s*"([^"]*)"/.exec(args)?.[1] ?? className,
        type: m[1] === "TeleOp" ? "teleop" : "autonomous",
        group: /group\s*=\s*"([^"]*)"/.exec(args)?.[1] ?? "",
        disabled: /@Disabled\b/.test(between) || /@Disabled\b/.test(annotationsBefore(code, m.index ?? 0)),
        file,
      });
    }
  }
  return out.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
}

/** Bibliotecas pré-compiladas que o projeto usa, pelos imports. */
export function detectLibs(files: Record<string, string>): LibId[] {
  const all = Object.values(files).join("\n");
  const libs = new Set<LibId>(["sdk"]);
  if (/import\s+com\.pedropathing\./.test(all)) libs.add("pedro");
  if (/import\s+com\.acmerobotics\.roadrunner\./.test(all)) ["rrCore", "rrActions", "rrFtc", "dashCore", "dash", "kotlin"].forEach((l) => libs.add(l as LibId));
  if (/import\s+com\.acmerobotics\.dashboard\./.test(all)) ["dashCore", "dash"].forEach((l) => libs.add(l as LibId));
  return [...libs];
}

const TYPE_KIND: Array<[RegExp, DeviceKind]> = [
  [/^(DcMotor|DcMotorEx|DcMotorSimple)$/, "motor"],
  [/^Servo$/, "servo"],
  [/^CRServo$/, "crservo"],
  [/^(IMU|BNO055IMU|BHI260IMU)$/, "imu"],
  [/^(GoBildaPinpointDriver|SparkFunOTOS|OctoQuad)$/, "odometry"],
  [/^(DistanceSensor|Rev2mDistanceSensor)$/, "distance"],
  [/^TouchSensor$/, "touch"],
  [/^DigitalChannel$/, "digital"],
  [/^AnalogInput$/, "analog"],
];
const FIELD_KIND: Record<string, DeviceKind> = { dcMotor: "motor", servo: "servo", crservo: "crservo", touchSensor: "touch", digitalChannel: "digital", analogInput: "analog" };

/** Dispositivos pedidos ao hardwareMap, com o tipo deduzido da chamada. */
export function findHardware(files: Record<string, string>): HardwareUse[] {
  const found = new Map<string, DeviceKind>();
  for (const raw of Object.values(files)) {
    const code = stripComments(raw);
    for (const m of code.matchAll(/hardwareMap\s*\.\s*(?:get|tryGet)\s*\(\s*(\w+)\.class\s*,\s*"([^"]+)"/g)) {
      const kind = TYPE_KIND.find(([re]) => re.test(m[1]))?.[1];
      if (kind) found.set(m[2], kind);
    }
    for (const m of code.matchAll(/hardwareMap\s*\.\s*(\w+)\s*\.\s*get\s*\(\s*"([^"]+)"/g)) {
      const kind = FIELD_KIND[m[1]];
      if (kind) found.set(m[2], kind);
    }
  }
  return [...found].map(([name, kind]) => ({ name, kind })).sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

/** Dispositivos do robô simulado. */
export const SIM_DEVICES: Array<{ id: string; kind: DeviceKind; label: string }> = [
  { id: "leftFront", kind: "motor", label: "Roda dianteira esquerda" },
  { id: "leftBack", kind: "motor", label: "Roda traseira esquerda" },
  { id: "rightFront", kind: "motor", label: "Roda dianteira direita" },
  { id: "rightBack", kind: "motor", label: "Roda traseira direita" },
  { id: "intake", kind: "motor", label: "Intake" },
  { id: "launcher", kind: "motor", label: "Lançador (volante)" },
  { id: "feeder", kind: "servo", label: "Alimentador do lançador" },
  { id: "placer", kind: "servo", label: "Colocador / servo da FLOWER" },
  { id: "hood", kind: "servo", label: "Ângulo do lançador" },
  { id: "imu", kind: "imu", label: "IMU" },
  { id: "odometry", kind: "odometry", label: "Odometria (Pinpoint/OTOS)" },
];

/**
 * Chuta a ligação nome do código → dispositivo simulado pelas palavras do nome
 * ("fl", "frontLeft", "left_front_drive", "shooter", "kicker"...). A equipe pode corrigir na Oficina.
 */
export function guessDeviceMap(hardware: HardwareUse[]): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  const assign = (name: string, id: string) => {
    if (used.has(id)) return false;
    map[name] = id;
    used.add(id);
    return true;
  };
  for (const { name, kind } of hardware) {
    const n = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    // siglas de duas letras ("fl", "rbMotor", "lf_drive")
    const short = /^(fl|lf|fr|rf|bl|lb|br|rb)(motor|drive|wheel|m)?$/.exec(n)?.[1];
    if (kind === "motor" && short) {
      const ids: Record<string, string> = { fl: "leftFront", lf: "leftFront", fr: "rightFront", rf: "rightFront", bl: "leftBack", lb: "leftBack", br: "rightBack", rb: "rightBack" };
      assign(name, ids[short]);
      continue;
    }
    if (kind === "motor") {
      const left = /left|^l|esq/.test(n);
      const right = /right|^r|dir/.test(n);
      const front = /front|^.f|f$|^f|frente/.test(n);
      const back = /back|rear|^.b|b$|^b|tras/.test(n);
      if (/intake|collect|coleta|sweep|roller/.test(n)) assign(name, "intake");
      else if (/launch|shoot|fly|lanc|outtake/.test(n)) assign(name, "launcher");
      else if (left && front) assign(name, "leftFront");
      else if (left && back) assign(name, "leftBack");
      else if (right && front) assign(name, "rightFront");
      else if (right && back) assign(name, "rightBack");
      else if (left) assign(name, used.has("leftFront") ? "leftBack" : "leftFront");
      else if (right) assign(name, used.has("rightFront") ? "rightBack" : "rightFront");
    } else if (kind === "servo" || kind === "crservo") {
      if (/hood|angle|pitch|capo/.test(n)) assign(name, "hood");
      else if (/feed|kick|push|gate|transfer|aliment/.test(n)) assign(name, "feeder");
      else if (/place|claw|poke|flower|arm|pollen/.test(n)) assign(name, "placer");
    } else if (kind === "imu") assign(name, "imu");
    else if (kind === "odometry") assign(name, "odometry");
  }
  return map;
}

export function buildProject(name: string, entries: Array<{ path: string; text: string }>): JavaProject {
  const files = selectTeamCode(entries);
  const hardware = findHardware(files);
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    files,
    opModes: parseOpModes(files),
    libs: detectLibs(files),
    hardware,
    deviceMap: guessDeviceMap(hardware),
    importedAt: Date.now(),
  };
}

// ---------- armazenamento (IndexedDB) ----------

export async function listProjects(): Promise<JavaProject[]> {
  try {
    const all = await tx<JavaProject[]>("projects", "readonly", (s) => s.getAll() as IDBRequest<JavaProject[]>);
    return all.sort((a, b) => b.importedAt - a.importedAt);
  } catch {
    return [];
  }
}

export function getProject(id: string): Promise<JavaProject | undefined> {
  return tx<JavaProject | undefined>("projects", "readonly", (s) => s.get(id) as IDBRequest<JavaProject | undefined>);
}

export async function saveProject(project: JavaProject): Promise<void> {
  await tx("projects", "readwrite", (s) => s.put(project));
}

export async function deleteProject(id: string): Promise<void> {
  await tx("projects", "readwrite", (s) => s.delete(id));
}

/** Valor usado nos seletores da tela "Jogar" para um OpMode: "<projeto>|<classe>". */
export const opModeRef = (projectId: string, className: string) => `${projectId}|${className}`;
export const parseOpModeRef = (ref: string) => {
  const i = ref.indexOf("|");
  return i < 0 ? null : { projectId: ref.slice(0, i), className: ref.slice(i + 1) };
};
