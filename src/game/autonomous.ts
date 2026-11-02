// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Autônomos de exemplo, escritos como "passos". Servem até o runtime Java (marco M5) rodar o código das equipes.
import { HIVE } from "../sim/geometry";
import type { DriveCommand } from "../sim/robot";

export type AutoProgramId = "none" | "leave" | "leavePark" | "scorePreload";

export const AUTO_PROGRAMS: Record<AutoProgramId, { label: string; description: string }> = {
  none: { label: "Nenhum", description: "O robô fica parado no AUTO." },
  leave: { label: "Sair da parede", description: "Garante o LEAVE (3 pontos)." },
  leavePark: { label: "Sair e estacionar", description: "LEAVE + PARK na LOADING ZONE (8 pontos)." },
  scorePreload: {
    label: "Lançar na HIVE e estacionar",
    description: "Lança os 4 POLLEN pré-carregados na CELL de cima e estaciona.",
  },
};

export type AutoStep =
  | { kind: "goTo"; x: number; y: number; heading: number; maxPower?: number }
  | { kind: "aim"; speed: number; pitchDeg: number }
  | { kind: "launch"; count: number; spacingS: number }
  | { kind: "wait"; seconds: number };

/** Pose inicial padrão do robô vermelho 1 (G304: no próprio lado, tocando a parede, fora da LOADING ZONE). */
export const RED_START = { x: -63, y: -48, heading: 0 };

const LAUNCH_EXIT = { forward: 6.5, z: 15 };

/**
 * Calcula velocidade e ângulo para o elemento chegar ao alvo no ponto mais alto da trajetória
 * (entra quase na horizontal pela abertura da CELL). Física de projétil sem arrasto.
 */
export function solveApexLaunch(horizontalIn: number, riseIn: number): { speed: number; pitchDeg: number } {
  const g = 9.81;
  const d = horizontalIn * 0.0254;
  const h = Math.max(0.05, riseIn * 0.0254);
  const vy = Math.sqrt(2 * g * h);
  const t = vy / g;
  const vx = d / t;
  return { speed: Math.hypot(vx, vy), pitchDeg: (Math.atan2(vy, vx) * 180) / Math.PI };
}

export function buildAutoSteps(id: AutoProgramId): AutoStep[] {
  const park: AutoStep[] = [
    { kind: "goTo", x: -45, y: -50, heading: 0 },
    // centro em x = -55: o robô fica parcialmente na LOADING ZONE sem tocar a parede (LEAVE continua valendo)
    { kind: "goTo", x: -55, y: 34, heading: 0 },
  ];
  switch (id) {
    case "none":
      return [];
    case "leave":
      return [{ kind: "goTo", x: -50, y: RED_START.y, heading: 0 }];
    case "leavePark":
      return [{ kind: "goTo", x: -55, y: RED_START.y, heading: 0 }, ...park.slice(1)];
    case "scorePreload": {
      // CELL de cima da HIVE vermelha começa do lado da plateia (-y), com a abertura virada para -y.
      const shootY = -58;
      const tilt = (HIVE.tiltDeg * Math.PI) / 180;
      const openingLz = HIVE.cellBottomZ + 6.5;
      const targetY = -(HIVE.cellInnerY + HIVE.cellDepth) * Math.cos(tilt) + openingLz * Math.sin(tilt) + 1.5;
      const targetZ = (HIVE.cellInnerY + HIVE.cellDepth) * Math.sin(tilt) + openingLz * Math.cos(tilt) + HIVE.pivotHeight;
      const aim = solveApexLaunch(targetY - (shootY + LAUNCH_EXIT.forward), targetZ - LAUNCH_EXIT.z);
      return [
        { kind: "goTo", x: -50, y: RED_START.y, heading: 0 },
        { kind: "goTo", x: HIVE.centerX.red, y: shootY, heading: Math.PI / 2 },
        { kind: "aim", speed: aim.speed, pitchDeg: aim.pitchDeg },
        { kind: "wait", seconds: 0.4 },
        { kind: "launch", count: 4, spacingS: 0.5 },
        ...park,
      ];
    }
  }
}

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export interface AutoActuators {
  pose(): { x: number; y: number; heading: number };
  setAim(speed: number, pitchDeg: number): void;
  launch(): boolean;
}

/** Executa os passos; chamado a cada passo de física durante o AUTO. */
export class AutoRunner {
  private index = 0;
  private timer = 0;
  private launched = 0;

  constructor(private readonly steps: AutoStep[]) {}

  get done(): boolean {
    return this.index >= this.steps.length;
  }

  update(dt: number, robot: AutoActuators): DriveCommand {
    const idle: DriveCommand = { forward: 0, strafe: 0, turn: 0 };
    const step = this.steps[this.index];
    if (!step) return idle;
    const next = () => {
      this.index++;
      this.timer = 0;
      this.launched = 0;
    };

    if (step.kind === "goTo") {
      const pose = robot.pose();
      const ex = step.x - pose.x;
      const ey = step.y - pose.y;
      const dist = Math.hypot(ex, ey);
      const turnErr = angleDiff(step.heading, pose.heading);
      if (dist < 1.5 && Math.abs(turnErr) < 0.05) {
        next();
        return idle;
      }
      const c = Math.cos(pose.heading);
      const s = Math.sin(pose.heading);
      const gain = Math.min(1, dist / 14) * (step.maxPower ?? 0.85);
      const scale = dist > 1e-6 ? gain / dist : 0;
      return {
        forward: (ex * c + ey * s) * scale,
        strafe: (-ex * s + ey * c) * scale,
        turn: Math.max(-1, Math.min(1, turnErr * 1.8)),
      };
    }

    this.timer += dt;
    if (step.kind === "aim") {
      robot.setAim(step.speed, step.pitchDeg);
      next();
    } else if (step.kind === "wait") {
      if (this.timer >= step.seconds) next();
    } else if (step.kind === "launch") {
      if (this.launched < step.count && this.timer >= this.launched * step.spacingS) {
        robot.launch();
        this.launched++;
      }
      if (this.launched >= step.count) next();
    }
    return idle;
  }
}
