// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Converte cada peça única do CAD da arena (pasta de STEPs, uma peça por arquivo) em um GLB em metros,
// no sistema local da própria peça. É a entrada do Blender (scripts/blender/build_field.py), que monta a arena.
// Uso: node scripts/arena-parts.mjs cad/arena cad/arena-parts
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import occtimportjs from "occt-import-js";
import { writeGlb } from "./lib/glb.mjs";

const [dir, out] = process.argv.slice(2);
// ferragens pequenas não aparecem no jogo
const skip = /rivet|screw|nut|washer|Socket|FHTS|Pan head|am-1775|am-1310|am-1483|am-1523|Rivnut|Bearing|Spacer|Cable Tie|Elevator Bolt/i;
const partName = (file) => file.replace(/^am-5850 BIOBUZZ - /, "").replace(/ \(\d+\)(?=\.ste?p$)/i, "").replace(/\.ste?p$/i, "");
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

mkdirSync(out, { recursive: true });
const seen = new Set();
const index = [];
for (const file of readdirSync(dir).filter((f) => /\.ste?p$/i.test(f)).sort()) {
  const name = partName(file);
  if (skip.test(name) || seen.has(name)) continue;
  seen.add(name);
  const occt = await occtimportjs();
  const result = occt.ReadStepFile(new Uint8Array(readFileSync(join(dir, file))), {
    linearUnit: "millimeter",
    linearDeflectionType: "absolute_value",
    linearDeflection: 0.15,
    angularDeflection: 0.25,
  });
  if (!result.success) {
    console.warn(`falhou: ${file}`);
    continue;
  }
  const groups = new Map();
  let triangles = 0;
  for (const mesh of result.meshes) {
    const p = mesh.attributes.position.array;
    if (!p.length) continue;
    const c = mesh.color ?? [0.6, 0.62, 0.66];
    const key = c.map((v) => v.toFixed(3)).join(",");
    if (!groups.has(key)) groups.set(key, { color: c, positions: [], normals: [], indices: [] });
    const g = groups.get(key);
    const base = g.positions.length / 3;
    for (let i = 0; i < p.length; i++) g.positions.push(p[i] * 0.001);
    const n = mesh.attributes.normal?.array;
    for (let i = 0; i < p.length; i++) g.normals.push(n && n.length === p.length ? n[i] : 0);
    for (const i of mesh.index.array) g.indices.push(base + i);
    triangles += mesh.index.array.length / 3;
  }
  const list = [...groups.values()].map((g) => ({
    color: g.color,
    positions: new Float32Array(g.positions),
    normals: new Float32Array(g.normals),
    indices: new Uint32Array(g.indices),
  }));
  writeFileSync(join(out, `${slug(name)}.glb`), writeGlb(list, { source: name }));
  index.push({ name, file: `${slug(name)}.glb`, triangles });
  console.log(`${name}: ${triangles} triângulos`);
}
writeFileSync(join(out, "index.json"), JSON.stringify(index, null, 1));
