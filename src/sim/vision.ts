// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Visão simulada: AprilTags (36h11, 3,25 pol, IDs 30–45) na face de baixo de cada CELL das HIVEs (§9.9)
// e uma câmera "pinhole" no robô. Em vez de processar imagem, a detecção é geométrica: a tag aparece quando
// está no campo de visão, perto o bastante e virada para a câmera. Não há oclusão por robôs ou elementos.
import { RAW_RULES, type Alliance } from "../rules/rules";
import { HIVE } from "./geometry";

type Vec = { x: number; y: number; z: number };

export const TAG_SIZE_IN: number = RAW_RULES.field.aprilTags.size;
/** A tira oficial tem 17 pol com 4 tags: centro a centro de 4,25 pol (CAD am-5888). */
const TAG_PITCH_IN = 17 / 4;
/** Além disso a tag fica pequena demais na imagem para o detector (≈ 14 px a 640 × 480). */
const MAX_RANGE_IN = 144;
/** Visada muito oblíqua deforma a tag e o detector perde (graus a partir da normal). */
const MAX_VIEW_ANGLE_DEG = 70;
/** Margem na borda da imagem: a tag inteira precisa caber. */
const EDGE_PX = 10;

export interface FieldTag {
  id: number;
  alliance: Alliance;
  /** Lado da CELL: +1 = fundo (+y), -1 = plateia (-y). */
  side: 1 | -1;
  center: Vec;
  /** Normal da face impressa (aponta para fora da tag). */
  normal: Vec;
  /** Eixo "direita" da tag impressa. */
  right: Vec;
}

export interface CameraIntrinsics {
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
}

/** Logitech C920 a 640 × 480, a calibração que o SDK usa por padrão. */
export const DEFAULT_INTRINSICS: CameraIntrinsics = { fx: 622.001, fy: 622.001, cx: 319.803, cy: 241.251, width: 640, height: 480 };

/**
 * Câmera no robô, na convenção do SDK (setCameraPose): posição em pol com x para a direita, y para a frente
 * e z para cima a partir do centro do robô; yaw/pitch/roll em graus. Com tudo zero a câmera olha para cima;
 * pitch -90 olha para a frente na horizontal.
 */
export interface CameraMount {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
}

/** Montagem padrão: na frente do robô, a 8 pol do chão, inclinada 25° para cima (as tags ficam no alto). */
export const DEFAULT_MOUNT: CameraMount = { x: 0, y: 7, z: 8, yaw: 0, pitch: -65, roll: 0 };

export interface TagDetection {
  id: number;
  /** Pose da tag em relação à câmera (AprilTagPoseFtc): pol e graus. */
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  range: number;
  bearing: number;
  elevation: number;
  /** Centro da tag na imagem (px). */
  centerPx: { x: number; y: number };
  /** Tamanho aparente (px), usado como "decision margin". */
  sizePx: number;
}

const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const deg = (rad: number) => (rad * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

function rotX(v: Vec, a: number): Vec {
  return { x: v.x, y: v.y * Math.cos(a) - v.z * Math.sin(a), z: v.y * Math.sin(a) + v.z * Math.cos(a) };
}

function rotZ(v: Vec, a: number): Vec {
  return { x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a), z: v.z };
}

/** IDs por CELL, na ordem do arquivo de regras (§9.9). */
function idsFor(alliance: Alliance, side: 1 | -1): number[] {
  const cell = `${alliance}-${side === 1 ? "rear" : "audience"}`;
  return RAW_RULES.field.aprilTags.clusters.find((c) => c.cell === cell)!.ids;
}

/**
 * Tags de uma HIVE com a inclinação atual (`angle`, rad, como TipLogic.angle).
 * A ordem dos IDs ao longo da CELL (crescendo em +x) é suposição até a conferência com o CAD oficial.
 */
