// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Controlador da partida: liga física, regras, robô, entradas e placar.
import * as THREE from "three";
import { RULES, type Alliance } from "../rules/rules";
import { clockAt, formatClock, matchDuration, nectarAllowance, type ClockState } from "../match/clock";
import { computeScore, emptySnapshot, type MatchScore, type MatchSnapshot } from "../scoring/scoring";
import { Controls, type ControlState } from "../input/controls";
import { loadFieldModels } from "../render/fieldModels";
import { loadRobotModels } from "../render/robotModels";
import { Stage, QUALITY_SETTINGS, CAMERA_LABELS, type Quality } from "../render/stage";
import { RAPIER, createWorld, initPhysics, yawOf, type PhysicsWorld } from "../sim/physics";
import { buildField, ALLIANCE_COLORS } from "../sim/field";
import { ElementManager, allianceOfNectar, nectarOf } from "../sim/elements";
import { Hive } from "../sim/hive";
import { Flower } from "../sim/flower";
import { Robot, robotConfigFromPreset } from "../sim/robot";
import { Environment } from "../render/environment";
import { type MatchCue, SoundBoard } from "../render/audio";
import { ReplayPlayer, ReplayRecorder } from "./replay";
import { FoulMonitor, type FoulRobot } from "./fouls";
import { detectTags, hiveTags, type CameraIntrinsics, type CameraMount } from "../sim/vision";
import type { SecondPlayerState } from "../input/controls";
import { BotBrain, type BotLevel, type BotWorld } from "./bot";
import { ROBOT_PRESETS, type RobotPresetId as BotPresetId } from "../config/robotPresets";
import { HardwareBus } from "../java/hardwareBus";
import { GamepadSource } from "../java/gamepadSource";
import { runProgram } from "../java/javaRuntime";
import type { HardwareUse } from "../java/project";
import { getRobot } from "../workshop/robotStore";
import { loadStoredModel } from "../workshop/cadImport";
import type { RobotPreset } from "../config/robotPresets";
import { robotPreset, type RobotPresetId } from "../config/robotPresets";
import { ELEMENTS, FIELD, FLOWERS, GARDENS, HIVE, HIVE_INITIAL_UP_SIDE, LOADING_ZONES, circleTouchesRect, toWorld, INCH } from "../sim/geometry";
import { AutoRunner, buildAutoSteps, hiveShot, RED_START, type AutoProgramId } from "./autonomous";

export type GameMode = "practice" | "match";

interface CadRobot {
  model: THREE.Object3D;
  sizeIn: { length: number; width: number; height: number };
}

/** A física usa a caixa do CAD (limitada ao tamanho de largada, R102) com os mecanismos da variante escolhida. */
function withCadSize(preset: RobotPreset, cad?: CadRobot): RobotPreset {
  if (!cad) return preset;
  const clamp = (v: number) => Math.min(18, Math.max(8, v));
  return { ...preset, length: clamp(cad.sizeIn.length), width: clamp(cad.sizeIn.width), height: Math.min(18, Math.max(8, cad.sizeIn.height)) };
}

/** OpMode já compilado para a partida. */
export interface JavaOpModeRun {
  label: string;
  js: string;
}

export interface JavaSetup {
  auto?: JavaOpModeRun;
  teleop?: JavaOpModeRun;
  deviceMap: Record<string, string>;
  hardware: HardwareUse[];
}

export interface JavaView {
  role: "auto" | "teleop";
  label: string;
  state: "INIT" | "RODANDO" | "PARADO";
  telemetry: string;
  error: string | null;
}

export interface BotOptions {
  /** Parceiro na aliança vermelha. */
  partner: boolean;
  /** O parceiro é pilotado por um 2º jogador local (o bot só faz o AUTO dele). */
  partnerPlayer?: boolean;
  /** Robôs na aliança azul (0 a 2). */
  opponents: 0 | 1 | 2;
  level: BotLevel;
}

interface BotRobot {
  robot: Robot;
  brain: BotBrain;
  alliance: Alliance;
  slot: 0 | 1;
  label: string;
  /** Pilotado pelo 2º jogador no TELEOP. */
  human: boolean;
}

/** Largada dos bots (G304: tocando a parede da própria aliança, fora da LOADING ZONE). */
const BOT_STARTS: Record<Alliance, Array<{ x: number; y: number; heading: number }>> = {
  red: [RED_START, { x: -63, y: 2, heading: 0 }],
  blue: [
    { x: 63, y: 48, heading: Math.PI },
    { x: 63, y: -2, heading: Math.PI },
  ],
};
const BOT_PRESETS: BotPresetId[] = ["gobilda", "revDuo", "andymark"];
const BOT_NECTAR_INTERVAL_S = 4;

export interface GameOptions {
  mode: GameMode;
  quality: Quality;
  autoProgram: AutoProgramId;
  teamNumber: string;
  eventName: string;
  matchLabel: string;
  /** Tempo entre lançamentos na rajada (s); depende do mecanismo do robô. */
  launchIntervalS: number;
  robotPreset: RobotPresetId;
  /** Robô importado na Oficina; o modelo 3D e as medidas vêm do CAD. */
  robotModelId?: string;
  /** Código Java da equipe (AUTO e/ou TELEOP). */
  java?: JavaSetup;
  /** Parceiro e adversários controlados pelo simulador. */
  bots?: BotOptions;
}

export interface FoulEntry {
  rule: string;
  alliance: Alliance;
  penalty: "minor" | "major";
  text: string;
  clock: string;
}

export interface GameView {
  mode: GameMode;
  started: boolean;
  paused: boolean;
  clock: ClockState;
  clockText: string;
  phaseLabel: string;
  score: MatchScore;
  hopper: string[];
  intakeOn: boolean;
  launcherSpeed: number;
  launcherPitch: number;
  launchIntervalS: number;
  bursting: boolean;
  nectarAvailable: number;
  nectarInArea: number;
  /** NECTAR de cada aliança que ainda está fora do campo (com o HUMAN PLAYER). */
  nectarOffField: Record<Alliance, number>;
  cameraLabel: string;
  relativeDrive: boolean;
  fouls: FoulEntry[];
  messages: string[];
  fps: number;
  settling: boolean;
  /** Onde as duas HIVEs aparecem na tela (px do canvas), para o placar ficar translúcido sobre elas. */
  hiveRect: { left: number; top: number; right: number; bottom: number } | null;
  teamNumber: string;
  eventName: string;
  matchLabel: string;
  /** Equipes de cada aliança, na ordem do placar. */
  teams: Record<Alliance, string[]>;
  /** OpMode Java em execução (telemetria para o HUD). */
  java: JavaView | null;
  /** Replay em andamento (o jogo fica parado enquanto isso). */
  replay: { time: number; length: number; playing: boolean; speed: number } | null;
}

export interface GameCallbacks {
  onView(view: GameView): void;
  onFinished(view: GameView): void;
  onPauseRequest(): void;
  onOverlayModeRequest(): void;
}

interface NectarPool {
  /** NECTAR inicial ainda na ALLIANCE AREA (5 no começo, §10.3.1). */
  staged: number;
  introducedFromStaging: number;
  /** NECTAR que saiu do campo e voltou à equipe: pode reentrar a qualquer momento (G426). */
  returned: number;
}

