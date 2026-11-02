// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Robôs importados na Oficina, guardados no IndexedDB deste aparelho (nada sai do computador).
// Módulo leve, sem Three.js: a tela "Jogar" só precisa da lista.
import type { RobotPresetId } from "../config/robotPresets";

export interface StoredRobotMeta {
  id: string;
  name: string;
  /** Mecanismos usados pela física (tração, intake, retirada na FLOWER). */
  preset: RobotPresetId;
  /** Caixa envolvente do modelo já orientado (pol): frente–trás, lado a lado, altura. */
  sizeIn: { length: number; width: number; height: number };
  sourceFile: string;
  triangles: number;
  createdAt: number;
}

export interface StoredRobot extends StoredRobotMeta {
  /** Modelo normalizado (metros, frente em +X, piso em y = 0), em GLB. */
  glb: ArrayBuffer;
}

const DB = "buzz-simulator";
const STORE = "robots";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = run(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listRobots(): Promise<StoredRobotMeta[]> {
  try {
    const all = await tx<StoredRobot[]>("readonly", (s) => s.getAll() as IDBRequest<StoredRobot[]>);
    return all.map(({ glb: _glb, ...meta }) => meta).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    // IndexedDB indisponível (janela anônima em alguns navegadores): segue sem robôs importados
    return [];
  }
}

export function getRobot(id: string): Promise<StoredRobot | undefined> {
  return tx<StoredRobot | undefined>("readonly", (s) => s.get(id) as IDBRequest<StoredRobot | undefined>);
}

export async function saveRobot(robot: StoredRobot): Promise<void> {
  await tx("readwrite", (s) => s.put(robot));
}

export async function deleteRobot(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}

/** Valor usado no seletor de robô para um modelo importado. */
export const CAD_PREFIX = "cad:";
