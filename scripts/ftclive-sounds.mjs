// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Copia os sons de partida do FTC Live instalado neste computador (precisa estar aberto) para
// public/sounds/ftclive/. Os arquivos são da FIRST e ficam fora do git: cada pessoa copia da própria instalação.
// Sem eles, o jogo usa as buzinas sintetizadas.
// Uso: node scripts/ftclive-sounds.mjs [http://localhost] [usuário]   (o usuário padrão do FTC Live é "local", sem senha)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [base = "http://localhost", user = "local"] = process.argv.slice(2);
const out = "public/sounds/ftclive";

// entra com o usuário local para a sessão poder ler o manifesto de assets
const login = await fetch(`${base}/callback/`, {
  method: "POST",
  redirect: "manual",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ username: user, password: "", client_name: "FormClient", submit: "Login" }),
});
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const manifest = await fetch(`${base}/assets/manifest`, { headers: { cookie } }).then((r) => r.json()).catch(() => null);
if (!manifest?.assetManifest) {
  console.error(`Não consegui ler ${base}/assets/manifest. O FTC Live está aberto e o usuário "${user}" existe?`);
  process.exit(1);
}
mkdirSync(out, { recursive: true });
for (const [name, path] of Object.entries(manifest.assetManifest)) {
  if (!/^audio\/[\w-]+\.flac$/.test(name)) continue;
  const response = await fetch(`${manifest.baseUrl ?? `${base}/`}${path}`.replace(/^\//, `${base}/`), { headers: { cookie } });
  const bytes = new Uint8Array(await response.arrayBuffer());
  // "fLaC" no início: garante que veio áudio, e não a página de login
  if (!response.ok || bytes[0] !== 0x66 || bytes[1] !== 0x4c) {
    console.warn(`falhou: ${name}`);
    continue;
  }
  const file = name.slice("audio/".length);
  writeFileSync(join(out, file), bytes);
  console.log(`${file}: ${(bytes.length / 1024).toFixed(0)} kB`);
}