export function hiveTags(alliance: Alliance, angle: number): FieldTag[] {
  const tags: FieldTag[] = [];
  for (const side of [1, -1] as const) {
    const ly = side * (HIVE.cellInnerY + HIVE.cellDepth / 2);
    const lz = HIVE.cellBottomZ - 0.25;
    idsFor(alliance, side).forEach((id, i) => {
      const lx = (i - 1.5) * TAG_PITCH_IN;
      const local = rotX({ x: lx, y: ly, z: lz }, angle);
      tags.push({
        id,
        alliance,
        side,
        center: { x: HIVE.centerX[alliance] + local.x, y: local.y, z: HIVE.pivotHeight + local.z },
        normal: rotX({ x: 0, y: 0, z: -1 }, angle),
        right: { x: 1, y: 0, z: 0 },
      });
    });
  }
  return tags;
}

/** Eixos da câmera no campo: direita, frente (eixo óptico) e cima da imagem. */
export function cameraFrame(robot: { x: number; y: number; heading: number }, mount: CameraMount): { pos: Vec; right: Vec; forward: Vec; up: Vec } {
  // no robô (x direita, y frente, z cima), a câmera "zerada" olha para +z com a imagem "para cima" em -y
  const orient = (v: Vec) => rotZ(rotX(rotZ(v, rad(mount.roll)), rad(mount.pitch)), rad(mount.yaw));
  const camRight = orient({ x: 1, y: 0, z: 0 });
  const camForward = orient({ x: 0, y: 0, z: 1 });
  const camUp = orient({ x: 0, y: -1, z: 0 });
  // robô → campo: frente do robô = heading; direita = heading - 90°
  const h = robot.heading;
  const toField = (v: Vec): Vec => ({
    x: v.y * Math.cos(h) + v.x * Math.sin(h),
    y: v.y * Math.sin(h) - v.x * Math.cos(h),
    z: v.z,
  });
  const offset = toField({ x: mount.x, y: mount.y, z: 0 });
  return {
    pos: { x: robot.x + offset.x, y: robot.y + offset.y, z: mount.z },
    right: toField(camRight),
    forward: toField(camForward),
    up: toField(camUp),
  };
}

/** Tags visíveis para a câmera, ordenadas da mais próxima para a mais distante. */
export function detectTags(
  robot: { x: number; y: number; heading: number },
  tags: FieldTag[],
  mount: CameraMount = DEFAULT_MOUNT,
  intr: CameraIntrinsics = DEFAULT_INTRINSICS,
): TagDetection[] {
  const cam = cameraFrame(robot, mount);
  const found: TagDetection[] = [];
  for (const tag of tags) {
    const d = sub(tag.center, cam.pos);
    const x = dot(d, cam.right);
    const y = dot(d, cam.forward);
    const z = dot(d, cam.up);
    if (y <= 1) continue;
    const range = Math.hypot(x, y, z);
    if (range > MAX_RANGE_IN) continue;
    // a face impressa precisa estar virada para a câmera
    const toCam = sub(cam.pos, tag.center);
    if (dot(tag.normal, toCam) / range < Math.cos(rad(MAX_VIEW_ANGLE_DEG))) continue;
    const u = intr.cx + (intr.fx * x) / y;
    const v = intr.cy - (intr.fy * z) / y;
    const sizePx = (intr.fx * TAG_SIZE_IN) / range;
    const half = sizePx / 2 + EDGE_PX;
    if (u < half || u > intr.width - half || v < half || v > intr.height - half) continue;
    // orientação da tag vista pela câmera: normal e eixo "direita" no referencial da câmera
    const n = { x: dot(tag.normal, cam.right), y: dot(tag.normal, cam.forward), z: dot(tag.normal, cam.up) };
    const r = { x: dot(tag.right, cam.right), z: dot(tag.right, cam.up) };
    found.push({
      id: tag.id,
      x,
      y,
      z,
      yaw: deg(Math.atan2(n.x, -n.y)),
      pitch: deg(Math.atan2(n.z, -n.y)),
      roll: deg(Math.atan2(r.z, r.x)),
      range,
      bearing: deg(Math.atan2(-x, y)),
      elevation: deg(Math.atan2(z, y)),
      centerPx: { x: u, y: v },
      sizePx,
    });
  }
  return found.sort((a, b) => a.range - b.range);
}
