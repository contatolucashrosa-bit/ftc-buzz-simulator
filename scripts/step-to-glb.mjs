// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Converte um STEP de robô (montagem grande) em um GLB leve para importar na Oficina.
// Mesma ideia de outros simuladores (o STEP passa por um conversor fora do jogo; o jogo importa GLB/STL),
// mas com código próprio e só Node + occt-import-js, sem Python.
//
// Por que em lotes: o OpenCascade em WebAssembly tem no máximo 4 GB de memória. Uma montagem de 120 MB
// estoura esse limite e as peças voltam sem malha. O script mantém a estrutura da montagem (posições) e
// separa a geometria em lotes de sólidos; cada lote vira um STEP pequeno, lido por uma instância nova.
//
// Uso: node --max-old-space-size=8192 scripts/step-to-glb.mjs entrada.step saida.glb [--batch 8] [--min-size 20] [--deflection 3] [--angular 1.2]
//   --batch     sólidos por lote (padrão 8)
//   --min-size  descarta peças menores que isto em mm na maior dimensão (parafusos, porcas, espaçadores); padrão 20
//   --deflection  erro máximo da malha em mm (maior = arquivo mais leve); padrão 3
//   --angular   desvio angular máximo da malha em radianos; padrão 1.2
// Os padrões miram um modelo leve para o jogo (algumas centenas de milhares de triângulos), não para fabricação.
// Um sólido que o OpenCascade não consegue triangular esvazia o lote inteiro: lotes menores perdem menos peças.
import { readFileSync, writeFileSync } from "node:fs";
import occtimportjs from "occt-import-js";

const args = process.argv.slice(2);
const [input, output] = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const BATCH = option("batch", 8);
const MIN_SIZE_MM = option("min-size", 20);
const DEFLECTION_MM = option("deflection", 3);
const ANGULAR = option("angular", 1.2);
if (!input || !output) {
  console.error("uso: node scripts/step-to-glb.mjs entrada.step saida.glb [--batch 8] [--min-size 20] [--deflection 3] [--angular 1.2]");
  process.exit(1);
}

// ---------- leitura do STEP em entidades ----------
const text = readFileSync(input, "latin1");
const dataStart = text.indexOf("DATA;") + 5;
const dataEnd = text.lastIndexOf("ENDSEC;");
const header = text.slice(0, dataStart);
const footer = "ENDSEC;\nEND-ISO-10303-21;\n";

