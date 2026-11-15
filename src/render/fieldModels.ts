// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Modelos detalhados da arena (HIVE, estrutura e FLOWER), montados no Blender a partir do CAD oficial
// (scripts/blender/build_field.py). São só visuais: a física continua com as formas simples do jogo.
// Se os arquivos não existirem (o CAD fica fora do repositório), o jogo segue com as peças geradas no código.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface FieldModels {
  hive(allianceColor: number): THREE.Object3D;
  hiveFrame(): THREE.Object3D;
  flower(): THREE.Object3D;
}

const DIR = `${import.meta.env.BASE_URL}models/field`;

/** Materiais do jogo, escolhidos pelo nome que o Blender deu a cada parte do modelo. */
function materials(): Record<string, THREE.Material> {
  return {
    polycarbonate: new THREE.MeshStandardMaterial({ color: 0xe6edf2, transparent: true, opacity: 0.2, roughness: 0.12, side: THREE.DoubleSide, depthWrite: false }),
    aluminum: new THREE.MeshStandardMaterial({ color: 0xc4c7cc, metalness: 0.85, roughness: 0.36 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x7d8086, metalness: 0.85, roughness: 0.45 }),
    "black-plastic": new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.5 }),
    panel: new THREE.MeshStandardMaterial({ map: panelTexture(), roughness: 0.55 }),
    pipe: new THREE.MeshStandardMaterial({ color: 0x3fae3a, roughness: 0.42 }),
    "flower-top": new THREE.MeshStandardMaterial({ color: 0xf0b338, roughness: 0.5 }),
    backstop: new THREE.MeshStandardMaterial({ color: 0x8a3fc4, roughness: 0.5, metalness: 0.2 }),
  };
}

/** Painel da estrutura: favos amarelos próprios (a arte oficial tem logotipos, que não reproduzimos). */
function panelTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f4c81e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(120, 82, 0, 0.55)";
  ctx.lineWidth = 3;
  const r = 22;
  for (let row = -1; row < 5; row++) {
    for (let col = -1; col < 16; col++) {
      const cx = col * r * 1.5;
      const cy = row * r * Math.sqrt(3) + (col % 2 ? (r * Math.sqrt(3)) / 2 : 0);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) ctx.lineTo(cx + r * Math.cos((i * Math.PI) / 3), cy + r * Math.sin((i * Math.PI) / 3));
      ctx.closePath();
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function dress(model: THREE.Object3D, mats: Record<string, THREE.Material>, alliance?: THREE.Material): THREE.Object3D {
  model.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const name = (mesh.material as THREE.Material).name;
    mesh.material = name === "alliance" && alliance ? alliance : (mats[name] ?? mesh.material);
    const clear = name === "polycarbonate";
    mesh.castShadow = !clear;
    mesh.receiveShadow = !clear;
    if (clear) mesh.renderOrder = 2;
  });
  return model;
}

/** Carrega os três modelos; devolve null se algum faltar. */
export async function loadFieldModels(): Promise<FieldModels | null> {
  const loader = new GLTFLoader();
  try {
    const [hive, frame, flower] = await Promise.all(["hive", "hive-frame", "flower"].map((name) => loader.loadAsync(`${DIR}/${name}.glb`)));
    const mats = materials();
    return {
      hive: (color) => dress(hive.scene.clone(), mats, new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.1 })),
      hiveFrame: () => dress(frame.scene.clone(), mats),
      flower: () => dress(flower.scene.clone(), mats),
    };
  } catch {
    return null;
  }
}
