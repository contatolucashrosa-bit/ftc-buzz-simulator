// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Replay curto: grava os últimos segundos da partida (poses do robô, dos elementos e das HIVEs) e reproduz
// só o visual, sem tocar na física. Assim o replay é exato e não altera o resultado da partida.
import * as THREE from "three";
import type { ElementKind } from "../sim/elements";

export const REPLAY_SECONDS = 30;
const RATE_HZ = 30;
const KINDS: ElementKind[] = ["pollen", "redNectar", "blueNectar"];
const STRIDE = 9; // id, tipo, x, y, z, qx, qy, qz, qw

export interface ReplayFrame {
  /** Tempo de jogo (s) desde o início da gravação. */
  t: number;
  clockText: string;
  scores: { red: number; blue: number };
  robots: Array<{ p: [number, number, number]; q: [number, number, number, number] }>;
  hives: { red: number; blue: number };
  elements: Float32Array;
}

export interface ReplaySource {
  clockText: string;
  scores: { red: number; blue: number };
  /** Robô do jogador primeiro, depois os bots. */
  robots: THREE.Object3D[];
  hiveAngles: { red: number; blue: number };
  elements: Array<{ id: number; kind: ElementKind; mesh: THREE.Object3D }>;
}

/** Guarda um anel com os últimos REPLAY_SECONDS segundos, a 30 quadros por segundo. */
export class ReplayRecorder {
  private readonly frames: ReplayFrame[] = [];
  private time = 0;
  private sinceLast = Infinity;

  capture(dt: number, source: ReplaySource): void {
    this.time += dt;
    this.sinceLast += dt;
    if (this.sinceLast < 1 / RATE_HZ) return;
    this.sinceLast = 0;
    const data = new Float32Array(source.elements.length * STRIDE);
    source.elements.forEach((e, i) => {
      const o = i * STRIDE;
      data[o] = e.id;
      data[o + 1] = KINDS.indexOf(e.kind);
      data.set([e.mesh.position.x, e.mesh.position.y, e.mesh.position.z], o + 2);
      data.set([e.mesh.quaternion.x, e.mesh.quaternion.y, e.mesh.quaternion.z, e.mesh.quaternion.w], o + 5);
    });
    this.frames.push({
      t: this.time,
      clockText: source.clockText,
      scores: { ...source.scores },
      robots: source.robots.map((r) => ({ p: [r.position.x, r.position.y, r.position.z], q: [r.quaternion.x, r.quaternion.y, r.quaternion.z, r.quaternion.w] })),
      hives: { ...source.hiveAngles },
      elements: data,
    });
    while (this.frames.length && this.time - this.frames[0].t > REPLAY_SECONDS) this.frames.shift();
  }

  /** Cópia dos quadros gravados, com o tempo começando em 0. */
  clip(): ReplayFrame[] {
    if (!this.frames.length) return [];
    const t0 = this.frames[0].t;
    return this.frames.map((f) => ({ ...f, t: f.t - t0 }));
  }
}

export interface ReplayTargets {
  scene: THREE.Scene;
  robots: THREE.Object3D[];
  setHiveAngles(angles: { red: number; blue: number }): void;
  /** Malha nova (geometria e material compartilhados) para um tipo de elemento. */
  meshFor(kind: ElementKind): THREE.Mesh;
  setLiveElementsVisible(visible: boolean): void;
}

/** Reprodução: aplica um quadro (com interpolação) nos objetos da cena. */
export class ReplayPlayer {
  time = 0;
  speed = 1;
  playing = true;
  private readonly pool = new Map<number, THREE.Mesh>();
  private readonly duration: number;

  constructor(
    private readonly frames: ReplayFrame[],
    private readonly targets: ReplayTargets,
  ) {
    this.duration = frames.length ? frames[frames.length - 1].t : 0;
    targets.setLiveElementsVisible(false);
    this.apply();
  }

  get length(): number {
    return this.duration;
  }

  get frame(): ReplayFrame | undefined {
    return this.frames[this.indexAt(this.time)];
  }

  update(dt: number): void {
    if (this.playing) {
      this.time = Math.min(this.duration, this.time + dt * this.speed);
      if (this.time >= this.duration) this.playing = false;
    }
    this.apply();
  }

  seek(fraction: number): void {
    this.time = Math.max(0, Math.min(1, fraction)) * this.duration;
    this.apply();
  }

  private indexAt(t: number): number {
    // busca binária do último quadro com f.t <= t
    let lo = 0;
    let hi = this.frames.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.frames[mid].t <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  private apply(): void {
    if (!this.frames.length) return;
    const i = this.indexAt(this.time);
    const a = this.frames[i];
    const b = this.frames[Math.min(i + 1, this.frames.length - 1)];
    const k = b.t > a.t ? (this.time - a.t) / (b.t - a.t) : 0;

    this.targets.robots.forEach((robot, i) => {
      const ra = a.robots[i];
      const rb = b.robots[i] ?? ra;
      if (!ra) return;
      robot.position.set(...ra.p).lerp(new THREE.Vector3(...rb.p), k);
      robot.quaternion.set(...ra.q).slerp(new THREE.Quaternion(...rb.q), k);
    });
    this.targets.setHiveAngles({ red: a.hives.red + (b.hives.red - a.hives.red) * k, blue: a.hives.blue + (b.hives.blue - a.hives.blue) * k });

    // posição do mesmo elemento no quadro seguinte, para interpolar
    const next = new Map<number, number>();
    for (let o = 0; o < b.elements.length; o += STRIDE) next.set(b.elements[o], o);
    const seen = new Set<number>();
    for (let o = 0; o < a.elements.length; o += STRIDE) {
      const id = a.elements[o];
      seen.add(id);
      let mesh = this.pool.get(id);
      if (!mesh) {
        mesh = this.targets.meshFor(KINDS[a.elements[o + 1]]);
        this.pool.set(id, mesh);
        this.targets.scene.add(mesh);
      }
      mesh.visible = true;
      const ob = next.get(id);
      mesh.position.set(a.elements[o + 2], a.elements[o + 3], a.elements[o + 4]);
      mesh.quaternion.set(a.elements[o + 5], a.elements[o + 6], a.elements[o + 7], a.elements[o + 8]);
      if (ob !== undefined) {
        mesh.position.lerp(new THREE.Vector3(b.elements[ob + 2], b.elements[ob + 3], b.elements[ob + 4]), k);
        mesh.quaternion.slerp(new THREE.Quaternion(b.elements[ob + 5], b.elements[ob + 6], b.elements[ob + 7], b.elements[ob + 8]), k);
      }
    }
    for (const [id, mesh] of this.pool) if (!seen.has(id)) mesh.visible = false;
  }

  dispose(): void {
    for (const mesh of this.pool.values()) this.targets.scene.remove(mesh);
    this.pool.clear();
    this.targets.setLiveElementsVisible(true);
  }
}
