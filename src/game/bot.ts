// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Robôs-bot: parceiro e adversários controlados pelo simulador, para treinar uma partida com 4 robôs.
// Estratégia simples e legível (como um starter bot bem pilotado): coletar POLLEN do chão, ir até a frente
// da própria HIVE, mirar na CELL de cima, lançar o depósito e estacionar na LOADING ZONE no fim.
import { RULES } from "../rules/rules";
import { FIELD, FLOWERS, HIVE, LOADING_ZONES, FLOWER } from "../sim/geometry";
import type { DriveCommand } from "../sim/robot";
import { hiveShot } from "./autonomous";

export type BotLevel = "easy" | "medium" | "hard";
type Alliance = "red" | "blue";

export const BOT_LEVELS: Record<BotLevel, { label: string; maxPower: number; aimError: number; thinkS: number }> = {
  easy: { label: "Fácil", maxPower: 0.55, aimError: 0.08, thinkS: 0.8 },
  medium: { label: "Médio", maxPower: 0.75, aimError: 0.04, thinkS: 0.4 },
  hard: { label: "Difícil", maxPower: 0.95, aimError: 0.015, thinkS: 0.15 },
};

/** O que o cérebro enxerga e comanda (o jogo implementa). */
export interface BotWorld {
  pose(): { x: number; y: number; heading: number };
  hopperCount(): number;
  /** Elementos soltos no campo que este robô pode coletar (pol). */
  pickups(): Array<{ id: number; x: number; y: number; z: number }>;
  /** Lado da CELL de cima da HIVE da aliança. */
  hiveUpSide(): 1 | -1;
  /** Saída do lançador do robô (pol à frente do centro e altura). */
  launchExit(): { forward: number; z: number };
  setAim(speed: number, pitchDeg: number): void;
  startBurst(): void;
  bursting(): boolean;
  /** Posições dos outros robôs (para não disputar o mesmo POLLEN e destravar). */
  others(): Array<{ x: number; y: number }>;
  /** Posições dos robôs da mesma aliança (revezamento no ponto de lançamento). */
  allies(): Array<{ x: number; y: number }>;
  /** Segundos de partida restantes (Infinity no treino livre). */
  secondsLeft(): number;
  /** Período AUTO: atravessar para o lado adversário e encostar num robô de lá é MAJOR (G402). */
  isAuto(): boolean;
}

export interface BotOutput {
  drive: DriveCommand;
  intake: boolean;
}

type State = "collect" | "toShoot" | "shoot" | "park" | "unstuck";

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** POLLEN preso numa FLOWER ou no GARDEN fica para depois: sem mecanismo para tirar, o bot perderia tempo. */
function reachable(p: { x: number; y: number; z: number }): boolean {
  if (p.z > 3.5) return false;
  if (Math.abs(p.x) > FIELD.half - 2.5 || Math.abs(p.y) > FIELD.half - 2.5) return false;
  if (FLOWERS.some((f) => Math.hypot(p.x - f.x, p.y - f.y) < FLOWER.lowerRingHoleRadius + 3)) return false;
  // embaixo da estrutura da HIVE o robô não cabe
  if (Math.abs(p.x) < HIVE.frameWidth / 2 + 2 && Math.abs(p.y) < HIVE.frameDepth / 2 - 4) return false;
  return true;
}

export class BotBrain {
  private state: State = "collect";
  private target: { id: number; x: number; y: number } | null = null;
  private think = 0;
  private stuckTime = 0;
  private lastPos = { x: 0, y: 0 };
  private unstuckTime = 0;
  private shootTimer = 0;
  private readonly level: (typeof BOT_LEVELS)[BotLevel];

  constructor(
    readonly alliance: Alliance,
    level: BotLevel,
    private readonly rand: () => number = Math.random,
  ) {
    this.level = BOT_LEVELS[level];
  }

  get currentState(): State {
    return this.state;
  }

