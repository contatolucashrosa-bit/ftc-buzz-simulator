// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Importação de CAD na Oficina: GLB e STL entram direto; STEP pequeno é lido no próprio navegador (OpenCascade em
// WebAssembly). Montagens grandes passam antes pelo conversor `npm run cad:convert` (scripts/step-to-glb.mjs),
// porque o WebAssembly tem limite de memória. O resultado é sempre um modelo normalizado: metros, frente em +X,
// piso em y = 0 e centralizado, guardado como GLB.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** STEP maior que isto vai para o conversor de linha de comando. */
export const BROWSER_STEP_LIMIT_MB = 40;
const INCH = 0.0254;

export type UpAxis = "y" | "z" | "x";

export interface ImportSettings {
  /** Fator para metros (1 = já em metros; 0,001 = milímetros; 0,0254 = polegadas). */
  scale: number;
  /** Eixo que aponta para cima no arquivo original. */
  up: UpAxis;
  /** Giro em torno do eixo vertical, em quartos de volta, para a frente do robô ficar em +X. */
  yawQuarter: number;
}

export interface ImportedCad {
  /** Modelo como veio do arquivo (sem escala nem rotação). */
  raw: THREE.Object3D;
  triangles: number;
  note: string;
}

const extension = (name: string) => name.toLowerCase().split(".").pop() ?? "";

export function isSupportedCad(name: string): boolean {
  return ["glb", "stl", "step", "stp"].includes(extension(name));
}

export async function readCadFile(file: File, onProgress?: (text: string) => void): Promise<ImportedCad> {
  const ext = extension(file.name);
  const data = await file.arrayBuffer();
  let raw: THREE.Object3D;
  let note = "";
  if (ext === "glb") {
    const gltf = await new GLTFLoader().parseAsync(data, "");
    raw = gltf.scene;
  } else if (ext === "stl") {
    const geometry = new STLLoader().parse(data);
    geometry.computeVertexNormals();
    raw = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.3, roughness: 0.6 }));
    note = "STL não guarda cores: o modelo fica cinza.";
  } else if (ext === "step" || ext === "stp") {
    if (file.size > BROWSER_STEP_LIMIT_MB * 1e6) {
      throw new Error(
        `Este STEP tem ${(file.size / 1e6).toFixed(0)} MB. Acima de ${BROWSER_STEP_LIMIT_MB} MB, converta antes com "npm run cad:convert -- arquivo.step robo.glb" e importe o GLB (veja docs/cad-import.md).`,
      );
    }
    onProgress?.("Lendo o STEP (OpenCascade)…");
    raw = await readStep(new Uint8Array(data));
  } else {
    throw new Error("Formato não suportado. Use GLB, STL ou STEP.");
  }
  let triangles = 0;
  raw.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry;
    triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return { raw, triangles: Math.round(triangles), note };
}

async function readStep(bytes: Uint8Array): Promise<THREE.Object3D> {
  const [{ default: occtimportjs }, { default: wasmUrl }] = await Promise.all([
    import("occt-import-js"),
    import("occt-import-js/dist/occt-import-js.wasm?url"),
  ]);
  const occt = await occtimportjs({ locateFile: () => wasmUrl });
  const result = occt.ReadStepFile(bytes, {
    linearUnit: "millimeter",
    linearDeflectionType: "absolute_value",
    linearDeflection: 0.6,
    angularDeflection: 0.6,
  });
  if (!result.success) throw new Error("O OpenCascade não conseguiu ler este STEP.");
  const group = new THREE.Group();
  for (const m of result.meshes) {
    if (!m.attributes.position.array.length) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(m.attributes.position.array, 3));
    if (m.attributes.normal) geometry.setAttribute("normal", new THREE.Float32BufferAttribute(m.attributes.normal.array, 3));
    geometry.setIndex(Array.from(m.index.array));
    const [r, g, b] = m.color ?? [0.6, 0.62, 0.66];
    group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: new THREE.Color(r, g, b), metalness: 0.3, roughness: 0.6 })));
  }
  if (!group.children.length) throw new Error("O STEP foi lido, mas sem geometria. Converta com o script (docs/cad-import.md).");
  return group;
}

