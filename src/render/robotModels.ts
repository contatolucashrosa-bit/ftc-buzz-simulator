// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Modelos dos starter bots feitos a partir dos CADs oficiais (scripts/blender/build_robots.py): frente em +X,
// piso em y = 0, em metros. Ficam fora do repositório; sem o arquivo, o robô usa o modelo gerado no código.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { RobotPresetId } from "../config/robotPresets";

const cache = new Map<RobotPresetId, Promise<THREE.Object3D | null>>();

function load(id: RobotPresetId): Promise<THREE.Object3D | null> {
  let pending = cache.get(id);
  if (!pending) {
    pending = new GLTFLoader()
      .loadAsync(`${import.meta.env.BASE_URL}models/robots/${id}.glb`)
      .then((gltf) => {
        return gltf.scene as THREE.Object3D;
      })
      .catch(() => null);
    cache.set(id, pending);
  }
  return pending;
}

/** Carrega os modelos dos presets pedidos; devolve uma fábrica de cópias (a geometria é compartilhada). */
export async function loadRobotModels(ids: RobotPresetId[]): Promise<(id: RobotPresetId) => THREE.Object3D | undefined> {
  const unique = [...new Set(ids)].filter((id) => id !== "generic");
  const models = new Map<RobotPresetId, THREE.Object3D>();
  await Promise.all(unique.map(async (id) => {
    const model = await load(id);
    if (model) models.set(id, model);
  }));
  return (id) => models.get(id)?.clone();
}
