// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Converte um STEP de robô (montagem grande) em um GLB leve para importar na Oficina.
// Mesma ideia de outros simuladores (o STEP passa por um conversor fora do jogo; o jogo importa GLB/STL),
// mas com código próprio e só Node + occt-import-js, sem Python.
//
// Por que em lotes: o OpenCascade em WebAssembly tem no máximo 4 GB de memória. Uma montagem de 120 MB
// estoura esse limite e as peças voltam sem malha. O script mantém a estrutura da montagem (posições) e
// separa a geometria em lotes de sólidos; cada lote vira um STEP pequeno, lido por uma instância nova.
//
// Uso: node --max-old-space-size=8192 scripts/step-to-glb.mjs entrada.step saida.glb [--batch 8] [--min-size 20] [--deflection 3] [--angular 1.2] [--triangles 250000]
//   --batch     sólidos por lote (padrão 8)
//   --min-size  descarta peças menores que isto em mm na maior dimensão (parafusos, porcas, espaçadores); padrão 20
//   --deflection  erro máximo da malha em mm (maior = arquivo mais leve); padrão 3
//   --angular   desvio angular máximo da malha em radianos; padrão 1.2
//   --triangles meta de triângulos após a simplificação (meshoptimizer); padrão 250000
// Os padrões miram um modelo leve para o jogo (algumas centenas de milhares de triângulos), não para fabricação.
// Um sólido que o OpenCascade não consegue triangular esvazia o lote inteiro: lotes menores perdem menos peças.
import { readFileSync, writeFileSync } from "node:fs";
import occtimportjs from "occt-import-js";
import { simplifyGroups, triangleCount, writeGlb } from "./lib/glb.mjs";

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
const TRIANGLES = option("triangles", 250000);
// --parts (sempre por último): uma malha por peça, sem simplificar. É a entrada de scripts/blender/build_robots.py,
// que refaz o robô peça por peça.
const PARTS = args.includes("--parts");
if (!input || !output) {
  console.error("uso: node scripts/step-to-glb.mjs entrada.step saida.glb [--batch 8] [--min-size 20] [--deflection 3] [--angular 1.2] [--triangles 250000]");
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
    const tint = c.map((v) => Math.round(v * 12) / 12);
    const key = PARTS ? `${tint.join(",")}|${kept}` : tint.join(",");
    if (!groups.has(key)) groups.set(key, { color: tint, positions: [], normals: [], indices: [] });
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

// ---------- GLB (glTF 2.0 binário), em metros, simplificado para o jogo ----------
const MM = 0.001;
const raw = [...groups.values()].map((g) => ({
  color: g.color,
  positions: new Float32Array(g.positions.map((v) => v * MM)),
  normals: new Float32Array(g.normals),
  indices: new Uint32Array(g.indices),
}));
const before = triangleCount(raw);
const simplified = PARTS ? raw : await simplifyGroups(raw, TRIANGLES);
const size = box.min.map((v, k) => box.max[k] - v);
const out = writeGlb(simplified, { source: input.split(/[\\/]/).pop(), sizeMm: size.map((v) => +v.toFixed(1)) });
writeFileSync(output, out);

const inch = size.map((v) => (v / 25.4).toFixed(2));
console.log(`${output}: ${kept} peças (${skippedSmall} pequenas descartadas), ${groups.size} cores, ${before} → ${triangleCount(simplified)} triângulos, ${(out.byteLength / 1e6).toFixed(1)} MB`);
console.log(`caixa: ${size.map((v) => v.toFixed(1)).join(" × ")} mm = ${inch.join(" × ")} pol (eixos do CAD)`);
