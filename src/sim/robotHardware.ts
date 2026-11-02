// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Hardware do robô simulado visto pelo código Java (hardwareMap): motores com encoder, servos, IMU e odometria.
// O controle de RUN_TO_POSITION / RUN_USING_ENCODER roda aqui, a cada passo de física, como no Control Hub.

/** Motor goBILDA 5203 312 RPM (rodas) e 6000 RPM sem redução (lançador). */
export interface MotorSpec {
  ticksPerRev: number;
  maxRpm: number;
}

export const DRIVE_MOTOR: MotorSpec = { ticksPerRev: 537.7, maxRpm: 312 };
export const FLYWHEEL_MOTOR: MotorSpec = { ticksPerRev: 28, maxRpm: 6000 };

const RUN_TO_POSITION_GAIN = 1 / 150; // potência por tick de erro (suposição de ajuste)
const TIME_CONSTANT_S = 0.07;
const COAST_TIME_CONSTANT_S = 0.45;

export class MotorModel {
  /** Potência já com o sinal da direção aplicado pelo SDK (-1..1). */
  power = 0;
  /** 0 = sem encoder, 1 = usando encoder, 2 = ir para posição, 3 = velocidade. */
  mode = 0;
  target = 0;
  velocityTarget = 0;
  brake = true;
  tolerance = 5;
  position = 0;
  velocity = 0;

  constructor(readonly spec: MotorSpec) {}

  get maxTicksPerSecond(): number {
    return (this.spec.ticksPerRev * this.spec.maxRpm) / 60;
  }

  /** Potência efetiva depois do controlador do Hub. */
  effectivePower(): number {
    if (this.mode === 2) {
      const error = this.target - this.position;
      if (Math.abs(error) <= this.tolerance) return 0;
      const limit = Math.abs(this.power);
      return Math.max(-limit, Math.min(limit, error * RUN_TO_POSITION_GAIN));
    }
    if (this.mode === 3) return Math.max(-1, Math.min(1, this.velocityTarget / this.maxTicksPerSecond));
    return this.power;
  }

  step(dt: number, batteryScale = 1): void {
    const p = this.effectivePower();
    const target = p * this.maxTicksPerSecond * batteryScale;
    const tau = p === 0 && !this.brake ? COAST_TIME_CONSTANT_S : TIME_CONSTANT_S;
    this.velocity += (target - this.velocity) * Math.min(1, dt / tau);
    this.position += this.velocity * dt;
  }

  /** Fração da velocidade máxima (-1..1). */
  get speedFraction(): number {
    return this.velocity / this.maxTicksPerSecond;
  }
}

export type DeviceKind = "motor" | "servo" | "crservo" | "imu" | "odometry";

/** Nomes do robô genérico. Os apelidos cobrem os nomes dos exemplos oficiais e dos quickstarts. */
export const DEVICE_NAMES: Record<string, { kind: DeviceKind; target: string }> = {
  leftFront: { kind: "motor", target: "leftFront" },
  leftBack: { kind: "motor", target: "leftBack" },
  rightFront: { kind: "motor", target: "rightFront" },
  rightBack: { kind: "motor", target: "rightBack" },
  left_front_drive: { kind: "motor", target: "leftFront" },
  left_back_drive: { kind: "motor", target: "leftBack" },
  right_front_drive: { kind: "motor", target: "rightFront" },
  right_back_drive: { kind: "motor", target: "rightBack" },
  frontLeft: { kind: "motor", target: "leftFront" },
  backLeft: { kind: "motor", target: "leftBack" },
  frontRight: { kind: "motor", target: "rightFront" },
  backRight: { kind: "motor", target: "rightBack" },
  intake: { kind: "motor", target: "intake" },
  launcher: { kind: "motor", target: "launcher" },
  feeder: { kind: "servo", target: "feeder" },
  placer: { kind: "servo", target: "placer" },
  hood: { kind: "servo", target: "hood" },
  imu: { kind: "imu", target: "imu" },
  pinpoint: { kind: "odometry", target: "odometry" },
  odo: { kind: "odometry", target: "odometry" },
  otos: { kind: "odometry", target: "odometry" },
  sensor_otos: { kind: "odometry", target: "odometry" },
  octoquad: { kind: "odometry", target: "odometry" },
};

