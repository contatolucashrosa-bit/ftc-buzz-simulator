// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Página de medição do M5a: compila e roda código Java de equipes FTC no navegador (teavm-javac).
import { createCompiler, type JavaCompiler } from "../../vendor/teavm-javac/teavm-javac.js";

const out = document.getElementById("log")!;
const log = (s: string) => {
  out.textContent += s + "\n";
  console.log(s);
};

// ---------- hardware falso (só para a medição; a integração real fica no jogo) ----------
const MOTORS = ["leftFront", "leftBack", "rightFront", "rightBack"];
const TICKS_PER_REV = 537.7;
const MAX_RPM = 312;
interface MotorState {
  power: number;
  mode: number;
  target: number;
  position: number;
  velocity: number;
}
const motors = new Map<string, MotorState>(MOTORS.map((n) => [n, { power: 0, mode: 0, target: 0, position: 0, velocity: 0 }]));
let state = 0;
let telemetryText = "";
const t0 = performance.now();
const hwLog: string[] = [];
let waiting: Array<() => void> = [];
let steps = 0;
let hwCalls = 0;

(globalThis as Record<string, unknown>).__buzzHw = {
  kind: (name: string) => (motors.has(name) ? "motor" : name === "imu" ? "imu" : name === "pinpoint" ? "odometry" : ""),
  get: (name: string, prop: string) => {
    hwCalls++;
    const m = motors.get(name);
    if (m) {
      if (prop === "ticksPerRev") return TICKS_PER_REV;
      if (prop === "maxRpm") return MAX_RPM;
      if (prop === "position") return m.position;
      if (prop === "velocity") return m.velocity;
      return 0;
    }
    if (name === "battery") return 12.8;
    if (name === "pinpoint" && prop === "x") return motors.get("rightFront")!.position * 0.6;
    return 0;
  },
  set: (name: string, prop: string, value: number) => {
    hwCalls++;
    const m = motors.get(name);
    if (m && (prop === "power" || prop === "mode" || prop === "target")) m[prop] = value;
  },
  gamepad: () => 0,
  state: () => state,
  time: () => (performance.now() - t0) / 1000,
  telemetry: (text: string) => (telemetryText = text),
  log: (text: string) => hwLog.push(text),
  names: (kind: string) => (kind === "motor" ? MOTORS.join(",") : ""),
  onNextStep: (resume: () => void) => waiting.push(resume),
};

setInterval(() => {
  const dt = 0.01;
  for (const m of motors.values()) {
    let p = m.power;
    if (m.mode === 2) p = Math.sign(m.target - m.position) * Math.min(Math.abs(m.power), Math.abs(m.target - m.position) / 100);
    m.velocity = p * (TICKS_PER_REV * MAX_RPM) / 60;
    m.position += m.velocity * dt;
  }
  steps++;
  // Retoma os OpModes que esperavam este passo de física (Hw.sync).
  const resume = waiting;
  waiting = [];
  resume.forEach((fn) => fn());
}, 10);

// ---------- utilitários ----------
async function bytes(url: URL): Promise<Uint8Array> {
  return new Uint8Array(await (await fetch(url)).arrayBuffer());
}

const LIBS = {
  sdk: new URL("../../vendor/java-libs/buzz-ftc-sdk.jar", import.meta.url),
  pedro: new URL("../../vendor/java-libs/pedropathing-3.0.2.jar", import.meta.url),
  rrCore: new URL("../../vendor/java-libs/roadrunner-core-1.0.1.jar", import.meta.url),
  rrActions: new URL("../../vendor/java-libs/roadrunner-actions-1.0.1.jar", import.meta.url),
  rrFtc: new URL("../../vendor/java-libs/roadrunner-ftc-0.1.25.jar", import.meta.url),
  dashCore: new URL("../../vendor/java-libs/dashboard-core-0.5.1.jar", import.meta.url),
  dash: new URL("../../vendor/java-libs/dashboard-0.5.1.jar", import.meta.url),
  kotlin: new URL("../../vendor/java-libs/kotlin-stdlib-1.9.24.jar", import.meta.url),
};

