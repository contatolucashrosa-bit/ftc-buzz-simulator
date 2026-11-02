// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Gera os jars usados pelo compilador Java do navegador (vendor/java-libs/):
//   - buzz-ftc-sdk.jar: o SDK FTC simulado (src/java/sdk), compilado com o JDK local;
//   - pedropathing-*.jar: Pedro Pathing (core + revhub, BSD-3) compilado contra o SDK simulado;
//   - jars do RoadRunner, FTC Dashboard e Kotlin, baixados nas versões fixadas abaixo.
// Requisitos: JDK 17+ (javac e jar no PATH ou em JAVA_HOME) e internet só para os downloads.
// Uso: node scripts/build-java-libs.mjs
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "vendor", "java-libs");
const SDK_SRC = join(ROOT, "src", "java", "sdk");
const STUBS = join(ROOT, "scripts", "teavm-stubs");
const CACHE = join(ROOT, ".cache", "java-libs");

const MAVEN_CENTRAL = "https://repo1.maven.org/maven2";
const BROTT = "https://maven.brott.dev";
const PEDRO_VERSION = "3.0.2";

const DOWNLOADS = [
  { file: "roadrunner-core-1.0.1.jar", url: `${BROTT}/com/acmerobotics/roadrunner/core/1.0.1/core-1.0.1.jar` },
  { file: "roadrunner-actions-1.0.1.jar", url: `${BROTT}/com/acmerobotics/roadrunner/actions/1.0.1/actions-1.0.1.jar` },
  { file: "roadrunner-ftc-0.1.25.aar", url: `${BROTT}/com/acmerobotics/roadrunner/ftc/0.1.25/ftc-0.1.25.aar`, aarTo: "roadrunner-ftc-0.1.25.jar" },
  { file: "dashboard-core-0.5.1.jar", url: `${BROTT}/com/acmerobotics/dashboard/core/0.5.1/core-0.5.1.jar` },
  { file: "dashboard-0.5.1.aar", url: `${BROTT}/com/acmerobotics/dashboard/dashboard/0.5.1/dashboard-0.5.1.aar`, aarTo: "dashboard-0.5.1.jar" },
  { file: "kotlin-stdlib-1.9.24.jar", url: `${MAVEN_CENTRAL}/org/jetbrains/kotlin/kotlin-stdlib/1.9.24/kotlin-stdlib-1.9.24.jar` },
];

const PEDRO_SOURCES = ["core", "revhub"].map((a) => ({
  file: `pedro-${a}-${PEDRO_VERSION}-sources.jar`,
  url: `${MAVEN_CENTRAL}/com/pedropathing/${a}/${PEDRO_VERSION}/${a}-${PEDRO_VERSION}-sources.jar`,
}));

function tool(name) {
  const home = process.env.JAVA_HOME;
  const ext = process.platform === "win32" ? ".exe" : "";
  if (home && existsSync(join(home, "bin", name + ext))) return join(home, "bin", name + ext);
  return name;
}

function run(cmd, args, cwd = ROOT) {
  execFileSync(tool(cmd), args, { cwd, stdio: ["ignore", "inherit", "inherit"] });
}

function javaFiles(dir) {
  const result = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) result.push(...javaFiles(full));
    else if (name.endsWith(".java")) result.push(full);
  }
  return result;
}

async function download(entry) {
  const target = join(CACHE, entry.file);
  if (!existsSync(target)) {
    const response = await fetch(entry.url, { redirect: "follow" });
    if (!response.ok) throw new Error(`download failed ${response.status}: ${entry.url}`);
    writeFileSync(target, Buffer.from(await response.arrayBuffer()));
    console.log(`baixado: ${entry.file}`);
  }
  return target;
}

function javac(sources, classpath, outDir) {
  const argfile = join(outDir, "..", `${Date.now()}-sources.txt`);
  writeFileSync(argfile, sources.map((s) => `"${s.replace(/\\/g, "/")}"`).join("\n"));
  const args = ["--release", "17", "-encoding", "UTF-8", "-nowarn", "-Xlint:none", "-proc:none", "-d", outDir];
  if (classpath.length) args.push("-cp", classpath.join(process.platform === "win32" ? ";" : ":"));
  run("javac", [...args, `@${argfile}`]);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(CACHE, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), "buzz-java-"));
  try {
    // 1. SDK simulado (as anotações do TeaVM entram só para compilar e saem do jar)
    const sdkClasses = join(work, "sdk");
    mkdirSync(sdkClasses);
    javac([...javaFiles(SDK_SRC), ...javaFiles(STUBS)], [], sdkClasses);
    rmSync(join(sdkClasses, "org", "teavm"), { recursive: true, force: true });
    run("jar", ["--create", "--file", join(OUT, "buzz-ftc-sdk.jar"), "-C", sdkClasses, "."]);
    console.log("ok: buzz-ftc-sdk.jar");

    // 2. Pedro Pathing a partir dos fontes oficiais (Maven Central)
    const pedroSrc = join(work, "pedro-src");
    mkdirSync(pedroSrc);
    for (const entry of PEDRO_SOURCES) {
      const jarPath = await download(entry);
      run("jar", ["--extract", "--file", jarPath], pedroSrc);
    }
    rmSync(join(pedroSrc, "META-INF"), { recursive: true, force: true });
    const pedroClasses = join(work, "pedro");
    mkdirSync(pedroClasses);
    javac(javaFiles(pedroSrc), [sdkClasses, STUBS], pedroClasses);
    run("jar", ["--create", "--file", join(OUT, `pedropathing-${PEDRO_VERSION}.jar`), "-C", pedroClasses, "."]);
    console.log(`ok: pedropathing-${PEDRO_VERSION}.jar`);

    // 3. Bibliotecas já compiladas (AAR → classes.jar)
    for (const entry of DOWNLOADS) {
      const path = await download(entry);
      if (entry.aarTo) {
        const dir = join(work, entry.file);
        mkdirSync(dir);
        run("jar", ["--extract", "--file", path, "classes.jar"], dir);
        writeFileSync(join(OUT, entry.aarTo), readFileSync(join(dir, "classes.jar")));
        console.log(`ok: ${entry.aarTo}`);
      } else {
        writeFileSync(join(OUT, entry.file), readFileSync(path));
        console.log(`ok: ${entry.file}`);
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
