// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Deixa um GLB do conversor mais leve para o jogo, sem converter o STEP de novo.
// Uso: node scripts/glb-simplify.mjs entrada.glb saida.glb [--triangles 250000]
import { readFileSync, writeFileSync } from "node:fs";
import { readGlb, simplifyGroups, triangleCount, writeGlb } from "./lib/glb.mjs";

const args = process.argv.slice(2);
const [input, output] = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const ti = args.indexOf("--triangles");
const target = ti >= 0 ? Number(args[ti + 1]) : 250000;
if (!input || !output) {
  console.error("uso: node scripts/glb-simplify.mjs entrada.glb saida.glb [--triangles 250000]");
  process.exit(1);
}
const { groups, extras } = readGlb(new Uint8Array(readFileSync(input)));
const before = triangleCount(groups);
const simplified = await simplifyGroups(groups, target);
const out = writeGlb(simplified, extras);
writeFileSync(output, out);
console.log(`${output}: ${before} → ${triangleCount(simplified)} triângulos, ${(out.byteLength / 1e6).toFixed(1)} MB`);
