// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Corrige a biblioteca de assinaturas do javac do navegador (vendor/teavm-javac/compile-classlib-teavm.bin):
// nela, java.lang.Object é a versão interna do TeaVM (getClass0, wait0, notify0), então código comum como
// `obj.getClass()` não compila (ex.: TuningOpModes do RoadRunner). Trocamos só essa assinatura pela do JDK
// (lib/ct.sym, release 19+). O TeaVM continua implementando getClass/wait/notify na tradução.
// Uso: node scripts/patch-teavm-classlib.mjs   (requer JDK 17+ em JAVA_HOME ou no PATH)
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

const ROOT = resolve(import.meta.dirname, "..");
const BIN = join(ROOT, "vendor", "teavm-javac", "compile-classlib-teavm.bin");
const OBJECT = "java/lang/Object.class";

function parse(buffer) {
  const entries = [];
  let i = 0;
  while (i < buffer.length) {
    const nameLength = buffer.readUInt16BE(i);
    const name = buffer.subarray(i + 2, i + 2 + nameLength).toString("utf8");
    i += 2 + nameLength;
    const dataLength = buffer.readUInt32BE(i);
    entries.push({ name, data: buffer.subarray(i + 4, i + 4 + dataLength) });
    i += 4 + dataLength;
  }
  return entries;
}

function serialize(entries) {
  const parts = [];
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const header = Buffer.alloc(2 + nameBytes.length + 4);
    header.writeUInt16BE(nameBytes.length, 0);
    nameBytes.copy(header, 2);
    header.writeUInt32BE(data.length, 2 + nameBytes.length);
    parts.push(header, data);
  }
  return Buffer.concat(parts);
}

function jdkObjectSignature() {
  const home = process.env.JAVA_HOME;
  const ext = process.platform === "win32" ? ".exe" : "";
  const jar = home && existsSync(join(home, "bin", "jar" + ext)) ? join(home, "bin", "jar" + ext) : "jar";
  const ctSym = home ? join(home, "lib", "ct.sym") : null;
  if (!ctSym || !existsSync(ctSym)) throw new Error("defina JAVA_HOME para um JDK 17+ (precisa de lib/ct.sym)");
  const work = mkdtempSync(join(tmpdir(), "buzz-ctsym-"));
  try {
    execFileSync(jar, ["--extract", "--file", ctSym, "JK/java.base/java/lang/Object.sig"], { cwd: work });
    return readFileSync(join(work, "JK", "java.base", "java", "lang", "Object.sig"));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

const entries = parse(gunzipSync(readFileSync(BIN)));
const object = entries.find((e) => e.name === OBJECT);
if (!object) throw new Error("java/lang/Object.class não encontrado no classlib");
if (!object.data.includes(Buffer.from("getClass0"))) {
  console.log("classlib já corrigido; nada a fazer");
} else {
  object.data = jdkObjectSignature();
  writeFileSync(BIN, gzipSync(serialize(entries), { level: 9 }));
  console.log("classlib corrigido: java.lang.Object agora tem getClass(), wait() e notify()");
}
