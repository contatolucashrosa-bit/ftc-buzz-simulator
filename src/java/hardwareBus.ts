// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Ponte entre o SDK FTC simulado (Java, via globalThis.__buzzHw) e o robô do jogo.
// Os nomes do código da equipe passam pelo mapa da Oficina; nomes desconhecidos viram dispositivos "de sobra"
// (aceitam comandos e leem zero), para o OpMode não quebrar por causa de um mecanismo que o simulador não tem.
import { DEVICE_NAMES, RobotHardware, type RobotActions } from "../sim/robotHardware";
import type { DeviceKind, HardwareUse } from "./project";
import type { CameraIntrinsics, CameraMount, TagDetection } from "../sim/vision";

export interface BusInputs {
  /** Pose verdadeira no campo: mm, mm, rad; velocidades em mm/s e rad/s. */
  pose(): { x: number; y: number; h: number; vx: number; vy: number; vh: number };
  /** Campo do gamepad no formato do SDK ("left_stick_y", "a"...). */
  gamepad(index: number, field: string): number;
  /** AprilTags vistas pela câmera montada no robô (pol, graus), e a pose verdadeira do robô (pol, rad). */
  aprilTags?(mount: CameraMount, intrinsics: CameraIntrinsics): { detections: TagDetection[]; robot: { x: number; y: number; heading: number } };
  /** Tags do campo na posição inicial das HIVEs: id, x, y, z (pol). */
  tagLibrary?(): Array<{ id: number; x: number; y: number; z: number }>;
}

/** O que cada dispositivo simulado é para o SDK. */
const SIM_KIND: Record<string, DeviceKind> = {
  leftFront: "motor",
  leftBack: "motor",
  rightFront: "motor",
  rightBack: "motor",
  intake: "motor",
  launcher: "motor",
  feeder: "servo",
  placer: "servo",
  hood: "servo",
  imu: "imu",
  odometry: "odometry",
};

export class HardwareBus {
  readonly hw = new RobotHardware();
  /** 0 = INIT, 1 = rodando, 2 = parada pedida. */
  state = 0;
  telemetry = "";
  time = 0;
  /** O OpMode terminou (sozinho, por erro ou pela parada). */
  ended = false;
  error: string | null = null;
  private waiting: Array<() => void> = [];
  private readonly spare = new Map<string, { kind: DeviceKind; value: number }>();
  private readonly api: Record<string, unknown>;

  constructor(
    private readonly deviceMap: Record<string, string>,
    hardware: HardwareUse[],
    private readonly inputs: BusInputs,
    private readonly onLog: (text: string) => void = () => undefined,
  ) {
    for (const h of hardware) if (!this.target(h.name)) this.spare.set(h.name, { kind: h.kind, value: 0 });
    this.api = {
      kind: (name: string) => this.kind(name),
      get: (name: string, prop: string) => this.get(name, prop),
      set: (name: string, prop: string, value: number) => this.set(name, prop, value),
      gamepad: (index: number, field: string) => this.inputs.gamepad(index, field),
      state: () => this.state,
      time: () => this.time,
      telemetry: (text: string) => (this.telemetry = text),
      log: (text: string) => this.log(text),
      names: (kind: string) => this.names(kind),
      onNextStep: (resume: () => void) => this.waiting.push(resume),
      aprilTags: (x: number, y: number, z: number, yaw: number, pitch: number, roll: number, fx: number, fy: number, cx: number, cy: number, width: number, height: number) =>
        this.aprilTags({ x, y, z, yaw, pitch, roll }, { fx, fy, cx, cy, width, height }),
      tagLibrary: () => (this.inputs.tagLibrary?.() ?? []).map((t) => [t.id, t.x, t.y, t.z].join(",")).join(";"),
    };
  }

  /**
   * Detecções num texto simples para o Java (sem JSON no SDK): uma tag por ";" com
   * id, x, y, z, yaw, pitch, roll, range, bearing, elevation, centro (px), tamanho (px) e a pose do robô.
   */
  private aprilTags(mount: CameraMount, intrinsics: CameraIntrinsics): string {
    const seen = this.inputs.aprilTags?.(mount, intrinsics);
    if (!seen) return "";
    const r = seen.robot;
    const heading = (r.heading * 180) / Math.PI;
    return seen.detections
      .map((d) => [d.id, d.x, d.y, d.z, d.yaw, d.pitch, d.roll, d.range, d.bearing, d.elevation, d.centerPx.x, d.centerPx.y, d.sizePx, r.x, r.y, heading].map((v) => +v.toFixed(4)).join(","))
      .join(";");
  }

