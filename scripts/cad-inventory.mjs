// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Inventário de uma pasta de peças STEP: caixa envolvente (mm, sistema global do CAD), volume e nome de cada peça.
// Serve para extrair medidas e posições reais da arena sem redistribuir o CAD.
// Uso: node scripts/cad-inventory.mjs <pasta> <saida.json> [filtro-regex-para-ignorar]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import occtimportjs from "occt-import-js";

const [dir, out, skipPattern = "rivet|screw|nut|washer|Fastener|Socket|FHTS|Pan head|Hinge|am-1775|am-1310|am-1483|am-1523"] = process.argv.slice(2);
const skip = new RegExp(skipPattern, "i");
const occt = await occtimportjs();
const files = readdirSync(dir).filter((f) => /\.ste?p$/i.test(f) && !skip.test(f));
const parts = [];

for (const file of files) {
  const result = occt.ReadStepFile(new Uint8Array(readFileSync(join(dir, file))), {
    linearUnit: "millimeter",
    linearDeflectionType: "bounding_box_ratio",
    linearDeflection: 0.01,
  });
  if (!result.success) {
    parts.push({ file, error: true });
    continue;
  }
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let volume = 0;
  for (const mesh of result.meshes) {
    const p = mesh.attributes.position.array;
    const idx = mesh.index.array;
    for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[i + k]); max[k] = Math.max(max[k], p[i + k]); }
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      volume += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
    }
  }
  const round = (v) => Math.round(v * 10) / 10;
  parts.push({
    file,
    name: result.root?.name || result.meshes[0]?.name || "",
    min: min.map(round),
    max: max.map(round),
    center: min.map((v, k) => round((v + max[k]) / 2)),
    size: min.map((v, k) => round(max[k] - v)),
    volumeCm3: Math.round(Math.abs(volume) / 10) / 100,
  });
}

writeFileSync(out, JSON.stringify(parts, null, 1));
console.log(`${parts.length} peças lidas (${files.length} arquivos; fixadores ignorados)`);