const SETTLE_SECONDS = 3; // apuração depois que tudo para (§10.5)
const TOAST_SECONDS = 2;

/** Cantos das duas HIVEs (inclinadas ou não), no mundo, para saber onde aparecem na tela. */
const HIVE_POINTS = [-1, 1].flatMap((sx) =>
  [-1, 1].flatMap((sy) => [30, 66].map((z) => toWorld(sx * (HIVE.centerX.blue + HIVE.cellWidth / 2), sy * (HIVE.cellInnerY + HIVE.cellDepth), z))),
);
const PHASE_LABELS = { pre: "Pronto", auto: "AUTO", transition: "Transição", teleop: "TELEOP", post: "Fim" } as const;

export class Game {
  private readonly stage: Stage;
  private disposed = false;
  private readonly physics: PhysicsWorld;
  private readonly elements: ElementManager;
  private readonly hives: Record<Alliance, Hive>;
  private readonly flowers: Flower[];
  private readonly robot: Robot;
  private readonly bots: BotRobot[] = [];
  private botNectarTimer = 0;
  private secondInput: SecondPlayerState | null = null;
  private readonly environment: Environment;
  private readonly controls = new Controls();
  private readonly auto: AutoRunner;

  private started = false;
  private paused = false;
  private finished = false;
  private elapsed = 0; // segundos de partida (simulação)
  private accumulator = 0;
  private settleTimer = 0;
  private lastFrame = 0;
  private raf = 0;
  private relativeDrive = true;
  private lastViewAt = 0;
  private fpsFrames = 0;
  private fpsTime = 0;
  private fps = 0;
  private lastControls: ControlState | null = null;

  private readonly tips: Record<Alliance, { auto: number; teleop: number }> = { red: { auto: 0, teleop: 0 }, blue: { auto: 0, teleop: 0 } };
  private readonly pools: Record<Alliance, NectarPool> = {
    red: { staged: 5, introducedFromStaging: 0, returned: 0 },
    blue: { staged: 5, introducedFromStaging: 0, returned: 0 },
  };
  private autoResult: Record<Alliance, { leave: [boolean, boolean]; park: [boolean, boolean] }> | null = null;
  private readonly fouls: FoulEntry[] = [];
  private readonly foulMonitor = new FoulMonitor();
  private readonly messages: Array<{ text: string; until: number }> = [];
  private finalScore: MatchScore | null = null;
  private readonly recorder = new ReplayRecorder();
  private replay: ReplayPlayer | null = null;
  private lastScores = { red: 0, blue: 0 };
  readonly sound = new SoundBoard();
  private lastPhase: ClockState["phase"] | null = null;
  private lastFlowerUnlocked = false;
  private readonly cuesPlayed = new Set<MatchCue>();
  // Código Java: um HardwareBus por OpMode em execução
  private javaBus: HardwareBus | null = null;
  private javaRole: "auto" | "teleop" | null = null;
  private readonly retiring: Array<{ bus: HardwareBus; until: number }> = [];
  private gamepads: GamepadSource | null = null;
  private lastPose = { x: 0, y: 0, h: 0, vx: 0, vy: 0, vh: 0 };

  static async create(container: HTMLElement, options: GameOptions, callbacks: GameCallbacks): Promise<Game> {
    await initPhysics();
    let cad: CadRobot | undefined;
    if (options.robotModelId) {
      // CAD importado na Oficina; se sumiu do aparelho, joga com o modelo próprio da variante
      const stored = await getRobot(options.robotModelId).catch(() => undefined);
      if (stored) cad = { model: await loadStoredModel(stored.glb), sizeIn: stored.sizeIn };
    }
    // CADs oficiais dos starter bots (médio e alto), para o robô do jogador e para os bots
    const presetModel = await loadRobotModels(options.quality === "low" ? [] : [options.robotPreset, ...BOT_PRESETS]);
    return new Game(container, options, callbacks, cad, presetModel);
  }

  private constructor(
    container: HTMLElement,
    readonly options: GameOptions,
    private readonly callbacks: GameCallbacks,
    cad?: CadRobot,
    private readonly presetModel: (id: BotPresetId) => THREE.Object3D | undefined = () => undefined,
  ) {
    const quality = QUALITY_SETTINGS[options.quality];
    this.stage = new Stage(container, options.quality, "red");
    this.physics = createWorld(1 / quality.physicsHz);
    const field = buildField(this.physics, this.stage.scene);
    this.environment = new Environment(this.stage.scene, options.quality);
    this.elements = new ElementManager(this.physics, this.stage.scene, quality.sphereSegments);
    this.hives = {
      red: new Hive("red", this.physics, this.stage.scene, ALLIANCE_COLORS.red),
      blue: new Hive("blue", this.physics, this.stage.scene, ALLIANCE_COLORS.blue),
    };
    this.flowers = FLOWERS.map((spec) => new Flower(spec, this.physics, this.stage.scene));
    // Modelos detalhados da arena (médio e alto): entram quando terminam de carregar; sem eles, ficam as peças do código.
    if (options.quality !== "low") {
      void loadFieldModels().then((models) => {
        if (!models || this.disposed) return;
        this.hives.red.setModel(models.hive(ALLIANCE_COLORS.red));
        this.hives.blue.setModel(models.hive(ALLIANCE_COLORS.blue));
        for (const flower of this.flowers) flower.setModel(models.flower());
        field.hiveFrame.clear();
        field.hiveFrame.add(models.hiveFrame());
      });
    }
    this.robot = new Robot(
      { ...robotConfigFromPreset(withCadSize(robotPreset(options.robotPreset), cad)), alliance: "red", teamNumber: options.teamNumber, start: RED_START, launchIntervalS: options.launchIntervalS },
      this.physics,
      this.stage.scene,
      cad?.model ?? this.presetModel(options.robotPreset),
    );
    this.robot.onLaunch = () => this.sound.launch(this.pan(this.robot.group.position.x));
    this.createBots(options.bots);
    this.auto = new AutoRunner(options.mode === "match" ? buildAutoSteps(options.autoProgram) : []);
    this.stageElements();
    if (options.mode === "practice") this.started = true;

    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    // Só em desenvolvimento: permite inspecionar o estado pelo console do navegador.
    if (import.meta.env.DEV) (window as unknown as { __buzz?: unknown }).__buzz = this.debugHandle();
  }

