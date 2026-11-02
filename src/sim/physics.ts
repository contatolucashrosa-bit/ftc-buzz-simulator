// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Mundo físico (Rapier, WASM). Passo fixo: o mesmo resultado para as mesmas entradas, o que permite replays.
import RAPIER from "@dimforge/rapier3d-compat";

export { RAPIER };

let ready: Promise<void> | null = null;

export function initPhysics(): Promise<void> {
  ready ??= RAPIER.init();
  return ready;
}

export interface PhysicsWorld {
  world: RAPIER.World;
  /** Passo fixo em segundos. */
  dt: number;
}

export function createWorld(dt: number): PhysicsWorld {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = dt;
  return { world, dt };
}

/** Quaternion de rotação em torno do eixo X do mundo (o eixo dos pivôs das HIVEs). */
export function quatAboutX(angleRad: number): RAPIER.Rotation {
  return { x: Math.sin(angleRad / 2), y: 0, z: 0, w: Math.cos(angleRad / 2) };
}

/** Quaternion de rotação em torno do eixo Y do mundo (giro do robô no chão). */
export function quatAboutY(angleRad: number): RAPIER.Rotation {
  return { x: 0, y: Math.sin(angleRad / 2), z: 0, w: Math.cos(angleRad / 2) };
}

/** Ângulo de giro (yaw) a partir de um quaternion que só gira em Y. */
export function yawOf(q: { x: number; y: number; z: number; w: number }): number {
  return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
}