  install(): void {
    (globalThis as Record<string, unknown>).__buzzHw = this.api;
  }

  /** Nome do código → dispositivo simulado (mapa da equipe, depois os nomes padrão dos exemplos). */
  private target(name: string): string | null {
    const mapped = this.deviceMap[name];
    if (mapped) return mapped;
    const alias = DEVICE_NAMES[name];
    return alias ? alias.target : null;
  }

  private kind(name: string): string {
    const t = this.target(name);
    if (t) return SIM_KIND[t] ?? "";
    return this.spare.get(name)?.kind ?? "";
  }

  private names(kind: string): string {
    const all = new Set<string>();
    for (const [name, t] of Object.entries(this.deviceMap)) if (SIM_KIND[t] === kind) all.add(name);
    for (const [name, s] of this.spare) if (s.kind === kind) all.add(name);
    if (!all.size) for (const [id, k] of Object.entries(SIM_KIND)) if (k === kind && id !== "odometry") all.add(id);
    return [...all].join(",");
  }

  private get(name: string, prop: string): number {
    if (name === "battery" || prop === "volts") return this.hw.batteryVolts;
    const t = this.target(name);
    if (!t) return this.spare.get(name)?.value ?? 0;
    const motor = this.hw.motors.get(t);
    if (motor) {
      switch (prop) {
        case "position":
          return motor.position;
        case "velocity":
          return motor.velocity;
        case "ticksPerRev":
          return motor.spec.ticksPerRev;
        case "maxRpm":
          return motor.spec.maxRpm;
        case "current":
          // corrente aproximada (A): proporcional à potência, até ~9 A no travamento
          return Math.abs(motor.effectivePower()) * 9 * (1 - Math.abs(motor.speedFraction) * 0.7);
        default:
          return 0;
      }
    }
    if (this.hw.servos.has(t)) return this.hw.servos.get(t)!;
    const p = this.inputs.pose();
    if (t === "imu") return prop === "yaw" ? p.h : prop === "yawRate" ? p.vh : 0;
    if (t === "odometry") return (p as Record<string, number>)[prop] ?? 0;
    return 0;
  }

  private set(name: string, prop: string, value: number): void {
    if (name === "opmode" && prop === "requestStop") {
      this.state = 2;
      return;
    }
    const t = this.target(name);
    if (!t) {
      const s = this.spare.get(name);
      if (s) s.value = value;
      return;
    }
    const motor = this.hw.motors.get(t);
    if (motor) {
      if (prop === "power") motor.power = Math.max(-1, Math.min(1, value));
      else if (prop === "mode") motor.mode = value;
      else if (prop === "target") motor.target = value;
      else if (prop === "velocity") motor.velocityTarget = value;
      else if (prop === "brake") motor.brake = value > 0.5;
      else if (prop === "tolerance") motor.tolerance = value;
      return;
    }
    if (this.hw.servos.has(t) && (prop === "position" || prop === "power")) {
      // servo contínuo ligado a um servo do robô: potência -1..1 vira posição 0..1
      this.hw.servos.set(t, prop === "power" ? (value + 1) / 2 : Math.max(0, Math.min(1, value)));
    }
  }

  private log(text: string): void {
    if (text === "OPMODE_END") this.ended = true;
    else if (text.startsWith("OPMODE_ERROR")) {
      this.ended = true;
      this.error = text.replace("OPMODE_ERROR ", "");
    }
    this.onLog(text);
  }

  /** Um passo de física: motores andam, o relógio avança e o OpMode que esperava este passo continua. */
  step(dt: number, robotsEnabled: boolean): RobotActions {
    this.time += dt;
    if (!robotsEnabled) this.hw.stopAll();
    const actions = this.hw.step(dt);
    const resume = this.waiting;
    this.waiting = [];
    resume.forEach((fn) => fn());
    return actions;
  }
}