  update(dt: number, world: BotWorld): BotOutput {
    const pose = world.pose();
    const idle: BotOutput = { drive: { forward: 0, strafe: 0, turn: 0 }, intake: false };

    // destravar: se quase não andou por 1,5 s, dá ré girando por um instante
    const moved = Math.hypot(pose.x - this.lastPos.x, pose.y - this.lastPos.y);
    this.lastPos = { x: pose.x, y: pose.y };
    if (this.state === "unstuck") {
      this.unstuckTime -= dt;
      if (this.unstuckTime <= 0) {
        this.state = world.hopperCount() >= RULES.maxControlledElements ? "toShoot" : "collect";
        this.target = null;
      }
      return { drive: { forward: -0.6, strafe: 0, turn: this.rand() < 0.5 ? 0.8 : -0.8 }, intake: false };
    }
    const wantsToMove = this.state === "collect" || this.state === "toShoot" || this.state === "park";
    this.stuckTime = wantsToMove && moved < 0.3 * dt * 10 ? this.stuckTime + dt : 0;
    if (this.stuckTime > 1.5 && this.state !== "park") {
      this.stuckTime = 0;
      this.state = "unstuck";
      this.unstuckTime = 0.8;
      return idle;
    }

    // fim de partida: estacionar vale 5 pontos (PARK)
    if (world.secondsLeft() < 12 && this.state !== "park" && !world.bursting()) this.state = "park";

    switch (this.state) {
      case "collect": {
        if (world.hopperCount() >= RULES.maxControlledElements) {
          this.state = "toShoot";
          return idle;
        }
        this.think -= dt;
        if (!this.target || this.think <= 0) {
          this.think = this.level.thinkS;
          this.target = this.pickTarget(pose, world);
        }
        if (!this.target) {
          // nada para coletar: lança o que tiver
          if (world.hopperCount() > 0) this.state = "toShoot";
          return idle;
        }
        // chega de frente, com o intake ligado
        const heading = Math.atan2(this.target.y - pose.y, this.target.x - pose.x);
        const drive = this.goTo(pose, this.target.x, this.target.y, heading, 0);
        return { drive, intake: true };
      }
      case "toShoot": {
        const shot = hiveShot(this.alliance, world.hiveUpSide(), world.launchExit());
        // revezamento: os robôs têm ~17 pol de largura e só um cabe no ponto de lançamento;
        // se um parceiro já está lá, espera ao lado (do lado da própria ALLIANCE AREA)
        const myDist = Math.hypot(shot.x - pose.x, shot.y - pose.y);
        const occupied = world.allies().some((a) => {
          const d = Math.hypot(shot.x - a.x, shot.y - a.y);
          return d < 16 && d < myDist;
        });
        if (occupied) {
          const holdX = shot.x + (this.alliance === "red" ? -24 : 24);
          return { drive: this.goTo(pose, holdX, shot.y, shot.heading, 2), intake: false };
        }
        // contorna a HIVE pela lateral quando está do outro lado dela
        const sameSide = Math.sign(pose.y) === Math.sign(shot.y) || Math.abs(pose.y) < 8;
        const viaX = this.alliance === "red" ? -FIELD.half + 22 : FIELD.half - 22;
        const target = sameSide ? shot : { x: viaX, y: shot.y * 0.5, heading: shot.heading };
        const drive = this.goTo(pose, target.x, target.y, shot.heading, 1.2);
        const there = sameSide && Math.hypot(shot.x - pose.x, shot.y - pose.y) < 2 && Math.abs(angleDiff(shot.heading, pose.heading)) < 0.05;
        if (there) {
          const err = 1 + (this.rand() * 2 - 1) * this.level.aimError;
          world.setAim(shot.aim.speed * err, shot.aim.pitchDeg);
          this.state = "shoot";
          this.shootTimer = 0.3;
          return { drive: { forward: 0, strafe: 0, turn: 0 }, intake: false };
        }
        return { drive, intake: false };
      }
      case "shoot": {
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && !world.bursting()) {
          if (world.hopperCount() > 0) world.startBurst();
          else this.state = "collect";
          this.shootTimer = 0.3;
        }
        return idle;
      }
      case "park": {
        const lz = LOADING_ZONES[this.alliance];
        // parcialmente dentro da LOADING ZONE, sem encostar na parede
        const x = this.alliance === "red" ? lz.xMax + 4 : lz.xMin - 4;
        const y = (lz.yMin + lz.yMax) / 2;
        return { drive: this.goTo(pose, x, y, pose.heading, 0.8), intake: false };
      }
    }
    return idle;
  }

  private pickTarget(pose: { x: number; y: number; heading: number }, world: BotWorld) {
    const others = world.others();
    let best: { id: number; x: number; y: number } | null = null;
    let bestCost = Infinity;
    const auto = world.isAuto();
    for (const p of world.pickups()) {
      if (!reachable(p)) continue;
      // no AUTO, fica no próprio lado com folga (o robô tem ~9 pol do centro até a borda)
      if (auto && (this.alliance === "red" ? p.x > -12 : p.x < 12)) continue;
      const d = Math.hypot(p.x - pose.x, p.y - pose.y);
      // evita disputar com um robô que já está mais perto
      const contested = others.some((o) => Math.hypot(p.x - o.x, p.y - o.y) < d * 0.7 && Math.hypot(p.x - o.x, p.y - o.y) < 18);
      // prefere o próprio lado do campo (o adversário coleta do lado dele)
      const ownSide = (this.alliance === "red" ? p.x < 10 : p.x > -10) ? 0 : 25;
      const cost = d + (contested ? 40 : 0) + ownSide;
      if (cost < bestCost) {
        bestCost = cost;
        best = p;
      }
    }
    return best;
  }

  /**
   * Vai até um ponto (pol) e termina virado para `heading` (rad). Em duas etapas, porque a maioria dos
   * starter bots é tanque (não anda de lado): primeiro anda de frente (ou de ré) para o destino, depois gira.
   */
  private goTo(pose: { x: number; y: number; heading: number }, x: number, y: number, heading: number, tolerance: number): DriveCommand {
    const ex = x - pose.x;
    const ey = y - pose.y;
    const dist = Math.hypot(ex, ey);
    if (dist <= Math.max(tolerance, 1.5)) {
      return { forward: 0, strafe: 0, turn: Math.max(-1, Math.min(1, angleDiff(heading, pose.heading) * 1.8)) };
    }
    // de ré quando o destino está atrás (evita meia-volta perto de paredes)
    const travel = Math.atan2(ey, ex);
    const forwardErr = angleDiff(travel, pose.heading);
    const reverse = Math.abs(forwardErr) > (Math.PI * 2) / 3 && dist < 30;
    const turnErr = reverse ? angleDiff(travel + Math.PI, pose.heading) : forwardErr;
    const gain = Math.min(1, dist / 12) * this.level.maxPower;
    // só acelera quando já está quase alinhado
    const aligned = Math.max(0, Math.cos(Math.min(Math.PI / 2, Math.abs(turnErr) * 1.5)));
    return {
      forward: (reverse ? -1 : 1) * gain * aligned,
      strafe: 0,
      turn: Math.max(-1, Math.min(1, turnErr * 2.2)),
    };
  }
}