/**
 * Chuta a unidade pelo tamanho: um robô de FTC tem entre 10 e 25 pol na maior dimensão.
 * Testa metros, milímetros, polegadas e centímetros e fica com o que cair mais perto de 17 pol.
 */
export function guessScale(raw: THREE.Object3D): number {
  const size = new THREE.Box3().setFromObject(raw).getSize(new THREE.Vector3());
  const largest = Math.max(size.x, size.y, size.z);
  if (!(largest > 0)) return 1;
  const target = 17 * INCH;
  return [1, 0.001, INCH, 0.01].reduce((best, s) => (Math.abs(Math.log((largest * s) / target)) < Math.abs(Math.log((largest * best) / target)) ? s : best), 1);
}

/** Arquivos de CAD (STEP, STL de Onshape/SolidWorks/Fusion) costumam ter Z para cima; GLB tem Y para cima. */
export function guessUp(fileName: string): UpAxis {
  return extension(fileName) === "glb" ? "y" : "z";
}

/** Aplica escala e orientação e devolve um grupo com a frente em +X, piso em y = 0 e centro em x = z = 0. */
export function normalize(raw: THREE.Object3D, settings: ImportSettings): THREE.Group {
  const inner = new THREE.Group();
  inner.add(raw);
  raw.position.set(0, 0, 0);
  raw.rotation.set(0, 0, 0);
  raw.scale.setScalar(settings.scale);
  // leva o eixo "para cima" do arquivo para o +Y do jogo
  if (settings.up === "z") raw.rotation.x = -Math.PI / 2;
  if (settings.up === "x") raw.rotation.z = Math.PI / 2;
  const yaw = new THREE.Group();
  yaw.rotation.y = (settings.yawQuarter * Math.PI) / 2;
  yaw.add(inner);
  const root = new THREE.Group();
  root.add(yaw);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  yaw.position.set(-center.x, -box.min.y, -center.z);
  root.updateMatrixWorld(true);
  return root;
}

/** Tamanho (pol) do modelo normalizado: comprimento em X (frente), largura em Z, altura em Y. */
export function sizeInches(model: THREE.Object3D): { length: number; width: number; height: number } {
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  return { length: size.x / INCH, width: size.z / INCH, height: size.y / INCH };
}

/**
 * Junta tudo em uma malha por cor, já na posição final, e exporta GLB.
 * Poucas malhas = poucas chamadas de desenho, o que mantém o FPS em computadores escolares.
 */
export async function bakeToGlb(model: THREE.Object3D): Promise<{ glb: ArrayBuffer; triangles: number }> {
  model.updateMatrixWorld(true);
  const byColor = new Map<string, { color: THREE.Color; geometries: THREE.BufferGeometry[] }>();
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const color = (materials[0] as THREE.MeshStandardMaterial).color?.clone() ?? new THREE.Color(0x9aa0a8);
    const key = color.getHexString();
    const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    // só posição e normal: atributos diferentes (UV, cor) impedem juntar as geometrias
    for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal") g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    // todas indexadas: o merge mantém o índice e o arquivo não duplica vértices (STL vem sem índice)
    if (!g.index) {
      const count = g.attributes.position.count;
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(Array.from({ length: count }, (_, i) => i)), 1));
    }
    if (!byColor.has(key)) byColor.set(key, { color, geometries: [] });
    byColor.get(key)!.geometries.push(g);
  });
  const scene = new THREE.Scene();
  let triangles = 0;
  for (const { color, geometries } of byColor.values()) {
    const merged = mergeGeometries(geometries, false);
    if (!merged) continue;
    triangles += (merged.index ? merged.index.count : merged.attributes.position.count) / 3;
    scene.add(new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.6, side: THREE.DoubleSide })));
  }
  const glb = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
  return { glb, triangles: Math.round(triangles) };
}

/** Lê um modelo guardado (GLB normalizado) para usar no jogo. */
export async function loadStoredModel(glb: ArrayBuffer): Promise<THREE.Group> {
  const gltf = await new GLTFLoader().parseAsync(glb, "");
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  return gltf.scene;
}