  private debugHandle() {
    return {
      elements: () => this.elements.elements.map((e) => ({ kind: e.kind, ...this.elements.position(e) })),
      hives: () => Object.fromEntries((["red", "blue"] as const).map((a) => [a, { upSide: this.hives[a].logic.upSide, tipping: this.hives[a].logic.tipping, inUpCell: this.hives[a].elementsInUpCell(this.elements).length }])),
      flowers: () => this.flowers.map((f) => ({ id: f.spec.id, stack: f.stack(this.elements).stack })),
      robot: () => ({ ...this.robot.pose(), hopper: [...this.robot.hopper], touchingWall: this.robot.touchingWall(), inLZ: this.robot.partiallyIn(LOADING_ZONES.red) }),
      tips: () => this.tips,
      view: () => this.view(),
      teleport: (x: number, y: number, heading: number) => {
        const p = new THREE.Vector3(x * 0.0254, 0.07, -y * 0.0254);
        this.robot.body.setTranslation(p, true);
        this.robot.body.setRotation({ x: 0, y: Math.sin(heading / 2), z: 0, w: Math.cos(heading / 2) }, true);
      },
      aim: (speed: number, pitch: number) => {
        this.robot.launcherSpeed = speed;
        this.robot.launcherPitchDeg = pitch;
      },
      launch: () => this.robot.launchOne(this.elements, true),
      place: () => this.robot.flowerAction(this.elements, true),
      give: (kind: "pollen" | "redNectar") => this.robot.hopper.push(kind),
      camera: (mode: "audience" | "driver" | "follow" | "top" | "free") => this.stage.setCamera(mode),
      scene: () => this.stage.scene,
      /** Desenha um quadro agora (a aba em segundo plano não recebe requestAnimationFrame); devolve o tempo (ms). */
      render: () => {
        const t = performance.now();
        this.stage.render();
        return performance.now() - t;
      },
      skipTo: (elapsedSeconds: number) => (this.elapsed = elapsedSeconds),
      /** Roda `seconds` de simulação de uma vez, sem esperar os quadros (testes com a aba em segundo plano). */
      advance: (seconds: number) => {
        if (this.bots.some((b) => b.human)) this.secondInput = this.controls.pollSecond();
        const input = this.controls.poll();
        const steps = Math.round(seconds / this.physics.dt);
        for (let i = 0; i < steps && !this.finished; i++) this.fixedStep(this.physics.dt, input, false, false, false);
        this.elements.sync();
        this.robot.sync();
        for (const bot of this.bots) bot.robot.sync(false);
        for (const hive of Object.values(this.hives)) hive.syncVisual();
      },
      bots: () => this.bots.map((b) => ({ label: b.label, alliance: b.alliance, state: b.brain.currentState, hopper: b.robot.hopper.length, ...b.robot.pose() })),
      followOrbit: () => ({ ...this.stage.followOrbit }),
      sleeping: () => this.elements.elements.map((e) => e.body.isSleeping()),
      wakeAll: () => this.elements.elements.forEach((e) => e.body.wakeUp()),
      /** Colisores que ocupariam uma esfera de raio r (pol) centrada em (x, y, z). */
      overlapsSphere: (x: number, y: number, z: number, r: number) => {
        const c = toWorld(x, y, z);
        const found: Array<{ fixed: boolean; shape: number; at: { x: number; y: number; z: number }; halfExtents?: number[] }> = [];
        this.physics.world.intersectionsWithShape({ x: c.x, y: c.y, z: c.z }, { x: 0, y: 0, z: 0, w: 1 }, new RAPIER.Ball(r * INCH), (other) => {
          const t = other.translation();
          const shape = other.shape as unknown as { halfExtents?: { x: number; y: number; z: number } };
          found.push({
            fixed: !other.parent()?.isDynamic(),
            shape: other.shape.type,
            at: { x: +(t.x / INCH).toFixed(2), y: +(-t.z / INCH).toFixed(2), z: +(t.y / INCH).toFixed(2) },
            halfExtents: shape.halfExtents ? [shape.halfExtents.x / INCH, shape.halfExtents.y / INCH, shape.halfExtents.z / INCH].map((v) => +v.toFixed(2)) : undefined,
          });
          return true;
        });
        return found;
      },
      kickNear: (x: number, y: number, vy: number) =>
        this.elements.elements.forEach((e) => {
          const p = this.elements.position(e);
          if (Math.hypot(p.x - x, p.y - y) < 3) e.body.setLinvel({ x: 0, y: vy, z: 0 }, true);
        }),
      setCcdNear: (x: number, y: number, on: boolean) =>
        this.elements.elements.forEach((e) => {
          const p = this.elements.position(e);
          if (Math.hypot(p.x - x, p.y - y) < 3) {
            e.body.enableCcd(on);
            e.body.wakeUp();
          }
        }),
      /** Contatos ativos do elemento mais baixo perto de (x, y): com que ele está encostado. */
      contactsNear: (x: number, y: number) => {
        const near = this.elements.elements
          .map((e) => ({ e, p: this.elements.position(e) }))
          .filter(({ p }) => Math.hypot(p.x - x, p.y - y) < 3)
          .sort((a, b) => b.p.z - a.p.z)[0];
        if (!near) return null;
        const collider = near.e.body.collider(0);
        const contacts: Array<{ fixed: boolean; at: { x: number; y: number; z: number }; shape: number; dist: number }> = [];
        this.physics.world.contactPairsWith(collider, (other) => {
          this.physics.world.contactPair(collider, other, (manifold) => {
            if (manifold.numContacts() === 0) return;
            const t = other.translation();
            contacts.push({
              fixed: !other.parent()?.isDynamic(),
              at: { x: +(t.x / INCH).toFixed(2), y: +(-t.z / INCH).toFixed(2), z: +(t.y / INCH).toFixed(2) },
              shape: other.shape.type,
              dist: +(manifold.contactDist(0) / INCH).toFixed(3),
            });
          });
        });
        return { ball: near.p, vy: near.e.body.linvel().y, gravityScale: near.e.body.gravityScale(), contacts };
      },
      velocities: () => this.elements.elements.map((e) => +e.body.linvel().y.toFixed(3)),
      /** Todos os corpos não fixos perto de (x, y) em pol: tipo, altura e se é um elemento registrado. */
      bodiesNear: (x: number, y: number, r: number) => {
        const out: Array<{ handle: number; z: number; kind: string; registered: boolean; colliders: number }> = [];
        this.physics.world.forEachRigidBody((body) => {
          if (body.isFixed()) return;
          const t = body.translation();
          const p = { x: t.x / INCH, y: -t.z / INCH, z: t.y / INCH };
          if (Math.hypot(p.x - x, p.y - y) > r) return;
          out.push({
            handle: body.handle,
            z: +p.z.toFixed(2),
            kind: body.isKinematic() ? "kinematic" : "dynamic",
            registered: this.elements.elements.some((e) => e.body.handle === body.handle),
            colliders: body.numColliders(),
          });
        });
        return out;
      },
      /** Raio vertical para baixo a partir de (x, y, z) em pol: distância até o primeiro colisor fixo/cinemático. */
      probeDown: (x: number, y: number, z: number) => {
        const origin = toWorld(x, y, z);
        const hits: Array<{ toi: number; fixed: boolean }> = [];
        this.physics.world.intersectionsWithRay(
          new RAPIER.Ray({ x: origin.x, y: origin.y, z: origin.z }, { x: 0, y: -1, z: 0 }),
          z * INCH + 0.01,
          false,
          (hit) => {
            const parent = hit.collider.parent();
            hits.push({ toi: +(hit.timeOfImpact / INCH).toFixed(2), fixed: !!parent && !parent.isDynamic() });
            return true;
          },
        );
        return hits.sort((a, b) => a.toi - b.toi);
      },
    };
  }

  bindTouch(root: HTMLElement): void {
    this.controls.bindTouch(root);
  }