/** Canônicos, na ordem em que aparecem na tela de configuração. */
export const CANONICAL_DEVICES: Array<{ name: string; kind: DeviceKind; description: string }> = [
  { name: "leftFront", kind: "motor", description: "Roda dianteira esquerda (montada espelhada: use REVERSE)" },
  { name: "leftBack", kind: "motor", description: "Roda traseira esquerda (montada espelhada: use REVERSE)" },
  { name: "rightFront", kind: "motor", description: "Roda dianteira direita" },
  { name: "rightBack", kind: "motor", description: "Roda traseira direita" },
  { name: "intake", kind: "motor", description: "Intake: potência > 0,2 coleta" },
  { name: "launcher", kind: "motor", description: "Lançador (6000 RPM): a velocidade define a força do lançamento" },
  { name: "feeder", kind: "servo", description: "Alimentador: subir acima de 0,6 lança um elemento" },
  { name: "placer", kind: "servo", description: "Colocador: subir acima de 0,6 solta um elemento na FLOWER" },
  { name: "hood", kind: "servo", description: "Ângulo do lançador: 0 = 20°, 1 = 80°" },
  { name: "imu", kind: "imu", description: "IMU do Control Hub" },
  { name: "pinpoint", kind: "odometry", description: "Odometria goBILDA Pinpoint (também 'odo', 'otos', 'octoquad')" },
];

/** Montagem das rodas: o lado esquerdo é espelhado, como na maioria dos chassis mecanum. */
const MOUNT: Record<string, number> = { leftFront: -1, leftBack: -1, rightFront: 1, rightBack: 1 };

export interface RobotActions {
  /** Comando normalizado de chassi (-1..1), no referencial do robô. */
  forward: number;
  strafe: number;
  turn: number;
  intakeOn: boolean;
  launch: boolean;
  place: boolean;
  /** m/s e graus, quando o lançador é controlado pelo código. */
  launcherSpeed: number | null;
  launcherPitchDeg: number | null;
}

/** Mecanum: velocidades das rodas (frações) → movimento do chassi (frações). */
export function mecanumFromWheels(w: { leftFront: number; leftBack: number; rightFront: number; rightBack: number }) {
  return {
    forward: (w.leftFront + w.leftBack + w.rightFront + w.rightBack) / 4,
    strafe: (-w.leftFront + w.leftBack + w.rightFront - w.rightBack) / 4,
    turn: (-w.leftFront - w.leftBack + w.rightFront + w.rightBack) / 4,
  };
}

export class RobotHardware {
  readonly motors = new Map<string, MotorModel>([
    ["leftFront", new MotorModel(DRIVE_MOTOR)],
    ["leftBack", new MotorModel(DRIVE_MOTOR)],
    ["rightFront", new MotorModel(DRIVE_MOTOR)],
    ["rightBack", new MotorModel(DRIVE_MOTOR)],
    ["intake", new MotorModel({ ticksPerRev: 145.1, maxRpm: 1150 })],
    ["launcher", new MotorModel(FLYWHEEL_MOTOR)],
  ]);
  readonly servos = new Map<string, number>([
    ["feeder", 0],
    ["placer", 0],
    ["hood", 0.37],
  ]);
  private servoWasHigh = new Map<string, boolean>();
  batteryVolts = 12.8;
  /** O código Java está no controle do robô? (o hardware só mexe no robô nesse caso). */
  active = false;

  resolve(name: string): { kind: DeviceKind; target: string } | null {
    return DEVICE_NAMES[name] ?? null;
  }

  reset(): void {
    for (const m of this.motors.values()) Object.assign(m, { power: 0, mode: 0, target: 0, velocityTarget: 0, velocity: 0 });
    this.servoWasHigh.clear();
  }

  /** Para tudo (fim do OpMode / parada pedida). */
  stopAll(): void {
    for (const m of this.motors.values()) {
      m.power = 0;
      m.mode = 0;
      m.velocityTarget = 0;
    }
  }

  /** Um passo de física: motores andam e o resultado vira ações do robô. */
  step(dt: number): RobotActions {
    for (const m of this.motors.values()) m.step(dt);
    const wheel = (n: string) => this.motors.get(n)!.speedFraction * MOUNT[n];
    const chassis = mecanumFromWheels({ leftFront: wheel("leftFront"), leftBack: wheel("leftBack"), rightFront: wheel("rightFront"), rightBack: wheel("rightBack") });

    const edge = (servo: string) => {
      const high = (this.servos.get(servo) ?? 0) > 0.6;
      const was = this.servoWasHigh.get(servo) ?? false;
      this.servoWasHigh.set(servo, high);
      return high && !was;
    };
    const flywheel = this.motors.get("launcher")!;
    const spin = Math.abs(flywheel.speedFraction);
    return {
      ...chassis,
      intakeOn: this.motors.get("intake")!.power > 0.2,
      // só lança com o lançador girando, como num lançador real
      launch: edge("feeder") && spin > 0.2,
      place: edge("placer"),
      launcherSpeed: 10 * spin,
      launcherPitchDeg: 20 + 60 * (this.servos.get("hood") ?? 0),
    };
  }
}
