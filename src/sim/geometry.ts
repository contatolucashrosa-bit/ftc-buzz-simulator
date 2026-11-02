// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Geometria do campo BIOBUZZ em polegadas, no sistema do manual:
// origem no centro, +x para a aliança azul, +y para o lado oposto à plateia, +z para cima.
// Valores marcados "suposição" não estão no manual e serão conferidos no CAD oficial.
import * as THREE from "three";
import type { Alliance } from "../rules/rules";
import type { FlowerId } from "../scoring/scoring";

export const INCH = 0.0254;

/** Converte um ponto do manual (pol) para o mundo 3D (m, y para cima, câmera da plateia olhando para -z). */
export function toWorld(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x * INCH, z * INCH, -y * INCH);
}

/** Converte do mundo 3D (m) para o sistema do manual (pol). */
export function toField(v: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  return { x: v.x / INCH, y: -v.z / INCH, z: v.y / INCH };
}

export const FIELD = {
  half: 72, // §9.2 p.62: 144 pol
  tile: 24,
  wallHeight: 12, // suposição: altura do perímetro AndyMark am-0481
  wallThickness: 1,
};

export interface Rect {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** §9.3 p.63–64; posições estimadas das Figuras 9-2 e 9-5 (suposição). */
export const LOADING_ZONES: Record<Alliance, Rect> = {
  red: { xMin: -72, xMax: -61, yMin: 24, yMax: 47 },
  blue: { xMin: 61, xMax: 72, yMin: -47, yMax: -24 },
};

export const GARDENS: Record<Alliance, Rect> = {
  red: { xMin: -72, xMax: -49, yMin: -72, yMax: -70 },
  blue: { xMin: 49, xMax: 72, yMin: 70, yMax: 72 },
};

/** Lado de cada aliança (G304.A; G402): vermelho colunas A–C (x < 0), azul D–F (x > 0). */
export function allianceSide(x: number): Alliance {
  return x < 0 ? "red" : "blue";
}

export const ELEMENTS = {
  pollenRadius: 2.8 / 2, // §9.8 p.72
  nectarRadius: 3.6 / 2,
  // Massas calculadas do CAD oficial da AndyMark (STEP am-5851 / am-5852): volume 22,29 cm³ e 43,11 cm³,
  // polietileno a ~0,95 g/cm³ (o manual não informa massa). Ver docs/scoring-element-mass.md.
  pollenMassKg: 0.021,
  nectarMassKg: 0.041,
};

/** §9.6 p.67–69 (Figuras 9-8 a 9-11). */
export const HIVE = {
  pivotHeight: 43.95,
  centerX: { red: -12.75, blue: 12.75 } as Record<Alliance, number>, // centro a centro 25.5 pol (Fig. 9-10)
  tiltDeg: 30, // Fig. 9-10
  cellInnerY: 18.84 / 2, // vão entre as CELLS (Fig. 9-9)
  cellDepth: 12.04, // ao longo da barra (Fig. 9-9)
  cellWidth: 20, // Fig. 9-11
  cellWallHeight: 7.61, // parte reta da lateral (Fig. 9-11)
  cellPeakHeight: 14, // até o pico (Fig. 9-11)
  // Fundo da CELL abaixo do pivô, calculado com "topo da abertura 65.6 pol" (Fig. 9-10).
  cellBottomZ: -1.55,
  barLength: 42.91,
  frameWidth: 49.46, // §9.6.1
  frameDepth: 38.95,
  // suposição: massa na CELL de cima que vira a HIVE (o manual não informa, §8 p.60).
  // Os 3 NECTAR da largada (123 g) não viram a HIVE; com 135 g, +1 POLLEN já vira.
  // Uma CELL vazia precisa de 7 POLLEN, 4 NECTAR ou combinações (tabela em docs/scoring-element-mass.md).
  // Será calibrado com o CAD da arena (massa e centro de gravidade da HIVE) ou com testes no campo real.
  tipThresholdKg: 0.135,
  tipDurationS: 0.6, // suposição
};

/** CELL de cima no início: a que "aponta" para uma FLOWER começa para baixo (§10.3.1 p.81). */
export const HIVE_INITIAL_UP_SIDE: Record<Alliance, 1 | -1> = { red: -1, blue: 1 };

/** §9.7 p.70; posições estimadas da Figura 9-5; nomes da calculadora oficial. */
export interface FlowerSpec {
  id: FlowerId;
  label: string;
  x: number;
  y: number;
  /** Direção (unitária) da parede para o centro do campo. */
  inward: { x: number; y: number };
}

const FLOWER_WALL_OFFSET = 3.5; // suposição: distância do eixo da FLOWER à face interna da parede

export const FLOWERS: FlowerSpec[] = [
  { id: "scoringFlower", label: "FLOWER do fundo", x: -24, y: 72 - FLOWER_WALL_OFFSET, inward: { x: 0, y: -1 } },
  { id: "audienceFlower", label: "FLOWER da plateia", x: 24, y: -72 + FLOWER_WALL_OFFSET, inward: { x: 0, y: 1 } },
  { id: "redAllianceFlower", label: "FLOWER vermelha", x: -72 + FLOWER_WALL_OFFSET, y: -24, inward: { x: 1, y: 0 } },
  { id: "blueAllianceFlower", label: "FLOWER azul", x: 72 - FLOWER_WALL_OFFSET, y: 24, inward: { x: -1, y: 0 } },
];

export const FLOWER = {
  topHeight: 21.5, // §9.7
  topOpeningRadius: 4 / 2,
  backstopHeight: 1.25,
  lowerRingHeight: 0.4,
  lowerRingHoleRadius: 2.79 / 2,
  retrievalHeight: 3.55,
  // suposição: o furo do anel do meio deixa passar POLLEN (2.8) e segura NECTAR (3.6);
  // 3.3 pol dá folga para o POLLEN cair até o anel de baixo quando o de baixo é retirado
  middleRingHoleRadius: 3.3 / 2,
  middleRingThickness: 0.5,
  pipeRadius: 0.42,
  /** Volume de pontuação: entre o anel do meio e o anel do topo (§10.5.2, CAD Reference 10-4). */
  get scoringBottom(): number {
    return this.lowerRingHeight + this.retrievalHeight + this.middleRingThickness;
  },
};

export const ROBOT_LIMITS = {
  start: 18, // R102
  expandHorizontal: [18, 24] as const, // R105
  expandHeight: 29,
};

export function inRect(x: number, y: number, r: Rect, margin = 0): boolean {
  return x >= r.xMin - margin && x <= r.xMax + margin && y >= r.yMin - margin && y <= r.yMax + margin;
}

/** Círculo (centro, raio) toca o retângulo? Usado para "ao menos parcialmente na zona". */
export function circleTouchesRect(x: number, y: number, radius: number, r: Rect): boolean {
  const cx = Math.max(r.xMin, Math.min(x, r.xMax));
  const cy = Math.max(r.yMin, Math.min(y, r.yMax));
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius;
}
