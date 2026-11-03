// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Compila um OpMode da equipe (javac + TeaVM) fora da página principal, para a tela não travar por segundos.
import { createCompiler, type CompilerDiagnostic } from "../../vendor/teavm-javac/teavm-javac.js";
import type { LibId } from "./project";

export interface CompileRequest {
  files: Record<string, string>;
  /** Classe do OpMode (pacote + nome). */
  opMode: string;
  libs: LibId[];
}

export type CompileMessage =
  | { type: "progress"; stage: "loading" | "javac" | "teavm"; text: string }
  | { type: "done"; ok: true; js: string; ms: number }
  | { type: "done"; ok: false; diagnostics: CompilerDiagnostic[]; stage: "javac" | "teavm" | "internal"; message?: string };

const LIBS: Record<LibId, URL> = {
  sdk: new URL("../../vendor/java-libs/buzz-ftc-sdk.jar", import.meta.url),
  pedro: new URL("../../vendor/java-libs/pedropathing-3.0.2.jar", import.meta.url),
  rrCore: new URL("../../vendor/java-libs/roadrunner-core-1.0.1.jar", import.meta.url),
  rrActions: new URL("../../vendor/java-libs/roadrunner-actions-1.0.1.jar", import.meta.url),
  rrFtc: new URL("../../vendor/java-libs/roadrunner-ftc-0.1.25.jar", import.meta.url),
  dashCore: new URL("../../vendor/java-libs/dashboard-core-0.5.1.jar", import.meta.url),
  dash: new URL("../../vendor/java-libs/dashboard-0.5.1.jar", import.meta.url),
  kotlin: new URL("../../vendor/java-libs/kotlin-stdlib-1.9.24.jar", import.meta.url),
};

const post = (m: CompileMessage) => (self as unknown as Worker).postMessage(m);

self.onmessage = async (event: MessageEvent<CompileRequest>) => {
  const { files, opMode, libs } = event.data;
  const t0 = performance.now();
  const diagnostics: CompilerDiagnostic[] = [];
  try {
    post({ type: "progress", stage: "loading", text: "Carregando o compilador Java…" });
    const compiler = await createCompiler();
    // o diagnóstico vem com getters do TeaVM: copia os campos para um objeto simples,
    // senão o postMessage entrega um objeto vazio à página
    compiler.onDiagnostic((d) => {
      if (String(d.severity ?? d.type ?? "").toLowerCase().includes("error")) {
        diagnostics.push({ severity: String(d.severity ?? ""), fileName: d.fileName ?? null, lineNumber: Number(d.lineNumber ?? 0), columnNumber: Number(d.columnNumber ?? 0), message: String(d.message ?? "") });
      }
    });
    for (const lib of libs) {
      const bytes = new Uint8Array(await (await fetch(LIBS[lib])).arrayBuffer());
      compiler.addDependencyArchive(bytes);
      compiler.addClassArchive(bytes);
    }
    // o javac daqui confere o nome do arquivo sem as pastas do pacote: usa só "Classe.java"
    // (com a pasta apenas se dois arquivos tiverem o mesmo nome)
    const names = Object.keys(files).map((p) => p.split("/").pop()!);
    for (const [path, text] of Object.entries(files)) {
      const base = path.split("/").pop()!;
      compiler.addSource(names.filter((n) => n === base).length > 1 ? path : base, text);
    }
    // ponto de entrada: o Runner do SDK simulado faz INIT → START → laço → STOP
    compiler.addSource("BuzzMain.java", `public class BuzzMain { public static void main(String[] args) { org.buzzsim.internal.Runner.run(new ${opMode}()); } }`);

    post({ type: "progress", stage: "javac", text: `Compilando ${Object.keys(files).length} arquivo(s) Java…` });
    if (!compiler.compile()) {
      post({ type: "done", ok: false, diagnostics, stage: "javac" });
      return;
    }
    post({ type: "progress", stage: "teavm", text: "Traduzindo para o navegador (TeaVM)…" });
    // Backend JavaScript: no wasm-gc, String.format("%.1f") quebra dentro do DecimalFormat do TeaVM.
    const js = compiler.emitJs({ mainClass: "BuzzMain", module: "esm", optimizationLevel: "advanced" });
    if (!js.ok || !js.text) {
      post({ type: "done", ok: false, diagnostics, stage: "teavm" });
      return;
    }
    post({ type: "done", ok: true, js: js.text, ms: Math.round(performance.now() - t0) });
  } catch (error) {
    post({ type: "done", ok: false, diagnostics, stage: "internal", message: String(error) });
  }
};