  /** Coloca os elementos nas posições iniciais (§10.3.1 p.81–82). */
  private stageElements(): void {
    const { pollenRadius: rp, nectarRadius: rn } = ELEMENTS;
    for (const flower of this.flowers) {
      for (const p of flower.stagingPositions()) this.elements.spawn("pollen", p.x, p.y, p.z);
    }
    // GARDEN: em linha a partir do canto mais perto da ALLIANCE AREA, encostado na parede
    for (let i = 0; i < 4; i++) {
      this.elements.spawn("pollen", GARDENS.red.xMin + rp + 0.05 + i * (2 * rp + 0.05), -FIELD.half + rp + 0.05, rp + 0.02);
      this.elements.spawn("pollen", GARDENS.blue.xMax - rp - 0.05 - i * (2 * rp + 0.05), FIELD.half - rp - 0.05, rp + 0.02);
    }
    // 3 NECTAR na CELL de cima: encostados no fundo, em linha junto à lateral do lado da aliança
    for (const alliance of ["red", "blue"] as const) {
      const hive = this.hives[alliance];
      const side = hive.logic.upSide;
      const lateral = alliance === "red" ? -1 : 1;
      for (let i = 0; i < 3; i++) {
        const p = hive.localToField(
          lateral * (HIVE.cellWidth / 2 - rn - 0.3),
          side * (HIVE.cellInnerY + rn + 0.3 + i * (2 * rn + 0.15)),
          HIVE.cellBottomZ + rn + 0.6,
        );
        this.elements.spawn(nectarOf(alliance), p.x, p.y, p.z);
      }
    }
    // Pré-carga: 4 POLLEN no depósito de cada robô (G304.G)
    for (const robot of [this.robot, ...this.bots.map((b) => b.robot)]) robot.hopper.push("pollen", "pollen", "pollen", "pollen");
    // Robôs ausentes: POLLEN no centro da LOADING ZONE, contra a parede (§10.3.1)
    const absent: Array<[Alliance, number]> = [
      ["red", 2 - this.robotsOf("red").length],
      ["blue", 2 - this.robotsOf("blue").length],
    ];
    for (const [alliance, robots] of absent) {
      const lz = LOADING_ZONES[alliance];
      const wallX = alliance === "red" ? lz.xMin + rp + 0.1 : lz.xMax - rp - 0.1;
      const inward = alliance === "red" ? 1 : -1;
      const cy = (lz.yMin + lz.yMax) / 2;
      for (let r = 0; r < robots; r++) {
        for (let i = 0; i < 4; i++) {
          this.elements.spawn("pollen", wallX + inward * r * (2 * rp + 0.1), cy + (i - 1.5) * (2 * rp + 0.1), rp + 0.02);
        }
      }
    }
  }

  private createBots(options?: BotOptions): void {
    if (!options) return;
    const wanted: Array<[Alliance, 0 | 1]> = [];
    if (options.partner || options.partnerPlayer) wanted.push(["red", 1]);
    for (let i = 0; i < options.opponents; i++) wanted.push(["blue", i as 0 | 1]);
    wanted.forEach(([alliance, slot], i) => {
      const presetId = BOT_PRESETS[i % BOT_PRESETS.length];
      const preset = ROBOT_PRESETS[presetId];
      const human = !!options.partnerPlayer && alliance === "red";
      const label = human ? "JOGADOR 2" : `BOT ${i + 1}`;
      const robot = new Robot(
        { ...robotConfigFromPreset(preset), alliance, teamNumber: label, start: BOT_STARTS[alliance][slot] },
        this.physics,
        this.stage.scene,
        this.presetModel(presetId),
      );
      robot.onLaunch = () => this.sound.launch(this.pan(robot.group.position.x));
      this.bots.push({ robot, brain: new BotBrain(alliance, options.level), alliance, slot, label, human });
    });
  }

  /** O que um bot enxerga: elementos soltos, a própria HIVE e os outros robôs. */
  private botWorld(bot: BotRobot, clock: ClockState, enabled: boolean): BotWorld {
    const robot = bot.robot;
    const all = [this.robot, ...this.bots.map((b) => b.robot)];
    return {
      pose: () => robot.pose(),
      hopperCount: () => robot.hopper.length,
      pickups: () =>
        this.elements.elements
          .filter((e) => e.kind === "pollen" || allianceOfNectar(e.kind) === bot.alliance)
          .map((e) => ({ id: e.id, ...this.elements.position(e) })),
      hiveUpSide: () => this.hives[bot.alliance].logic.upSide,
      launchExit: () => robot.launchExitInfo,
      setAim: (speed, pitch) => {
        robot.launcherSpeed = speed;
        robot.launcherPitchDeg = pitch;
      },
      startBurst: () => robot.startBurst(enabled),
      bursting: () => robot.bursting,
      others: () => all.filter((r) => r !== robot).map((r) => r.pose()),
      allies: () => this.robotsOf(bot.alliance).filter((r) => r !== robot).map((r) => r.pose()),
      secondsLeft: () => (this.options.mode === "practice" ? Infinity : clock.matchSecondsRemaining),
      isAuto: () => this.options.mode === "match" && clock.phase === "auto",
    };
  }

  private stepBots(dt: number, clock: ClockState, enabled: boolean): void {
    for (const bot of this.bots) {
      if (bot.human && (clock.driverControl || this.options.mode === "practice")) {
        this.stepSecondPlayer(bot, dt, enabled);
        continue;
      }
      const out = enabled ? bot.brain.update(dt, this.botWorld(bot, clock, enabled)) : { drive: { forward: 0, strafe: 0, turn: 0 }, intake: false };
      bot.robot.intakeOn = out.intake;
      bot.robot.drive(out.drive, dt, enabled);
      bot.robot.updateBurst(this.elements, enabled);
      bot.robot.updateIntake(this.elements, enabled);
    }
    // HUMAN PLAYER azul (do simulador) entrega NECTAR quando a regra libera
    if (this.bots.some((b) => b.alliance === "blue")) {
      this.botNectarTimer -= dt;
      if (this.botNectarTimer <= 0 && this.nectarAvailable("blue", clock) > 0 && clock.phase !== "pre" && clock.phase !== "post") {
        this.botNectarTimer = BOT_NECTAR_INTERVAL_S;
        this.introduceNectar("blue", clock, true);
      }
    }
  }

  /** 2º jogador: comandos do teclado (IJKL) ou do 2º controle, com mira automática na CELL de cima. */
  private stepSecondPlayer(bot: BotRobot, dt: number, enabled: boolean): void {
    const input = this.secondInput;
    const robot = bot.robot;
    robot.intakeOn = !!input?.intakeHeld;
    robot.drive(input ? { forward: input.forward, strafe: input.strafe, turn: input.turn } : { forward: 0, strafe: 0, turn: 0 }, dt, enabled);
    if (input?.launch) {
      // sem ajuste fino no teclado: o lançador mira pela distância até a HIVE, como um robô com visão
      const upSide = this.hives[bot.alliance].logic.upSide;
      const pose = robot.pose();
      const shot = hiveShot(bot.alliance, upSide, robot.launchExitInfo, Math.max(30, upSide * pose.y));
      robot.launcherSpeed = shot.aim.speed;
      robot.launcherPitchDeg = shot.aim.pitchDeg;
      robot.startBurst(enabled);
    }
    if (input?.place) robot.flowerAction(this.elements, enabled);
    if (input) input.launch = input.place = false;
    robot.updateBurst(this.elements, enabled);
    robot.updateIntake(this.elements, enabled);
  }