const JAVA_TESTS = import.meta.glob("./spike/*.java", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

async function newCompiler(libs: Array<keyof typeof LIBS>): Promise<{ compiler: JavaCompiler; diags: string[] }> {
  const compiler = await createCompiler();
  const diags: string[] = [];
  compiler.onDiagnostic((d) => {
    if (d.severity === "ERROR" || d.type === "error" || d.severity === "error") diags.push(`${d.fileName ?? ""}:${d.lineNumber ?? ""} ${d.message}`);
  });
  for (const lib of libs) {
    const b = await bytes(LIBS[lib]);
    compiler.addDependencyArchive(b);
    compiler.addClassArchive(b);
  }
  return { compiler, diags };
}

function mainSource(opModeClass: string): string {
  return `public class BuzzMain { public static void main(String[] args) { org.buzzsim.internal.Runner.run(new ${opModeClass}()); } }`;
}

async function runTest(label: string, libs: Array<keyof typeof LIBS>, sources: Record<string, string>, opModeClass: string): Promise<void> {
  log(`\n=== ${label} ===`);
  let t = performance.now();
  const { compiler, diags } = await newCompiler(libs);
  log(`compilador + bibliotecas: ${Math.round(performance.now() - t)} ms`);
  for (const [path, text] of Object.entries(sources)) compiler.addSource(path, text);
  compiler.addSource("BuzzMain.java", mainSource(opModeClass));
  t = performance.now();
  const ok = compiler.compile();
  log(`javac: ${ok ? "OK" : "FALHOU"} em ${Math.round(performance.now() - t)} ms (${Object.keys(sources).length} arquivos)`);
  if (!ok) {
    diags.slice(0, 8).forEach((d) => log("  " + d));
    return;
  }
  t = performance.now();
  // Backend JavaScript: no wasm-gc, String.format("%.1f") quebra dentro do DecimalFormat do TeaVM.
  const js = compiler.emitJs({ mainClass: "BuzzMain", module: "esm", optimizationLevel: "advanced" });
  log(`TeaVM (JS): ${js.ok ? "OK" : "FALHOU"} em ${Math.round(performance.now() - t)} ms, ${((js.text?.length ?? 0) / 1024).toFixed(0)} KB`);
  if (!js.ok || !js.text) {
    diags.slice(-8).forEach((d) => log("  " + d));
    return;
  }
  // INIT por 300 ms, depois START; parada forçada em 5 s
  state = 0;
  hwLog.length = 0;
  hwCalls = 0;
  steps = 0;
  for (const m of motors.values()) Object.assign(m, { power: 0, mode: 0, target: 0, position: 0, velocity: 0 });
  const mod = (await import(/* @vite-ignore */ URL.createObjectURL(new Blob([js.text], { type: "text/javascript" })))) as {
    createJavaProgram(options: object): Promise<{ execute(): Promise<unknown> }>;
  };
  const program = await mod.createJavaProgram({});
  setTimeout(() => (state = 1), 300);
  const stopTimer = setTimeout(() => (state = 2), 5000);
  t = performance.now();
  try {
    await program.execute();
  } catch (e) {
    log(`exceção JS: ${String(e).slice(0, 200)}`);
  }
  clearTimeout(stopTimer);
  log(`execução: ${Math.round(performance.now() - t)} ms; chamadas de hardware: ${hwCalls}; passos de física: ${steps}`);
  log(`telemetria: ${telemetryText.trim().replace(/\n/g, " | ")}`);
  log(`log: ${hwLog.join(" | ")}`);
}

async function compileSamples(): Promise<void> {
  log("\n=== Amostras oficiais da FTC (cada uma isolada, sem alterações) ===");
  const manifest = (await (await fetch("/tmp-spike/manifest.json")).json()) as string[];
  const samples = manifest.filter((p) => p.startsWith("samples/"));
  const { compiler } = await newCompiler(["sdk"]);
  let ok = 0;
  const failed: string[] = [];
  const t = performance.now();
  for (const path of samples) {
    const text = await (await fetch("/tmp-spike/" + path)).text();
    compiler.clearSources();
    compiler.addSource(path.split("/").pop()!, text);
    if (compiler.compile()) ok++;
    else failed.push(path.split("/").pop()!);
  }
  log(`${ok} de ${samples.length} compilam (${Math.round(performance.now() - t)} ms no total)`);
  log(`falharam: ${failed.join(", ")}`);
}

async function main(): Promise<void> {
  const tests = Object.fromEntries(Object.entries(JAVA_TESTS).map(([k, v]) => [k.replace("./spike/", ""), v]));
  await runTest("1. OpMode básico (motores, IMU, telemetria, RUN_TO_POSITION)", ["sdk"], { "TestBasic.java": tests["TestBasic.java"] }, "org.firstinspires.ftc.teamcode.TestBasic");
  await runTest("2. Pedro Pathing 3.0.2 (Mecanum + Pinpoint + Paths)", ["sdk", "pedro"], { "TestPedro.java": tests["TestPedro.java"] }, "org.firstinspires.ftc.teamcode.TestPedro");

  const manifest = (await (await fetch("/tmp-spike/manifest.json")).json()) as string[];
  const rrSources: Record<string, string> = { "TestRoadRunner.java": tests["TestRoadRunner.java"] };
  for (const p of manifest.filter((x) => x.startsWith("rr/"))) rrSources[p.split("/").pop()!] = await (await fetch("/tmp-spike/" + p)).text();
  await runTest(
    "3. RoadRunner 1.0 (Quickstart inteiro, sem alterações)",
    ["sdk", "rrCore", "rrActions", "rrFtc", "dashCore", "dash", "kotlin"],
    rrSources,
    "org.firstinspires.ftc.teamcode.TestRoadRunner",
  );
  await compileSamples();
  log("\nFIM");
}

if (location.hash !== "#idle") main().catch((e) => log("ERRO " + (e?.stack ?? e)));
