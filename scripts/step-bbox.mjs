// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Caixa envolvente de uma montagem STEP grande (mm) e das peças de primeiro nível, para medir robôs de referência.
// Uso: node --max-old-space-size=8192 scripts/step-bbox.mjs arquivo.step saida.json
import { readFileSync, writeFileSync } from "node:fs";
import occtimportjs from "occt-import-js";

const [file, out] = process.argv.slice(2);
const occt = await occtimportjs();
const t0 = Date.now();
// malha bem grosseira: só precisamos de dimensões
const result = occt.ReadStepFile(new Uint8Array(readFileSync(file)), {
  linearUnit: "inch",
  // desvio absoluto (pol): o relativo à caixa envolvente gerava malhas NaN nas montagens grandes
  linearDeflectionType: "absolute_value",
  linearDeflection: 0.2,
  angularDeflection: 1.0,
});
if (!result.success) throw new Error("falha ao ler " + file);

function boxOf(meshIndices) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const i of meshIndices) {
    const p = result.meshes[i].attributes.position.array;
    for (let j = 0; j < p.length; j += 3) {
      // algumas malhas de montagens grandes vêm com vértices NaN, que contaminariam a caixa inteira
      if (!Number.isFinite(p[j]) || !Number.isFinite(p[j + 1]) || !Number.isFinite(p[j + 2])) continue;
      for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[j + k]); max[k] = Math.max(max[k], p[j + k]); }
    }
  }
  return { min: min.map((v) => +v.toFixed(2)), max: max.map((v) => +v.toFixed(2)), size: min.map((v, k) => +(max[k] - v).toFixed(2)) };
}

function collect(node) {
  const meshes = [...(node.meshes ?? [])];
  for (const child of node.children ?? []) meshes.push(...collect(child));
  return meshes;
}

const all = result.meshes.map((_, i) => i);
const summary = {
  file,
  seconds: (Date.now() - t0) / 1000,
  meshes: result.meshes.length,
  total: boxOf(all),
  parts: (result.root.children ?? []).map((c) => ({ name: c.name, ...boxOf(collect(c)) })).filter((p) => Number.isFinite(p.size[0])),
};
writeFileSync(out, JSON.stringify(summary, null, 1));
console.log(`${file}: ${summary.meshes} malhas em ${summary.seconds}s; caixa total ${summary.total.size.join(" × ")} pol`);
