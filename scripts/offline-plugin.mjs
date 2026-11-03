// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Plugin do Vite que gera o service worker (modo offline) com a lista de arquivos do build.
// Fica em .mjs para usar as APIs do Node sem colocar os tipos do Node no código do jogo.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** Opcionais e grandes: entram no cache só quando usados (ex.: ler STEP no navegador, 7,6 MB). */
const SKIP_PRECACHE = [/occt-import-js.*\.wasm$/, /\.map$/, /^branding\/LEIA-ME\.md$/];

function listPublic(dir, root = dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listPublic(path, root) : [relative(root, path).replace(/\\/g, "/")];
  });
}

/** Gera o service worker com a lista de arquivos do build, para o app abrir sem internet. */
export function offline() {
  return {
    name: "buzz-offline",
    apply: "build",
    enforce: "post",
    generateBundle(_, bundle) {
      const files = [...Object.keys(bundle), ...listPublic("public")].filter((f) => !SKIP_PRECACHE.some((re) => re.test(f)));
      const precache = ["./", ...files.map((f) => `./${f}`)];
      const template = readFileSync("scripts/sw-template.js", "utf8");
      // muda quando muda a lista de arquivos ou o próprio service worker
      const version = createHash("sha256").update(precache.join("\n")).update(template).digest("hex").slice(0, 12);
      const source = template.replace('const VERSION = "__VERSION__";', `const VERSION = "${version}";`).replace("const PRECACHE = __PRECACHE__;", `const PRECACHE = ${JSON.stringify(precache, null, 1)};`);
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