  /** Robôs de cada aliança na ordem do placar (vermelho 1 = jogador). */
  private robotsOf(alliance: Alliance): Robot[] {
    const list: Robot[] = alliance === "red" ? [this.robot] : [];
    for (const bot of [...this.bots].sort((a, b) => a.slot - b.slot)) if (bot.alliance === alliance) list.push(bot.robot);
    return list;
  }

  startMatch(): void {
    if (this.options.mode === "match" && !this.started) {
      this.started = true;
      this.elapsed = 0;
      this.flash("Partida iniciada: AUTO de 30 s");
    }
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.lastFrame = performance.now();
  }

  setCamera(): void {
    this.stage.cycleCamera();
  }

  private flash(text: string, seconds = TOAST_SECONDS): void {
    this.messages.push({ text, until: performance.now() + seconds * 1000 });
  }

  private clock(): ClockState {
    if (this.options.mode === "practice") {
      return { phase: "teleop", displaySeconds: this.elapsed, matchSecondsRemaining: 999, flowerUnlocked: true, robotsEnabled: true, driverControl: true };
    }
    if (!this.started) return clockAt(-1);
    return clockAt(this.elapsed);
  }

  private readonly frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const realDt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    this.fpsFrames++;
    this.fpsTime += realDt;
    if (this.fpsTime >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }

    if (this.bots.some((b) => b.human)) {
      // ações de toque único se acumulam até o próximo passo da física consumir
      const second = this.controls.pollSecond();
      const prev = this.secondInput;
      this.secondInput = { ...second, launch: second.launch || !!prev?.launch, place: second.place || !!prev?.place };
    }
    const input = this.controls.poll();
    this.lastControls = input;
    if (input.pause) this.callbacks.onPauseRequest();
    if (input.camera) this.stage.cycleCamera();
    if (input.overlayMode) this.callbacks.onOverlayModeRequest();
    if (this.stage.mode === "follow" && (input.cameraYaw || input.cameraPitch)) {
      this.stage.adjustFollow(input.cameraYaw * 2.4 * realDt, input.cameraPitch * 1.6 * realDt, 0);
    }
    if (input.toggleRelative) {
      this.relativeDrive = !this.relativeDrive;
      this.flash(this.relativeDrive ? "Direção relativa à câmera" : "Direção relativa ao robô");
    }

    if (!this.paused && !this.finished && !this.replay) {
      // ajustes do lançador (contínuos enquanto a tecla estiver pressionada)
      this.robot.launcherSpeed = Math.min(10, Math.max(2, this.robot.launcherSpeed + input.speedDelta * 2.5 * realDt));
      this.robot.launcherPitchDeg = Math.min(80, Math.max(10, this.robot.launcherPitchDeg + input.pitchDelta * 30 * realDt));

      this.accumulator += realDt;
      const dt = this.physics.dt;
      let steps = 0;
      let launchPending = input.launch;
      let placePending = input.place;
      let nectarPending = input.nectar;
      while (this.accumulator >= dt && steps < 8) {
        this.fixedStep(dt, input, launchPending, placePending, nectarPending);
        launchPending = placePending = nectarPending = false;
        this.accumulator -= dt;
        steps++;
      }
      if (steps === 8) this.accumulator = 0;
    }

    if (this.replay) {
      this.replay.update(realDt);
    } else {
      this.elements.sync();
      for (const hit of this.elements.takeImpacts()) this.sound.impact(hit.kind === "pollen" ? "pollen" : "nectar", hit.strength, this.pan(hit.x));
      this.robot.sync(this.clock().driverControl || this.options.mode === "practice");
      for (const bot of this.bots) bot.robot.sync(false);
      for (const hive of Object.values(this.hives)) hive.syncVisual();
      if (this.started && !this.paused && !this.finished) this.recordFrame(realDt);
    }
    // na câmera do piloto, as pessoas da própria ALLIANCE AREA ficam coladas à câmera e tapavam metade do campo
    this.environment.alliances.red.visible = this.stage.mode !== "driver";
    for (const alliance of ["red", "blue"] as const) this.environment.setNectarStock(alliance, this.pools[alliance].staged + this.pools[alliance].returned);
    // pausado ou em replay, as pessoas param junto com o jogo
    this.environment.update(this.paused || this.replay ? 0 : realDt, this.stage.camera.position);
    // a câmera do robô segue o modelo (no replay, a pose gravada)
    const g = this.robot.group;
    this.stage.update({ position: g.position.clone(), heading: yawOf(g.quaternion) });
    this.stage.render();