/** id → { type, body } ; body é o texto depois do "=" (sem o ";"). */
const entities = new Map();
{
  let i = dataStart;
  let start = i;
  let inString = false;
  while (i < dataEnd) {
    const ch = text.charCodeAt(i);
    if (ch === 39 /* ' */) inString = !inString;
    else if (ch === 59 /* ; */ && !inString) {
      const raw = text.slice(start, i).trim();
      start = i + 1;
      const eq = raw.indexOf("=");
      if (raw.startsWith("#") && eq > 0) {
        const id = Number(raw.slice(1, eq).trim());
        const body = raw.slice(eq + 1).trim();
        const type = body.startsWith("(") ? "(COMPLEX)" : body.slice(0, body.indexOf("(")).trim();
        entities.set(id, { type, body });
      }
    }
    i++;
  }
}
const refsOf = (body) => {
  const out = [];
  // ignora referências dentro de strings
  const clean = body.replace(/'[^']*'/g, "''");
  for (const m of clean.matchAll(/#(\d+)/g)) out.push(Number(m[1]));
  return out;
};
console.log(`${input}: ${entities.size} entidades`);

// Geometria e topologia: só entram se algum sólido mantido as usar.
const GEOMETRY = /^(\(COMPLEX\)|CARTESIAN_POINT|DIRECTION|VECTOR|LINE|CIRCLE|ELLIPSE|HYPERBOLA|PARABOLA|POLYLINE|B_SPLINE_\w+|BEZIER_\w+|RATIONAL_\w+|TRIMMED_CURVE|COMPOSITE_CURVE\w*|PCURVE|SURFACE_CURVE|SEAM_CURVE|INTERSECTION_CURVE|DEFINITIONAL_REPRESENTATION|VERTEX_POINT|EDGE_CURVE|ORIENTED_EDGE|EDGE_LOOP|VERTEX_LOOP|POLY_LOOP|FACE_BOUND|FACE_OUTER_BOUND|ADVANCED_FACE|FACE_SURFACE|PLANE|CYLINDRICAL_SURFACE|CONICAL_SURFACE|SPHERICAL_SURFACE|TOROIDAL_SURFACE|DEGENERATE_TOROIDAL_SURFACE|SURFACE_OF_\w+|OFFSET_\w+|RECTANGULAR_TRIMMED_SURFACE|CLOSED_SHELL|OPEN_SHELL|ORIENTED_CLOSED_SHELL|CONNECTED_FACE_SET|MANIFOLD_SOLID_BREP|BREP_WITH_VOIDS|SHELL_BASED_SURFACE_MODEL)$/;
const SOLID = /^(MANIFOLD_SOLID_BREP|BREP_WITH_VOIDS|SHELL_BASED_SURFACE_MODEL)$/;
const STYLE_ROOT = /^(STYLED_ITEM|OVER_RIDING_STYLED_ITEM)$/;

const solids = [...entities].filter(([, e]) => SOLID.test(e.type)).map(([id]) => id);
console.log(`${solids.length} sólidos; lotes de ${BATCH}`);

/** Remove de `body` as referências fora de `included`; devolve null se alguma for argumento direto. */
function pruneRefs(body, included) {
  let out = "";
  let depth = 0;
  let inString = false;
  let i = 0;
  // profundidade do argumento direto: 1 numa entidade simples, 2 numa entidade complexa "( A(...) B(...) )"
  const direct = body.startsWith("(") ? 2 : 1;
  while (i < body.length) {
    const ch = body[i];
    if (ch === "'") inString = !inString;
    if (!inString && ch === "#") {
      let k = i + 1;
      while (k < body.length && body[k] >= "0" && body[k] <= "9") k++;
      const ref = Number(body.slice(i + 1, k));
      if (!included.has(ref)) {
        if (depth <= direct) return null;
        // apaga a vírgula vizinha
        const trimmed = out.replace(/\s*,\s*$/, "");
        if (trimmed.length !== out.length) out = trimmed;
        else {
          while (k < body.length && /[\s,]/.test(body[k])) k++;
        }
        i = k;
        continue;
      }
      out += body.slice(i, k);
      i = k;
      continue;
    }
    if (!inString && ch === "(") depth++;
    if (!inString && ch === ")") depth--;
    out += ch;
    i++;
  }
  return out;
}

/** Escreve um STEP que contém a estrutura inteira, mas só a geometria dos sólidos em `keep`. */
function batchStep(keep) {
  const included = new Set();
  const stack = [];
  for (const [id, e] of entities) {
    if (SOLID.test(e.type) ? keep.has(id) : !GEOMETRY.test(e.type) && !STYLE_ROOT.test(e.type)) stack.push(id);
  }
  while (stack.length) {
    const id = stack.pop();
    if (included.has(id)) continue;
    const e = entities.get(id);
    if (!e) continue;
    // um sólido fora do lote nunca entra, mesmo se alguma representação o citar
    if (SOLID.test(e.type) && !keep.has(id)) continue;
    included.add(id);
    for (const r of refsOf(e.body)) if (!included.has(r)) stack.push(r);
  }
  // estilos (cores) só dos itens que ficaram
  for (const [id, e] of entities) {
    if (!STYLE_ROOT.test(e.type)) continue;
    const refs = refsOf(e.body);
    const target = refs[refs.length - 1];
    if (included.has(target)) {
      const s = [id];
      while (s.length) {
        const x = s.pop();
        if (included.has(x)) continue;
        const ex = entities.get(x);
        if (!ex) continue;
        included.add(x);
        for (const r of refsOf(ex.body)) if (!included.has(r)) s.push(r);
      }
    }
  }
  // Referência a algo que ficou de fora: dentro de uma lista (profundidade ≥ 2) é só removida;
  // como argumento direto (profundidade 1), a entidade também sai. Repete até estabilizar.
  const bodies = new Map();
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...included]) {
      const body = bodies.get(id) ?? entities.get(id).body;
      if (!refsOf(body).some((r) => !included.has(r))) continue;
      const next = pruneRefs(body, included);
      if (next === null) {
        included.delete(id);
      } else {
        bodies.set(id, next);
      }
      changed = true;
    }
  }
  const lines = [];
  for (const id of [...included].sort((a, b) => a - b)) lines.push(`#${id}=${bodies.get(id) ?? entities.get(id).body};`);
  return header + "\n" + lines.join("\n") + "\n" + footer;
}

