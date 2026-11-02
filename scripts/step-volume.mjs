// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Calcula volume (cm³) e dimensões de um arquivo STEP, para estimar massas a partir do CAD oficial.
// Uso: node scripts/step-volume.mjs arquivo.step [densidade g/cm³ ...]
import { readFileSync } from "node:fs";
import occtimportjs from "occt-import-js";

const [file, ...densities] = process.argv.slice(2);
const occt = await occtimportjs();
const result = occt.ReadStepFile(new Uint8Array(readFileSync(file)), { linearUnit: "millimeter", linearDeflectionType: "absolute_value", linearDeflection: 0.02, angularDeflection: 0.1 });
if (!result.success) throw new Error("não foi possível ler o STEP");

let volumeMm3 = 0;
const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (const mesh of result.meshes) {
  const p = mesh.attributes.position.array;
  const idx = mesh.index.array;
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[i + k]); max[k] = Math.max(max[k], p[i + k]); }
  // teorema da divergência: soma dos tetraedros (origem + triângulo)
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    volumeMm3 += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
  }
}
const cm3 = Math.abs(volumeMm3) / 1000;
const size = max.map((v, k) => (v - min[k]).toFixed(1));
console.log(`${file}: ${result.meshes.length} malha(s), dimensões ${size.join(" × ")} mm, volume ${cm3.toFixed(2)} cm³`);
for (const d of densities.map(Number)) console.log(`  densidade ${d} g/cm³ → ${(cm3 * d).toFixed(1)} g`);