    if (now - this.lastViewAt > 100) {
      this.lastViewAt = now;
      this.callbacks.onView(this.view());
    }
  };

  /** Fase do código Java: qual OpMode deveria estar rodando agora e em que estado. */
  private javaTarget(clock: ClockState): { role: "auto" | "teleop"; state: number } | null {
    const j = this.options.java;
    if (!j) return null;
    if (this.options.mode === "practice") return j.teleop ? { role: "teleop", state: 1 } : null;
    if (!this.started || clock.phase === "pre") return j.auto ? { role: "auto", state: 0 } : null;
    if (clock.phase === "auto") return j.auto ? { role: "auto", state: 1 } : null;
    if (clock.phase === "transition") return j.teleop ? { role: "teleop", state: 0 } : null;
    if (clock.phase === "post") return null;
    return j.teleop ? { role: "teleop", state: 1 } : null;
  }

  private updateJava(clock: ClockState, dt: number, enabled: boolean) {
    // OpModes que saíram de cena recebem mais alguns passos para terminar o laço (STOP)
    for (let i = this.retiring.length - 1; i >= 0; i--) {
      const r = this.retiring[i];
      r.bus.step(dt, false);
      r.until -= dt;
      if (r.bus.ended || r.until <= 0) this.retiring.splice(i, 1);
    }
    const target = this.javaTarget(clock);
    if (this.javaBus && (!target || target.role !== this.javaRole)) {
      this.javaBus.state = 2;
      this.retiring.push({ bus: this.javaBus, until: 2 });
      this.javaBus = null;
      this.javaRole = null;
    }
    if (!target) return null;
    if (!this.javaBus) {
      const run = this.options.java![target.role]!;
      this.javaBus = this.startOpMode(run);
      this.javaRole = target.role;
    }
    const bus = this.javaBus;
    if (target.state > bus.state) bus.state = target.state;
    this.updatePose(dt);
    const actions = bus.step(dt, enabled && bus.state === 1);
    return bus.state === 1 && !bus.ended ? actions : null;
  }

  private startOpMode(run: JavaOpModeRun): HardwareBus {
    const java = this.options.java!;
    this.gamepads ??= new GamepadSource(this.bots.some((b) => b.human));
    const gamepads = this.gamepads;
    const inputs = {
      pose: () => this.lastPose,
      gamepad: (i: number, f: string) => gamepads.read(i, f),
      aprilTags: (mount: CameraMount, intrinsics: CameraIntrinsics) => {
        const robot = this.robot.pose();
        const tags = [...hiveTags("red", this.hives.red.logic.angle), ...hiveTags("blue", this.hives.blue.logic.angle)];
        return { detections: detectTags(robot, tags, mount, intrinsics), robot };
      },
      tagLibrary: () =>
        (["red", "blue"] as const).flatMap((a) => hiveTags(a, ((HIVE.tiltDeg * Math.PI) / 180) * HIVE_INITIAL_UP_SIDE[a]).map((t) => ({ id: t.id, ...t.center }))),
    };
    const bus = new HardwareBus(java.deviceMap, java.hardware, inputs, (text) => {
      if (text.startsWith("OPMODE_ERROR")) this.flash(`Erro no OpMode ${run.label}: ${text.replace("OPMODE_ERROR ", "").split("\n")[0]}`, 6);
    });
    bus.install();
    runProgram(run.js).catch((error) => {
      bus.ended = true;
      bus.error = String(error);
      this.flash(`O OpMode ${run.label} parou: ${String(error).slice(0, 120)}`, 6);
    });
    return bus;
  }

  /** Pose verdadeira para a odometria e a IMU do código (mm, rad), com velocidades por diferença. */
  private updatePose(dt: number): void {
    const p = this.robot.pose();
    const x = p.x * 25.4;
    const y = p.y * 25.4;
    let dh = p.heading - this.lastPose.h;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this.lastPose = { x, y, h: p.heading, vx: (x - this.lastPose.x) / dt, vy: (y - this.lastPose.y) / dt, vh: dh / dt };
  }

  private javaView(): JavaView | null {
    const bus = this.javaBus;
    const role = this.javaRole;
    if (!bus || !role) return null;
    return {
      role,
      label: this.options.java![role]!.label,
      state: bus.ended || bus.state === 2 ? "PARADO" : bus.state === 1 ? "RODANDO" : "INIT",
      telemetry: bus.telemetry,
      error: bus.error,
    };
  }

  /** Posição horizontal na tela (-1 esquerda, 1 direita) para o som estéreo. */
  private pan(worldX: number): number {
    return (worldX - this.stage.camera.position.x) / 2.5;
  }

  /** Avisos sonoros da partida, na mesma sequência dos eventos. */
  private phaseSounds(clock: ClockState): void {
    if (this.options.mode !== "match") return;
    if (this.lastPhase !== null && clock.phase !== this.lastPhase) {
      this.cuesPlayed.clear();
      if (clock.phase === "auto") this.sound.cue("matchStart");
      else if (clock.phase === "transition") {
        this.sound.cue("autoEnd");
        // "peguem os controles" logo depois da buzina do fim do AUTO
        this.sound.cue("controllers", 2.2);
      } else if (clock.phase === "teleop") this.sound.cue("teleopStart");
      else if (clock.phase === "post") {
        this.sound.cue("matchEnd");
        this.sound.cue("results", 3.5);
      }
    }
    const once = (cue: MatchCue, when: boolean) => {
      if (!when || this.cuesPlayed.has(cue)) return;
      this.cuesPlayed.add(cue);
      this.sound.cue(cue);
    };
    // contagem 3-2-1 nos últimos segundos da transição; avisos no TELEOP: FLOWERS liberadas e 30 s finais
    once("countdown", clock.phase === "transition" && clock.displaySeconds <= 3.05);
    once("midMatch", clock.phase === "teleop" && clock.flowerUnlocked && !this.lastFlowerUnlocked && this.started);
    once("endgameWarning", clock.phase === "teleop" && clock.matchSecondsRemaining <= 30);
    this.lastPhase = clock.phase;
    this.lastFlowerUnlocked = clock.flowerUnlocked;
  }

  toggleMute(): boolean {
    return this.sound.toggleMute();
  }

  private fixedStep(dt: number, input: ControlState, launch: boolean, place: boolean, nectar: boolean): void {
    const before = this.clock();
    this.phaseSounds(before);
    const matchRunning = this.started && before.phase !== "pre";
    const enabled = before.robotsEnabled && matchRunning;

    // Código Java da equipe: INIT antes do START, START junto com a fase, STOP no fim da fase
    const java = this.updateJava(before, dt, enabled);

    // Comandos do robô: programa no AUTO, piloto no TELEOP (ou o OpMode Java, quando houver)
    let command = { forward: 0, strafe: 0, turn: 0 };
    if (java) {
      command = { forward: java.forward, strafe: java.strafe, turn: java.turn };
      this.robot.intakeOn = java.intakeOn;
      if (java.launch) this.robot.launchOne(this.elements, enabled);
      if (java.place) this.robot.flowerAction(this.elements, enabled);
      // o lançador do código só manda quando o volante está girando
      if (java.launcherSpeed !== null && java.launcherSpeed > 0.5) this.robot.launcherSpeed = java.launcherSpeed;
      if (java.launcherPitchDeg !== null) this.robot.launcherPitchDeg = java.launcherPitchDeg;
    } else if (before.phase === "auto" && this.options.mode === "match") {
      command = this.auto.update(dt, {
        pose: () => this.robot.pose(),
        setAim: (speed, pitch) => {
          this.robot.launcherSpeed = speed;
          this.robot.launcherPitchDeg = pitch;
        },
        launchAll: () => this.robot.startBurst(true),
        hopperCount: () => this.robot.hopper.length,
      });
      this.robot.intakeOn = false;
    } else if (before.driverControl) {
      command = this.driverCommand(input);
      this.robot.intakeOn = input.intakeHeld;
      if (launch) this.robot.startBurst(true);
      if (place) this.robot.flowerAction(this.elements, true);
    } else {
      this.robot.intakeOn = false;
    }
    this.robot.drive(command, dt, before.robotsEnabled && matchRunning);
    this.stepBots(dt, before, this.options.mode === "practice" ? true : enabled);
    this.robot.updateBurst(this.elements, before.robotsEnabled && matchRunning);
    this.robot.updateIntake(this.elements, before.robotsEnabled && matchRunning);

    if (nectar) this.introduceNectar("red", before);

    this.physics.world.step();
    if (matchRunning && !this.finished) this.elapsed += dt;
    const after = this.clock();

    for (const alliance of ["red", "blue"] as const) {
      if (this.hives[alliance].step(dt, this.elements)) {
        // TIP concluído antes do início do TELEOP conta como AUTO (§10.5.B)
        const isAuto = this.options.mode === "match" && (after.phase === "auto" || after.phase === "transition");
        this.tips[alliance][isAuto ? "auto" : "teleop"]++;
        this.flash(`HIVE ${alliance === "red" ? "vermelha" : "azul"} virou! +${RULES.points.teleopHiveTip} pontos e +1 NECTAR liberado`);
        this.sound.tip();
        this.environment.cheer(alliance);
      }
    }

    this.checkEarlyNectarInFlowers(after);
    this.handleOutOfField(after);
    if (this.options.mode === "match" && enabled) this.checkContactFouls(dt, after);

    if (this.options.mode === "match") {
      if (before.phase === "auto" && after.phase !== "auto") {
        // LEAVE e PARK do AUTO são avaliados no fim do AUTO (§10.5.F)
        this.autoResult = this.leaveAndPark();
        this.flash("Fim do AUTO: robôs parados por 8 s (G403)");
      }
      if (before.phase === "transition" && after.phase === "teleop") this.flash("TELEOP: pilotos no controle!");
      if (before.phase === "teleop" && before.matchSecondsRemaining > RULES.flowerUnlockClock && after.flowerUnlocked) {
        this.flash("1:00 — FLOWERS liberadas e todo o NECTAR pode entrar!");
      }
      if (after.phase === "post" && !this.finished) {
        this.settleTimer += dt;
        if (this.settleTimer >= SETTLE_SECONDS) this.finish();
      }
    }
  }

  /** Converte o comando do piloto em comando do robô (relativo à câmera ou ao robô). */
  private driverCommand(input: ControlState) {
    const heading = this.robot.pose().heading;
    if (!this.relativeDrive) return { forward: input.moveY, strafe: -input.moveX, turn: input.turn };
    const f = this.stage.forwardOnField();
    const right = { x: f.y, y: -f.x };
    const dx = f.x * input.moveY + right.x * input.moveX;
    const dy = f.y * input.moveY + right.y * input.moveX;
    return {
      forward: dx * Math.cos(heading) + dy * Math.sin(heading),
      strafe: -dx * Math.sin(heading) + dy * Math.cos(heading),
      turn: input.turn,
    };
  }

  private nectarAvailable(alliance: Alliance, clock: ClockState): number {
    const pool = this.pools[alliance];
    if (this.options.mode === "practice") return pool.staged + pool.returned;
    const fromStaging = nectarAllowance({
      inAllianceArea: pool.staged,
      alreadyIntroducedFromStaging: pool.introducedFromStaging,
      ownHiveTips: this.tips[alliance].auto + this.tips[alliance].teleop,
      matchSecondsRemaining: clock.matchSecondsRemaining,
      phase: clock.phase,
    });
    return fromStaging + (clock.phase === "pre" || clock.phase === "post" ? 0 : pool.returned);
  }

  /** HUMAN PLAYER introduz NECTAR pela LOADING ZONE (G426, G427). */
  /** `quiet`: HUMAN PLAYER do simulador (aliança dos bots), sem avisos na tela. */
  private introduceNectar(alliance: Alliance, clock: ClockState, quiet = false): void {
    const pool = this.pools[alliance];
    if (this.nectarAvailable(alliance, clock) <= 0) {
      if (!quiet) this.flash("Ainda não há NECTAR liberado (G426: 1 por TIP da sua HIVE, ou todos com 1:00 restante)");
      return;
    }
    if (pool.returned > 0) pool.returned--;
    else {
      pool.staged--;
      pool.introducedFromStaging++;
    }
    const lz = LOADING_ZONES[alliance];
    const x = alliance === "red" ? lz.xMin + 3 : lz.xMax - 3;
    // o NECTAR já saiu da contagem; ele entra no campo quando o HUMAN PLAYER o solta na LOADING ZONE
    this.environment.requestNectar(alliance, () => {
      if (this.finished) return;
      this.elements.spawn(nectarOf(alliance), x, (lz.yMin + lz.yMax) / 2, 8);
      if (!quiet) this.flash("NECTAR introduzido na LOADING ZONE");
    });
    if (!quiet) this.flash("HUMAN PLAYER buscando um NECTAR");
  }

  /** G410: NECTAR no volume da FLOWER antes de 1:00 restante → MAJOR FOUL por NECTAR. */
  private checkEarlyNectarInFlowers(clock: ClockState): void {
    if (clock.flowerUnlocked || this.options.mode === "practice") return;
    for (const flower of this.flowers) {
      for (const e of flower.stack(this.elements).members) {
        if (!allianceOfNectar(e.kind) || e.earlyFlowerFoul || !e.lastLaunchedBy) continue;
        e.earlyFlowerFoul = true;
        this.fouls.push({
          rule: "G410",
          alliance: e.lastLaunchedBy,
          penalty: "major",
          text: "NECTAR na FLOWER antes de 1:00 restante",
          clock: formatClock(clock.displaySeconds),
        });
        this.flash("MAJOR FOUL (G410): NECTAR na FLOWER antes de 1:00");
      }
    }
  }

  /** G402 e G421: contato entre robôs de alianças diferentes. */
  private checkContactFouls(dt: number, clock: ClockState): void {
    const robots: FoulRobot[] = [
      { robot: this.robot, key: "red-1" },
      ...this.bots.map((b) => ({ robot: b.robot, key: `${b.alliance}-${b.slot + 1}` })),
    ].map(({ robot, key }) => ({
      key,
      alliance: robot.config.alliance,
      footprint: robot.footprint(),
      velocity: robot.velocityIn(),
      push: robot.push,
      blocked: robot.touchingWall(1.5),
    }));
    if (robots.length < 2) return;
    for (const event of this.foulMonitor.update(dt, robots, clock.phase === "auto")) this.addFoul(event.rule, event.alliance, event.penalty, event.text, clock);
  }

  private addFoul(rule: string, alliance: Alliance, penalty: "minor" | "major", text: string, clock: ClockState): void {
    this.fouls.push({ rule, alliance, penalty, text, clock: formatClock(clock.displaySeconds) });
    const who = alliance === "red" ? "vermelha" : "azul";
    this.flash(`${penalty === "major" ? "MAJOR" : "MINOR"} FOUL (${rule}) da aliança ${who}: ${text}`);
  }

  /** Elementos fora do campo: POLLEN volta pelo staff; NECTAR volta para a equipe (§10.8.2). */
  private handleOutOfField(clock: ClockState): void {
    const now = this.elapsed;
    for (const e of [...this.elements.elements]) {
      const p = this.elements.position(e);
      const out = Math.abs(p.x) > FIELD.half + 2 || Math.abs(p.y) > FIELD.half + 2 || p.z < -6;
      if (!out) {
        e.outSince = null;
        // assentou: daqui em diante sair do campo não é mais culpa do lançamento
        if (e.launch) {
          const v = e.body.linvel();
          if (Math.hypot(v.x, v.y, v.z) < 0.15) e.launch = null;
        }
        continue;
      }
      e.outSince ??= now;
      if (now - e.outSince < 1.5 && p.z > -6) continue;
      // G405 pune ejetar de propósito; um arremesso errado na HIVE não é falta. Sem árbitro, a intenção
      // é estimada pela mira: lançado para longe da própria HIVE (mais de 90° de desvio) e saiu do campo.
      if (e.launch && e.lastLaunchedBy && this.options.mode === "match" && clock.phase !== "pre") {
        const hx = HIVE.centerX[e.lastLaunchedBy] - e.launch.x;
        const hy = -e.launch.y;
        if (hx * Math.cos(e.launch.heading) + hy * Math.sin(e.launch.heading) < 0) {
          this.addFoul("G405", e.lastLaunchedBy, "major", "lançou um elemento para fora do campo", clock);
        }
      }
      const owner = allianceOfNectar(e.kind);
      this.elements.remove(e);
      if (owner) {
        this.pools[owner].returned++;
        if (owner === "red") this.flash("NECTAR saiu do campo e voltou para o HUMAN PLAYER");
      } else {
        const inside = FIELD.half - ELEMENTS.pollenRadius - 0.5;
        this.elements.spawn("pollen", Math.max(-inside, Math.min(inside, p.x)), Math.max(-inside, Math.min(inside, p.y)), 4);
      }
    }
  }

  /** Monta o retrato da partida para o motor de pontuação. */
  private snapshot(): MatchSnapshot {
    const s = emptySnapshot();
    const clock = this.clock();
    for (const alliance of ["red", "blue"] as const) {
      const a = s[alliance];
      a.autoHiveTips = this.tips[alliance].auto;
      a.teleopHiveTips = this.tips[alliance].teleop;
      a.cellElements = this.hives[alliance].elementsInUpCell(this.elements).length;
      a.gardenElements = this.elements.elements.filter((e) => {
        const p = this.elements.position(e);
        return circleTouchesRect(p.x, p.y, e.radius, GARDENS[alliance]);
      }).length;
      a.majorFouls = this.fouls.filter((f) => f.alliance === alliance && f.penalty === "major").length;
      a.minorFouls = this.fouls.filter((f) => f.alliance === alliance && f.penalty === "minor").length;
    }
    const now = this.leaveAndPark();
    if (this.options.mode === "match") {
      const autoNow = clock.phase === "auto" ? now : this.autoResult;
      for (const alliance of ["red", "blue"] as const) {
        if (autoNow) {
          s[alliance].autoLeave = autoNow[alliance].leave;
          s[alliance].autoPark = autoNow[alliance].park;
        }
        if (clock.phase === "teleop" || clock.phase === "post") s[alliance].teleopPark = now[alliance].park;
      }
    } else {
      s.red.teleopPark = now.red.park;
      s.blue.teleopPark = now.blue.park;
    }
    for (const flower of this.flowers) s.flowers[flower.spec.id] = flower.stack(this.elements).stack;
    return s;
  }

  /** LEAVE (não toca a parede) e PARK (parcialmente na LOADING ZONE) de cada robô, por aliança. */
  private leaveAndPark(): Record<Alliance, { leave: [boolean, boolean]; park: [boolean, boolean] }> {
    const of = (alliance: Alliance) => {
      const robots = this.robotsOf(alliance);
      const pick = (f: (r: Robot) => boolean): [boolean, boolean] => [robots[0] ? f(robots[0]) : false, robots[1] ? f(robots[1]) : false];
      return { leave: pick((r) => !r.touchingWall()), park: pick((r) => r.partiallyIn(LOADING_ZONES[alliance])) };
    };
    return { red: of("red"), blue: of("blue") };
  }

  private finish(): void {
    this.finished = true;
    this.finalScore = computeScore(this.snapshot());
    this.callbacks.onFinished(this.view());
  }

  private recordFrame(dt: number): void {
    this.recorder.capture(dt, {
      clockText: this.options.mode === "practice" ? formatClock(Math.floor(this.elapsed)) : formatClock(this.clock().displaySeconds),
      scores: this.lastScores,
      robots: [this.robot.group, ...this.bots.map((b) => b.robot.group)],
      hiveAngles: { red: this.hives.red.logic.angle, blue: this.hives.blue.logic.angle },
      elements: this.elements.elements,
    });
  }

  /** Começa o replay dos últimos segundos gravados. Devolve false se ainda não há gravação. */
  startReplay(): boolean {
    const frames = this.recorder.clip();
    if (frames.length < 2) return false;
    this.replay?.dispose();
    this.robot.setTrajectoryVisible(false);
    this.replay = new ReplayPlayer(frames, {
      scene: this.stage.scene,
      robots: [this.robot.group, ...this.bots.map((b) => b.robot.group)],
      setHiveAngles: (a) => {
        this.hives.red.syncVisual(a.red);
        this.hives.blue.syncVisual(a.blue);
      },
      meshFor: (kind) => this.elements.meshFor(kind),
      setLiveElementsVisible: (visible) => this.elements.setVisible(visible),
    });
    return true;
  }

  stopReplay(): void {
    this.replay?.dispose();
    this.replay = null;
  }

  replayControl(action: { toggle?: true; seek?: number; speed?: number; restart?: true }): void {
    const r = this.replay;
    if (!r) return;
    if (action.restart) {
      r.seek(0);
      r.playing = true;
    }
    if (action.toggle) {
      if (r.time >= r.length) r.seek(0);
      r.playing = !r.playing;
    }
    if (action.seek !== undefined) r.seek(action.seek);
    if (action.speed !== undefined) r.speed = action.speed;
  }

  view(): GameView {
    const clock = this.clock();
    const score = this.finalScore ?? computeScore(this.snapshot());
    if (this.started && !this.replay && score.red.total > this.lastScores.red) this.sound.score();
    this.lastScores = { red: score.red.total, blue: score.blue.total };
    const replayFrame = this.replay?.frame;
    const now = performance.now();
    while (this.messages.length > 0 && this.messages[0].until < now) this.messages.shift();
    const practice = this.options.mode === "practice";
    return {
      mode: this.options.mode,
      started: this.started,
      paused: this.paused,
      clock,
      clockText: replayFrame ? replayFrame.clockText : practice ? formatClock(Math.floor(this.elapsed)) : formatClock(clock.displaySeconds),
      phaseLabel: practice ? "Treino livre" : PHASE_LABELS[clock.phase],
      score,
      hopper: [...this.robot.hopper],
      intakeOn: this.robot.intakeOn || !!this.lastControls?.intakeHeld,
      launcherSpeed: this.robot.launcherSpeed,
      launcherPitch: this.robot.launcherPitchDeg,
      launchIntervalS: this.robot.config.launchIntervalS,
      bursting: this.robot.bursting,
      nectarAvailable: this.nectarAvailable("red", clock),
      nectarInArea: this.pools.red.staged + this.pools.red.returned,
      nectarOffField: { red: this.pools.red.staged + this.pools.red.returned, blue: this.pools.blue.staged + this.pools.blue.returned },
      cameraLabel: CAMERA_LABELS[this.stage.mode],
      relativeDrive: this.relativeDrive,
      fouls: [...this.fouls],
      messages: this.messages.map((m) => m.text),
      fps: this.fps,
      settling: clock.phase === "post" && !this.finished,
      hiveRect: this.stage.screenRect(HIVE_POINTS),
      teamNumber: this.options.teamNumber,
      teams: {
        red: [this.options.teamNumber, ...this.bots.filter((b) => b.alliance === "red").map((b) => b.label)],
        blue: this.bots.filter((b) => b.alliance === "blue").sort((a, b) => a.slot - b.slot).map((b) => b.label),
      },
      eventName: this.options.eventName,
      matchLabel: this.options.matchLabel,
      java: this.javaView(),
      replay: this.replay ? { time: this.replay.time, length: this.replay.length, playing: this.replay.playing, speed: this.replay.speed } : null,
    };
  }

  /** Tempo total previsto da partida (para a barra de progresso). */
  static readonly duration = matchDuration();

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    if (this.javaBus) this.javaBus.state = 2;
    this.gamepads?.dispose();
    this.sound.dispose();
    this.controls.dispose();
    this.elements.dispose();
    this.stage.dispose();
    this.physics.world.free();
  }
}
