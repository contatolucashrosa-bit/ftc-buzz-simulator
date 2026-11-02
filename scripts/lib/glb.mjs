// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// GLB simples usado pelos conversores de CAD: uma malha por cor, só posição (m), normal e índices.
import { MeshoptSimplifier } from "meshoptimizer";

/**
 * @typedef {{ color: number[], positions: Float32Array, normals: Float32Array, indices: Uint32Array }} ColorGroup
 */

/** @param {ColorGroup[]} groups */
export function writeGlb(groups, extras = {}) {
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
  for (const g of groups) {
    const mn = [Infinity, Infinity, Infinity];
    const mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < g.positions.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], g.positions[i + k]); mx[k] = Math.max(mx[k], g.positions[i + k]); }
    accessors.push({ bufferView: pushView(g.positions, 34962), componentType: 5126, count: g.positions.length / 3, type: "VEC3", min: mn, max: mx });
    accessors.push({ bufferView: pushView(g.normals, 34962), componentType: 5126, count: g.normals.length / 3, type: "VEC3" });
    accessors.push({ bufferView: pushView(g.indices, 34963), componentType: 5125, count: g.indices.length, type: "SCALAR" });
    materials.push({ pbrMetallicRoughness: { baseColorFactor: [...g.color, 1], metallicFactor: 0.2, roughnessFactor: 0.6 }, doubleSided: true });
    meshes.push({ primitives: [{ attributes: { POSITION: accessors.length - 3, NORMAL: accessors.length - 2 }, indices: accessors.length - 1, material: materials.length - 1 }] });
  }
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
    extras,
  };
  const json = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonPad = (4 - (json.byteLength % 4)) % 4;
  const total = 12 + 8 + json.byteLength + jsonPad + 8 + offset;
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
  view.setUint32(binStart, offset, true);
  view.setUint32(binStart + 4, 0x004e4942, true); // "BIN"
  let o = binStart + 8;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  return out;
}

/** Lê um GLB gravado por `writeGlb`. @returns {{ groups: ColorGroup[], extras: object }} */
export function readGlb(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonLength = view.getUint32(12, true);
  const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)));
  const binStart = 20 + jsonLength + 8;
  const read = (accessorIndex, Type) => {
    const a = gltf.accessors[accessorIndex];
    const v = gltf.bufferViews[a.bufferView];
    const width = a.type === "VEC3" ? 3 : 1;
    return new Type(bytes.slice(binStart + v.byteOffset, binStart + v.byteOffset + a.count * width * Type.BYTES_PER_ELEMENT).buffer);
  };
  const groups = gltf.meshes.map((mesh) => {
    const p = mesh.primitives[0];
    return {
      color: gltf.materials[p.material].pbrMetallicRoughness.baseColorFactor.slice(0, 3),
      positions: read(p.attributes.POSITION, Float32Array),
      normals: read(p.attributes.NORMAL, Float32Array),
      indices: read(p.indices, Uint32Array),
    };
  });
  return { groups, extras: gltf.extras ?? {} };
}

export const triangleCount = (groups) => groups.reduce((n, g) => n + g.indices.length / 3, 0);

/**
 * Reduz o total para ~`targetTriangles` com o meshoptimizer.
 * As malhas do OpenCascade vêm com cada face separada; os vértices de mesma posição são unidos antes,
 * senão as bordas entre faces travam a simplificação. Peças soltas muito pequenas são podadas ("Prune").
 * @param {ColorGroup[]} groups
 */
export async function simplifyGroups(groups, targetTriangles) {
  await MeshoptSimplifier.ready;
  const total = triangleCount(groups);
  if (total <= targetTriangles) return groups;
  const ratio = targetTriangles / total;
  return groups.map((g) => {
    const remap = MeshoptSimplifier.generatePositionRemap(g.positions, 3);
    const welded = g.indices.map((i) => remap[i]);
    const target = Math.max(3, Math.floor((welded.length * ratio) / 3) * 3);
    let [out] = MeshoptSimplifier.simplify(welded, g.positions, 3, target, 0.01, ["Prune"]);
    // limite de erro atingido antes da meta: completa com o modo "sloppy", mais agressivo
    if (out.length > target * 1.5) [out] = MeshoptSimplifier.simplifySloppy(out, g.positions, 3, null, target, 0.02);
    // compacta: só os vértices usados
    const map = new Map();
    const positions = [];
    const normals = [];
    const indices = new Uint32Array(out.length);
    for (let i = 0; i < out.length; i++) {
      const v = out[i];
      let n = map.get(v);
      if (n === undefined) {
        n = map.size;
        map.set(v, n);
        positions.push(g.positions[v * 3], g.positions[v * 3 + 1], g.positions[v * 3 + 2]);
        normals.push(g.normals[v * 3], g.normals[v * 3 + 1], g.normals[v * 3 + 2]);
      }
      indices[i] = n;
    }
    return { color: g.color, positions: new Float32Array(positions), normals: new Float32Array(normals), indices };
  });
}
