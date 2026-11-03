// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Compila OpModes (num Worker, com cache no IndexedDB) e roda o programa traduzido ligado ao HardwareBus.
import { tx } from "../workshop/db";
import type { CompilerDiagnostic } from "../../vendor/teavm-javac/teavm-javac.js";
import type { CompileMessage, CompileRequest } from "./compileWorker";
import type { JavaProject, OpModeInfo } from "./project";

/** Muda quando o SDK simulado ou as bibliotecas mudam, para não reaproveitar compilações antigas. */
const RUNTIME_VERSION = "sdk-2026.11-2";

export type CompileResult = { ok: true; js: string; cached: boolean; ms: number } | { ok: false; errors: string[] };

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Mensagens mais comuns do javac em português; o resto vai como veio. */
const TRANSLATIONS: Array<[RegExp, string]> = [
  [/^cannot find symbol/i, "símbolo não encontrado"],
  [/^package (\S+) does not exist/i, "o pacote $1 não existe no simulador"],
  [/^'(.)' expected/i, "faltou '$1'"],
  [/^incompatible types: (.*)/i, "tipos incompatíveis: $1"],
  [/^class, interface, enum, or record expected/i, "esperava uma classe, interface, enum ou record"],
  [/^missing return statement/i, "falta o return"],
  [/^unreachable statement/i, "instrução que nunca é executada"],
  [/^variable (\S+) might not have been initialized/i, "a variável $1 pode não ter sido inicializada"],
  [/^variable (\S+) is already defined/i, "a variável $1 já foi declarada"],
  [/^illegal start of expression/i, "início de expressão inválido"],
  [/^not a statement/i, "isto não é uma instrução"],
  [/^unclosed string literal/i, "texto sem aspas de fechamento"],
  [/^reached end of file while parsing/i, "o arquivo terminou antes da hora (falta fechar '}')"],
  [/^(.*) is abstract; cannot be instantiated/i, "$1 é abstrata e não pode ser criada com new"],
  [/^method (\S+) in (.*) cannot be applied to given types/i, "o método $1 de $2 não aceita esses argumentos"],
  [/^unreported exception (\S+); must be caught or declared to be thrown/i, "a exceção $1 precisa de try/catch ou throws"],
  [/^non-static (.*) cannot be referenced from a static context/i, "$1 não é static e foi usado num contexto static"],
];

export function translateDiagnostic(d: CompilerDiagnostic): string {
  const raw = (d.message ?? "").split("\n");
  let msg = raw[0].trim();
  for (const [re, pt] of TRANSLATIONS) {
    if (re.test(msg)) {
      msg = msg.replace(re, pt);
      break;
    }
  }
  // o javac põe o símbolo na linha seguinte ("symbol: variable x")
  const symbol = raw.find((l) => /^\s*symbol:/.test(l));
  if (symbol) msg += ` (${symbol.trim().replace(/^symbol:\s*/, "").replace(/^variable /, "variável ").replace(/^method /, "método ").replace(/^class /, "classe ")})`;
  const file = (d.fileName ?? "").split("/").pop();
  return file ? `${file}${d.lineNumber ? `, linha ${d.lineNumber}` : ""}: ${msg}` : msg;
}

/** Compila um OpMode do projeto. Reaproveita o resultado guardado se nada mudou. */
export async function compileOpMode(project: JavaProject, opMode: OpModeInfo, onProgress: (text: string) => void = () => undefined): Promise<CompileResult> {
  const key = await sha256(JSON.stringify({ v: RUNTIME_VERSION, libs: project.libs, op: opMode.className, files: project.files }));
  const cached = await tx<{ key: string; js: string } | undefined>("compiled", "readonly", (s) => s.get(key) as IDBRequest<{ key: string; js: string } | undefined>).catch(() => undefined);
  if (cached) return { ok: true, js: cached.js, cached: true, ms: 0 };

  const worker = new Worker(new URL("./compileWorker.ts", import.meta.url), { type: "module" });
  const result = await new Promise<CompileResult>((resolve) => {
    worker.onmessage = (event: MessageEvent<CompileMessage>) => {
      const m = event.data;
      if (m.type === "progress") onProgress(m.text);
      else if (m.ok) resolve({ ok: true, js: m.js, cached: false, ms: m.ms });
      else {
        const errors = m.diagnostics.map(translateDiagnostic);
        if (m.stage === "teavm" && !errors.length) errors.push("A tradução para o navegador (TeaVM) falhou: o código usa algo que o simulador ainda não tem.");
        if (m.stage === "internal") errors.push(`Erro interno do compilador: ${m.message ?? "desconhecido"}`);
        resolve({ ok: false, errors: [...new Set(errors)].slice(0, 30) });
      }
    };
    worker.onerror = (e) => resolve({ ok: false, errors: [`O compilador não abriu: ${e.message}`] });
    const request: CompileRequest = { files: project.files, opMode: opMode.className, libs: project.libs };
    worker.postMessage(request);
  });
  worker.terminate();
  if (result.ok) await tx("compiled", "readwrite", (s) => s.put({ key, js: result.js, opMode: opMode.className, at: Date.now() })).catch(() => undefined);
  return result;
}

/**
 * Roda um programa já traduzido. A ponte (globalThis.__buzzHw) precisa estar instalada antes.
 * A promessa termina quando o OpMode acaba.
 */
export async function runProgram(js: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([js], { type: "text/javascript" }));
  try {
    const mod = (await import(/* @vite-ignore */ url)) as { createJavaProgram(options: object): Promise<{ execute(): Promise<unknown> }> };
    const program = await mod.createJavaProgram({});
    await program.execute();
  } finally {
    URL.revokeObjectURL(url);
  }
}