// ---------- malhas de cada lote ----------
const groups = new Map(); // cor → { positions: number[], normals: number[], indices: number[] }
const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
let kept = 0;
let skippedSmall = 0;
const t0 = Date.now();
for (let b = 0; b < solids.length; b += BATCH) {
  const keep = new Set(solids.slice(b, b + BATCH));
  const step = batchStep(keep);
  const occt = await occtimportjs();
  const result = occt.ReadStepFile(new TextEncoder().encode(step), {
    linearUnit: "millimeter",
    linearDeflectionType: "absolute_value",
    linearDeflection: DEFLECTION_MM,
    angularDeflection: ANGULAR,
  });
  if (!result.success) {
    console.warn(`  lote ${b / BATCH + 1}: falha na leitura`);
    continue;
  }
  let empty = 0;
  for (const mesh of result.meshes) {
    const p = mesh.attributes.position.array;
    if (!p.length) {
      empty++;
      continue;
    }
    const mn = [Infinity, Infinity, Infinity];
    const mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[i + k]); mx[k] = Math.max(mx[k], p[i + k]); }
    if (Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) < MIN_SIZE_MM) {
      skippedSmall++;
      continue;
    }
    for (let k = 0; k < 3; k++) { box.min[k] = Math.min(box.min[k], mn[k]); box.max[k] = Math.max(box.max[k], mx[k]); }
    const c = mesh.color ?? [0.6, 0.62, 0.66];
    // agrupa por cor (quantizada): poucas chamadas de desenho no jogo
    const key = c.map((v) => Math.round(v * 12) / 12).join(",");
    if (!groups.has(key)) groups.set(key, { color: key.split(",").map(Number), positions: [], normals: [], indices: [] });
    const g = groups.get(key);
    const base = g.positions.length / 3;
    for (let i = 0; i < p.length; i++) g.positions.push(p[i]);
    const n = mesh.attributes.normal?.array;
    if (n && n.length === p.length) for (let i = 0; i < n.length; i++) g.normals.push(n[i]);
    else for (let i = 0; i < p.length; i++) g.normals.push(0);
    for (const i of mesh.index.array) g.indices.push(base + i);
    kept++;
  }
  console.log(`  lote ${b / BATCH + 1}/${Math.ceil(solids.length / BATCH)}: ${result.meshes.length} malhas (${empty} vazias) · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

// ---------- GLB (glTF 2.0 binário), em metros ----------
const MM = 0.001;
const meshes = [];
const accessors = [];
const bufferViews = [];
const materials = [];
const chunks = [];
let offset = 0;
const pushView = (typed, target) => {
  const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
  const pad = (4 - (bytes.byteLength % 4)) % 4;
  bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.byteLength, target });
  chunks.push(bytes, new Uint8Array(pad));
  offset += bytes.byteLength + pad;
  return bufferViews.length - 1;
};
let triangles = 0;
for (const g of groups.values()) {
  const pos = new Float32Array(g.positions.map((v) => v * MM));
  const nor = new Float32Array(g.normals);
  const idx = new Uint32Array(g.indices);
  triangles += idx.length / 3;
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[i + k]); mx[k] = Math.max(mx[k], pos[i + k]); }
  accessors.push({ bufferView: pushView(pos, 34962), componentType: 5126, count: pos.length / 3, type: "VEC3", min: mn, max: mx });
  accessors.push({ bufferView: pushView(nor, 34962), componentType: 5126, count: nor.length / 3, type: "VEC3" });
  accessors.push({ bufferView: pushView(idx, 34963), componentType: 5125, count: idx.length, type: "SCALAR" });
  materials.push({ pbrMetallicRoughness: { baseColorFactor: [...g.color, 1], metallicFactor: 0.2, roughnessFactor: 0.6 }, doubleSided: true });
  meshes.push({ primitives: [{ attributes: { POSITION: accessors.length - 3, NORMAL: accessors.length - 2 }, indices: accessors.length - 1, material: materials.length - 1 }] });
}
const size = box.min.map((v, k) => box.max[k] - v);
const gltf = {
  asset: { version: "2.0", generator: "Buzz Simulator step-to-glb" },
  scene: 0,
  scenes: [{ nodes: meshes.map((_, i) => i) }],
  nodes: meshes.map((_, i) => ({ mesh: i })),
  meshes,
  materials,
  accessors,
  bufferViews,
  buffers: [{ byteLength: offset }],
  extras: { source: input.split(/[\\/]/).pop(), sizeMm: size.map((v) => +v.toFixed(1)) },
};
const json = new TextEncoder().encode(JSON.stringify(gltf));
const jsonPad = (4 - (json.byteLength % 4)) % 4;
const bin = new Uint8Array(offset);
let o = 0;
for (const c of chunks) {
  bin.set(c, o);
  o += c.byteLength;
}
const total = 12 + 8 + json.byteLength + jsonPad + 8 + bin.byteLength;
const out = new Uint8Array(total);
const view = new DataView(out.buffer);
view.setUint32(0, 0x46546c67, true); // "glTF"
view.setUint32(4, 2, true);
view.setUint32(8, total, true);
view.setUint32(12, json.byteLength + jsonPad, true);
view.setUint32(16, 0x4e4f534a, true); // "JSON"
out.set(json, 20);
out.fill(0x20, 20 + json.byteLength, 20 + json.byteLength + jsonPad);
const binStart = 20 + json.byteLength + jsonPad;
view.setUint32(binStart, bin.byteLength, true);
view.setUint32(binStart + 4, 0x004e4942, true); // "BIN"
out.set(bin, binStart + 8);
writeFileSync(output, out);

const inch = size.map((v) => (v / 25.4).toFixed(2));
console.log(`${output}: ${kept} peças (${skippedSmall} pequenas descartadas), ${groups.size} cores, ${triangles} triângulos, ${(total / 1e6).toFixed(1)} MB`);
console.log(`caixa: ${size.map((v) => v.toFixed(1)).join(" × ")} mm = ${inch.join(" × ")} pol (eixos do CAD)`);
