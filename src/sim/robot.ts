// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Robô do jogador: base, intake no chão, lançador e o mecanismo da FLOWER, montados a partir de uma
// variante (config/robotPresets.ts). Peso livre (R104); a massa é só para a física.
import * as THREE from "three";
import type { Alliance } from "../rules/rules";
import { RULES } from "../rules/rules";
import { allianceOfNectar, type ElementKind, type ElementManager } from "./elements";
import { ELEMENTS, FIELD, FLOWER, FLOWERS, INCH, toWorld, type Rect } from "./geometry";
import { RAPIER, quatAboutY, yawOf, type PhysicsWorld } from "./physics";
import { ALLIANCE_COLORS } from "./field";
import { ROBOT_PRESETS, type RobotPreset } from "../config/robotPresets";

export interface DriveCommand {
  /** Frente/trás, esquerda/direita (referencial do robô) e giro; todos entre -1 e 1. */
  forward: number;
  strafe: number;
  turn: number;
}

export interface RobotConfig {
  alliance: Alliance;
  teamNumber: string;
  start: { x: number; y: number; heading: number };
  massKg: number;
  maxSpeed: number; // m/s
  maxAccel: number; // m/s²
  maxTurnRate: number; // rad/s
  /** Tempo entre um lançamento e o próximo numa rajada (recuperação do lançador), em segundos. */
  launchIntervalS: number;
  preset: RobotPreset;
}

/** Monta a configuração física a partir de uma variante. */
export function robotConfigFromPreset(preset: RobotPreset): Omit<RobotConfig, "alliance" | "teamNumber" | "start"> {
  return {
    massKg: preset.massKg,
    maxSpeed: preset.maxSpeed,
    maxAccel: preset.maxAccel,
    maxTurnRate: preset.maxTurnRate,
    launchIntervalS: preset.launchIntervalS,
    preset,
  };
}

export const DEFAULT_ROBOT = robotConfigFromPreset(ROBOT_PRESETS.generic);

const CHASSIS_HEIGHT = 5;
const INTAKE_DEPTH = 4.5;
const INTAKE_MAX_Z = 4.2;
// POLLEN dentro da coluna de uma FLOWER (o de baixo e os da pilha que descem): só o intake que "puxa" (goBILDA) alcança
const FLOWER_POCKET = { radius: FLOWER.lowerRingHoleRadius + 0.6, maxZ: FLOWER.topHeight };
// alcance do servo que empurra o POLLEN para fora da FLOWER, medido da frente do robô ao eixo da FLOWER
const SERVO_REACH = { min: 0, max: 6, halfWidth: 4 };
const SERVO_COOLDOWN_S = 0.6;
const SERVO_SWING_S = 0.35;
const SERVO_REST = 0.9; // braço recolhido, apontando para cima
// O servo puxa o POLLEN de baixo para o lado da FLOWER (esquerda do robô), já fora do anel de baixo
// (raio externo 2,35 pol) e dentro da boca do intake. Um chute de verdade sacudia a pilha: o anel do meio
// não colide com POLLEN no simulador, então os de cima se espalhavam pelo campo.
const ELEMENT_REST_Z = ELEMENTS.pollenRadius + 0.05;
const SERVO_DROP = { side: 4.1, z: ELEMENT_REST_Z, rollSpeed: 0.08 }; // pol, pol, m/s


function signTexture(teamNumber: string, color: number): THREE.CanvasTexture {
  // ROBOT SIGN (R401–R403): número branco sobre a cor da aliança
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  ctx.fillRect(0, 0, 256, 96);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 68px Roboto, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(teamNumber, 128, 52);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class Robot {
  readonly body: RAPIER.RigidBody;
  readonly group = new THREE.Group();
  readonly hopper: ElementKind[] = [];
  intakeOn = false;
  launcherSpeed: number; // m/s
  launcherPitchDeg: number;
  disabled = false;
  private cooldown = 0;
  private burst = false;
  private velocity = new THREE.Vector2(); // m/s no mundo (x, z)
  private readonly trajectory: THREE.Line;
  private readonly halfLength: number;
  private readonly halfWidth: number;
  private readonly launchExit: { forward: number; z: number };
  private readonly placeExit: { forward: number; z: number };
  private servoArm: THREE.Group | null = null;
  private servoTime = 0;
  /** Chamado a cada elemento lançado (sons, estatísticas). */
  onLaunch: (() => void) | null = null;
  private servoCooldown = 0;

  constructor(
    readonly config: RobotConfig,
    physics: PhysicsWorld,
    scene: THREE.Scene,
    /** Modelo do CAD importado (metros, frente em +X, piso em y = 0); substitui o modelo próprio. */
    model?: THREE.Object3D,
  ) {
    const preset = config.preset;
    this.halfLength = preset.length / 2;
    this.halfWidth = preset.width / 2;
    this.launcherSpeed = preset.launcherSpeed;
    this.launcherPitchDeg = preset.launcherPitchDeg;
    // saída à frente do mecanismo, para não colidir com o próprio robô
    this.launchExit = { forward: this.halfLength - 2.5, z: preset.height - 1 };
    // encostado no anel do meio (raio externo 2.6 pol), o eixo da FLOWER fica a ~meio comprimento + 2.7 do centro
    this.placeExit = { forward: this.halfLength + 2.7, z: 24.5 };
    const towerTop = preset.height;
    const p = toWorld(config.start.x, config.start.y, CHASSIS_HEIGHT / 2 + 0.05);
    this.body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(p.x, p.y, p.z)
        .setRotation(quatAboutY(config.start.heading))
        .enabledRotations(false, true, false)
        .setCcdEnabled(true),
    );
    const chassisMass = config.massKg * 0.8;
    physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(this.halfLength * INCH, (CHASSIS_HEIGHT / 2) * INCH, this.halfWidth * INCH).setMass(chassisMass).setFriction(0.05).setRestitution(0.05),
      this.body,
    );
    // torre do lançador, no meio do robô
    physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(4 * INCH, ((towerTop - CHASSIS_HEIGHT) / 2) * INCH, 5 * INCH)
        .setTranslation(0, ((towerTop + CHASSIS_HEIGHT) / 2 - CHASSIS_HEIGHT / 2) * INCH, 0)
        .setMass(config.massKg - chassisMass)
        .setFriction(0.1),
      this.body,
    );

    if (model) this.useCadModel(model);
    else this.buildMesh();
    scene.add(this.group);

    this.trajectory = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.05, gapSize: 0.04, transparent: true, opacity: 0.85 }),
    );
    scene.add(this.trajectory);
    this.sync();
  }

  /** Usa o CAD da equipe como visual; a física continua com a caixa e os mecanismos da variante. */
  private useCadModel(model: THREE.Object3D): void {
    model.position.y = (-CHASSIS_HEIGHT / 2 - 0.05) * INCH;
    this.group.add(model);
    // ROBOT SIGN (R401–R403) por fora do modelo, nas laterais
    const sign = new THREE.MeshStandardMaterial({ map: signTexture(this.config.teamNumber, ALLIANCE_COLORS[this.config.alliance]) });
    for (const side of [-1, 1]) {
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(12, this.halfLength * 2 - 4) * INCH, 3.5 * INCH), sign);
      plate.position.set(0, 0.2 * INCH, side * (this.halfWidth + 0.15) * INCH);
      plate.rotation.y = side > 0 ? 0 : Math.PI;
      this.group.add(plate);
    }
  }

  private buildMesh(): void {
    const preset = this.config.preset;
    const color = ALLIANCE_COLORS[this.config.alliance];
    const L = preset.length;
    const W = preset.width;
    const hl = this.halfLength;
    const hw = this.halfWidth;
    const frame = new THREE.MeshStandardMaterial({ color: preset.frameColor, metalness: 0.5, roughness: 0.5 });
    const alu = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 0.7, roughness: 0.35 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.9 });
    const accent = new THREE.MeshStandardMaterial({ color: preset.accentColor, roughness: 0.55, side: THREE.DoubleSide });
    const add = (mesh: THREE.Mesh, x: number, y: number, z: number) => {
      mesh.position.set(x * INCH, y * INCH, z * INCH);
      mesh.castShadow = true;
      this.group.add(mesh);
      return mesh;
    };
    const bottom = -CHASSIS_HEIGHT / 2;
    const wheel = (radius: number, thickness: number, mat: THREE.Material, x: number, z: number) => {
      const m = add(new THREE.Mesh(new THREE.CylinderGeometry(radius * INCH, radius * INCH, thickness * INCH, 14), mat), x, bottom + radius - 0.6, z);
      m.rotation.x = Math.PI / 2;
    };
    // No mesh, o "para a frente" do robô é +X local (heading 0 = +x do manual).

    // Base: placa inferior + trilhos laterais e traseiro (as rodas ficam por dentro)
    add(new THREE.Mesh(new THREE.BoxGeometry(L * INCH, 0.6 * INCH, (W - 3) * INCH), frame), 0, bottom + 1.2, 0);
    for (const side of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(L * INCH, CHASSIS_HEIGHT * 0.7 * INCH, 1 * INCH), frame), 0, 0.1, side * (hw - 0.5));
    add(new THREE.Mesh(new THREE.BoxGeometry(1 * INCH, CHASSIS_HEIGHT * 0.7 * INCH, (W - 2) * INCH), frame), -hl + 0.5, 0.1, 0);

    // Tração
    if (preset.id === "revDuo") {
      // esteiras de correia
      for (const side of [-1, 1]) {
        const belt = add(new THREE.Mesh(new THREE.CapsuleGeometry(1.6 * INCH, (L - 4.5) * INCH, 4, 10), rubber), 0, bottom + 1.0, side * (hw - 2.2));
        belt.rotation.z = Math.PI / 2;
        belt.scale.set(1, 1, 0.55);
      }
    } else if (preset.drivetrain === "mecanum") {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) wheel(2, 1.5, rubber, sx * (hl - 3), sz * (hw - 2));
    } else if (preset.id === "gobilda") {
      // 6WD: a roda do meio fica um pouco mais baixa (drop-center), o que facilita girar
      for (const side of [-1, 1]) for (const x of [-(hl - 3), 0, hl - 3]) wheel(2.1, 1.2, rubber, x, side * (hw - 2));
    } else {
      // AndyMark: omni (alumínio) nas pontas e stealth (borracha) no meio
      for (const side of [-1, 1]) for (const x of [-(hl - 2.8), -(hl - 7), hl - 7, hl - 2.8]) wheel(1.6, 1.2, Math.abs(x) > hl - 4 ? alu : rubber, x, side * (hw - 2));
    }

    // ROBOT SIGN (R401–R403) nos dois lados e atrás
    const sign = new THREE.MeshStandardMaterial({ map: signTexture(this.config.teamNumber, color) });
    const signs: Array<[number, number, number, number]> = [
      [0, hw + 0.2, 0, Math.min(14, L - 3)],
      [0, -hw - 0.2, Math.PI, Math.min(14, L - 3)],
      [-hl - 0.2, 0, -Math.PI / 2, Math.min(14, W - 3)],
    ];
    for (const [px, pz, ry, w] of signs) {
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(w * INCH, 4 * INCH), sign);
      plate.position.set(px * INCH, 0.2 * INCH, pz * INCH);
      plate.rotation.y = ry;
      this.group.add(plate);
    }

    // Torre do lançador com volante (flywheel) e rampa do depósito
    const towerTop = preset.height;
    const towerH = towerTop - CHASSIS_HEIGHT;
    for (const side of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(9 * INCH, towerH * INCH, 0.25 * INCH), alu), -0.5, CHASSIS_HEIGHT / 2 + towerH / 2, side * 4);
    const flyX = this.launchExit.forward - 3.5;
    const flywheel = add(new THREE.Mesh(new THREE.CylinderGeometry(2 * INCH, 2 * INCH, 7.5 * INCH, 16), rubber), flyX, towerTop - 2.5, 0);
    flywheel.rotation.x = Math.PI / 2;
    const ramp = add(new THREE.Mesh(new THREE.BoxGeometry(10 * INCH, 0.3 * INCH, 7.6 * INCH), alu), -1, CHASSIS_HEIGHT / 2 + towerH * 0.45, 0);
    ramp.rotation.z = -0.55;
    if (preset.id === "andymark") {
      // capô curvo do lançador
      const hood = add(new THREE.Mesh(new THREE.CylinderGeometry(4.2 * INCH, 4.2 * INCH, 7.6 * INCH, 16, 1, true, 0, Math.PI * 0.6), accent), flyX, towerTop - 2.5, 0);
      hood.rotation.x = Math.PI / 2;
    }

    // Intake na frente
    const intakeX = hl + 0.8;
    const intakeY = bottom + 1.6;
    if (preset.id === "gobilda") {
      // fileira de rodas Gecko num eixo
      const shaft = add(new THREE.Mesh(new THREE.CylinderGeometry(0.2 * INCH, 0.2 * INCH, preset.intakeWidth * INCH, 6), alu), intakeX, intakeY, 0);
      shaft.rotation.x = Math.PI / 2;
      for (let i = 0; i < 6; i++) {
        const g = add(new THREE.Mesh(new THREE.CylinderGeometry(1.25 * INCH, 1.25 * INCH, 0.6 * INCH, 12), accent), intakeX, intakeY, (i - 2.5) * (preset.intakeWidth / 6));
        g.rotation.x = Math.PI / 2;
      }
    } else if (preset.id === "andymark") {
      // rodas complacentes em dois eixos
      for (const [dx, dy] of [[0, 0], [-1.6, 1.8]]) {
        for (let i = 0; i < 4; i++) {
          const c = add(new THREE.Mesh(new THREE.CylinderGeometry(1.1 * INCH, 1.1 * INCH, 1 * INCH, 10), accent), intakeX + dx, intakeY + dy, (i - 1.5) * (preset.intakeWidth / 4));
          c.rotation.x = Math.PI / 2;
        }
      }
    } else {
      const rollerMat = preset.id === "generic" ? accent : new THREE.MeshStandardMaterial({ color: 0x1e5aa8, roughness: 0.6 });
      const roller = add(new THREE.Mesh(new THREE.CylinderGeometry(1.2 * INCH, 1.2 * INCH, preset.intakeWidth * INCH, 12), rollerMat), intakeX, intakeY, 0);
      roller.rotation.x = Math.PI / 2;
    }
    for (const side of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(3 * INCH, 3 * INCH, 0.25 * INCH), alu), hl - 0.5, bottom + 2, side * (preset.intakeWidth / 2 + 0.3));

    // Servo que tira o POLLEN da FLOWER (REV DUO e AndyMark): braço no alto da frente
    if (preset.flowerRetrieval === "servo") {
      const pivot = new THREE.Group();
      pivot.position.set((hl - 1) * INCH, (towerTop - 3) * INCH, (hw - 3) * INCH);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(6 * INCH, 0.4 * INCH, 0.6 * INCH), accent);
      arm.position.x = 3 * INCH;
      arm.castShadow = true;
      pivot.add(arm);
      pivot.rotation.z = SERVO_REST;
      this.servoArm = pivot;
      this.group.add(pivot);
    }

    // indicador de frente
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(1.4 * INCH, 3.5 * INCH, 3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    arrow.rotation.z = -Math.PI / 2;
    arrow.position.set((hl - 3) * INCH, (CHASSIS_HEIGHT / 2 + 0.2) * INCH, (hw - 2.5) * INCH);
    this.group.add(arrow);

    // contador visual do depósito: até 4 esferas atrás da torre
    for (let i = 0; i < RULES.maxControlledElements; i++) {
      const slot = new THREE.Mesh(new THREE.SphereGeometry(1.2 * INCH, 10, 6), new THREE.MeshStandardMaterial({ color: 0x444444 }));
      slot.position.set((-hl + 2) * INCH, (towerTop - CHASSIS_HEIGHT / 2 - 3) * INCH, (-3 + i * 2) * INCH);
      slot.name = `slot${i}`;
      this.group.add(slot);
    }
  }

  /** Pose no sistema do manual: x, y em pol, heading em rad (0 = +x, anti-horário visto de cima). */
  pose(): { x: number; y: number; heading: number } {
    const t = this.body.translation();
    return { x: t.x / INCH, y: -t.z / INCH, heading: yawOf(this.body.rotation()) };
  }

  /** Cantos da base (pol), para LEAVE e PARK. */
  footprint(): Array<{ x: number; y: number }> {
    const { x, y, heading } = this.pose();
    const c = Math.cos(heading);
    const s = Math.sin(heading);
    return [
      [this.halfLength, this.halfWidth],
      [this.halfLength, -this.halfWidth],
      [-this.halfLength, -this.halfWidth],
      [-this.halfLength, this.halfWidth],
    ].map(([fx, ly]) => ({ x: x + fx * c - ly * s, y: y + fx * s + ly * c }));
  }

  /** LEAVE (§10.5.4): não tocar mais a parede do perímetro. */
  touchingWall(margin = 0.6): boolean {
    return this.footprint().some((p) => Math.abs(p.x) >= FIELD.half - margin || Math.abs(p.y) >= FIELD.half - margin);
  }

  /** PARK (§10.5.4): ao menos parcialmente na zona — teste de separação de eixos (SAT) entre o polígono e o retângulo. */
  partiallyIn(rect: Rect): boolean {
    const poly = this.footprint();
    const rectPoly = [
      { x: rect.xMin, y: rect.yMin },
      { x: rect.xMax, y: rect.yMin },
      { x: rect.xMax, y: rect.yMax },
      { x: rect.xMin, y: rect.yMax },
    ];
    const axes: Array<{ x: number; y: number }> = [];
    for (const shape of [poly, rectPoly]) {
      for (let i = 0; i < shape.length; i++) {
        const a = shape[i];
        const b = shape[(i + 1) % shape.length];
        axes.push({ x: -(b.y - a.y), y: b.x - a.x });
      }
    }
    return axes.every((axis) => {
      const project = (pts: typeof poly) => pts.map((p) => p.x * axis.x + p.y * axis.y);
      const p1 = project(poly);
      const p2 = project(rectPoly);
      return Math.max(...p1) >= Math.min(...p2) && Math.max(...p2) >= Math.min(...p1);
    });
  }

  /** Aplica o comando de direção com limite de aceleração. */
  drive(cmd: DriveCommand, dt: number, enabled: boolean): void {
    const { heading } = this.pose();
    const active = enabled && !this.disabled;
    const fwd = active ? cmd.forward : 0;
    // tração tanque/6WD não anda de lado
    const str = active && this.config.preset.drivetrain === "mecanum" ? cmd.strafe : 0;
    const turn = active ? cmd.turn : 0;
    // velocidade desejada no manual (x, y), depois no mundo (x, -y)
    const vxField = (fwd * Math.cos(heading) - str * Math.sin(heading)) * this.config.maxSpeed;
    const vyField = (fwd * Math.sin(heading) + str * Math.cos(heading)) * this.config.maxSpeed;
    const target = new THREE.Vector2(vxField, -vyField);
    const delta = target.clone().sub(this.velocity);
    const maxDelta = this.config.maxAccel * dt;
    if (delta.length() > maxDelta) delta.setLength(maxDelta);
    this.velocity.add(delta);

    // mantém a velocidade vertical da física (o robô fica apoiado no piso)
    const current = this.body.linvel();
    this.body.setLinvel({ x: this.velocity.x, y: current.y, z: this.velocity.y }, true);
    this.body.setAngvel({ x: 0, y: turn * this.config.maxTurnRate, z: 0 }, true);

    // Se bater em algo, a física reduz a velocidade real; acompanha para não "acumular" empurrão.
    const real = this.body.linvel();
    this.velocity.set(
      Math.abs(real.x) < Math.abs(this.velocity.x) ? real.x : this.velocity.x,
      Math.abs(real.z) < Math.abs(this.velocity.y) ? real.z : this.velocity.y,
    );
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.servoCooldown = Math.max(0, this.servoCooldown - dt);
    if (this.servoArm) {
      this.servoTime = Math.max(0, this.servoTime - dt);
      // desce rápido e volta: meia senoide ao longo do movimento do servo
      const swing = Math.sin((this.servoTime / SERVO_SWING_S) * Math.PI);
      this.servoArm.rotation.z = SERVO_REST - swing * 1.9;
    }
  }

  /** POLLEN parado dentro do anel de baixo de uma FLOWER (o "bolso" de retirada). */
  private inFlowerPocket(p: { x: number; y: number; z: number }): boolean {
    return p.z <= FLOWER_POCKET.maxZ && FLOWERS.some((f) => Math.hypot(p.x - f.x, p.y - f.y) <= FLOWER_POCKET.radius);
  }

  /** Captura elementos que estão na boca do intake (até 4, G407; nunca NECTAR adversário, G408). */
  updateIntake(elements: ElementManager, enabled: boolean): void {
    if (!this.intakeOn || !enabled || this.disabled) return;
    const { x, y, heading } = this.pose();
    const c = Math.cos(heading);
    const s = Math.sin(heading);
    for (const e of [...elements.elements]) {
      if (this.hopper.length >= RULES.maxControlledElements) return;
      const nectarOwner = allianceOfNectar(e.kind);
      if (nectarOwner && nectarOwner !== this.config.alliance) continue;
      const p = elements.position(e);
      const dx = p.x - x;
      const dy = p.y - y;
      const along = dx * c + dy * s;
      const side = -dx * s + dy * c;
      const front = this.halfLength;
      if (along < front - 1 || along > front + INTAKE_DEPTH || Math.abs(side) > this.config.preset.intakeWidth / 2 || p.z > INTAKE_MAX_Z) continue;
      // só o intake que "puxa" alcança o POLLEN dentro da FLOWER; os outros dependem do servo
      if (this.config.preset.flowerRetrieval !== "intake" && this.inFlowerPocket(p)) continue;
      {
        this.hopper.push(e.kind);
        elements.remove(e);
      }
    }
  }

  private exitPoint(exit: { forward: number; z: number }): { x: number; y: number; z: number } {
    const { x, y, heading } = this.pose();
    return { x: x + Math.cos(heading) * exit.forward, y: y + Math.sin(heading) * exit.forward, z: exit.z };
  }

  private launchVelocity(): THREE.Vector3 {
    const { heading } = this.pose();
    const pitch = (this.launcherPitchDeg * Math.PI) / 180;
    const horizontal = this.launcherSpeed * Math.cos(pitch);
    // manual (cos h, sin h) → mundo (x, -y); soma a velocidade do robô
    return new THREE.Vector3(
      horizontal * Math.cos(heading) + this.velocity.x,
      this.launcherSpeed * Math.sin(pitch),
      -horizontal * Math.sin(heading) + this.velocity.y,
    );
  }

  /** Lança um único elemento agora (se o lançador já recuperou). Devolve o tipo lançado ou null. */
  launchOne(elements: ElementManager, enabled: boolean): ElementKind | null {
    if (!enabled || this.disabled || this.cooldown > 0 || this.hopper.length === 0) return null;
    const kind = this.hopper.shift()!;
    const p = this.exitPoint(this.launchExit);
    const e = elements.spawn(kind, p.x, p.y, p.z, this.launchVelocity());
    e.lastLaunchedBy = this.config.alliance;
    this.cooldown = this.config.launchIntervalS;
    this.onLaunch?.();
    return kind;
  }

  /** Começa uma rajada: lança todo o depósito, um elemento a cada `launchIntervalS`. */
  startBurst(enabled: boolean): boolean {
    if (!enabled || this.disabled || this.hopper.length === 0) return false;
    this.burst = true;
    return true;
  }

  get bursting(): boolean {
    return this.burst;
  }

  /** Avança a rajada; chamado a cada passo de física. */
  updateBurst(elements: ElementManager, enabled: boolean): void {
    if (!this.burst) return;
    if (!enabled || this.disabled || this.hopper.length === 0) {
      this.burst = false;
      return;
    }
    this.launchOne(elements, enabled);
    if (this.hopper.length === 0) this.burst = false;
  }

  /** Botão do mecanismo da FLOWER: coloca (robô genérico) ou aciona o servo de retirada (REV DUO, AndyMark). */
  flowerAction(elements: ElementManager, enabled: boolean): ElementKind | "servo" | null {
    if (this.config.preset.canPlace) return this.place(elements, enabled);
    if (this.config.preset.flowerRetrieval === "servo") return this.pokeFlower(elements, enabled) ? "servo" : null;
    return null;
  }

  /**
   * Servo de retirada: empurra o POLLEN de baixo da FLOWER que está à frente para fora do anel,
   * em direção ao intake. Devolve true se tirou um POLLEN.
   */
  pokeFlower(elements: ElementManager, enabled: boolean): boolean {
    if (!enabled || this.disabled || this.servoCooldown > 0 || this.config.preset.flowerRetrieval !== "servo") return false;
    this.servoCooldown = SERVO_COOLDOWN_S;
    this.servoTime = SERVO_SWING_S;
    const { x, y, heading } = this.pose();
    const c = Math.cos(heading);
    const s = Math.sin(heading);
    const flower = FLOWERS.find((f) => {
      const along = (f.x - x) * c + (f.y - y) * s - this.halfLength;
      const side = -(f.x - x) * s + (f.y - y) * c;
      return along >= SERVO_REACH.min && along <= SERVO_REACH.max && Math.abs(side) <= SERVO_REACH.halfWidth;
    });
    if (!flower) return false;
    const target = elements.elements
      .filter((e) => e.kind === "pollen")
      .map((e) => ({ e, p: elements.position(e) }))
      .filter(({ p }) => p.z <= FLOWER_POCKET.maxZ && Math.hypot(p.x - flower.x, p.y - flower.y) <= FLOWER_POCKET.radius)
      .sort((a, b) => a.p.z - b.p.z)[0];
    if (!target) return false;
    // manual: esquerda do robô = (-sin h, cos h); mundo = (x, -y)
    const out = toWorld(flower.x - s * SERVO_DROP.side, flower.y + c * SERVO_DROP.side, SERVO_DROP.z);
    target.e.body.setTranslation(out, true);
    target.e.body.setLinvel({ x: -s * SERVO_DROP.rollSpeed, y: 0, z: -c * SERVO_DROP.rollSpeed }, true);
    target.e.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    return true;
  }

  /** Solta o próximo elemento à frente, no alto: para colocar dentro de uma FLOWER. */
  place(elements: ElementManager, enabled: boolean): ElementKind | null {
    if (!enabled || this.disabled || this.burst || this.cooldown > 0 || this.hopper.length === 0) return null;
    const kind = this.hopper.shift()!;
    // Solta parado, sobre o eixo: a boca da FLOWER (4 pol) deixa só 0,2 pol de folga para o NECTAR (3,6 pol),
    // e qualquer velocidade para a frente o faria pousar na borda, preso no batente.
    const p = this.exitPoint(this.placeExit);
    const e = elements.spawn(kind, p.x, p.y, p.z);
    e.lastLaunchedBy = this.config.alliance;
    this.cooldown = 0.4;
    return kind;
  }

  setTrajectoryVisible(visible: boolean): void {
    this.trajectory.visible = visible;
  }

  sync(showTrajectory = true): void {
    const t = this.body.translation();
    const r = this.body.rotation();
    this.group.position.set(t.x, t.y, t.z);
    this.group.quaternion.set(r.x, r.y, r.z, r.w);

    const kindColor: Record<ElementKind, number> = { pollen: 0xf7e326, redNectar: 0xed1c24, blueNectar: 0x0066b3 };
    for (let i = 0; i < RULES.maxControlledElements; i++) {
      const slot = this.group.getObjectByName(`slot${i}`) as THREE.Mesh | undefined;
      const mat = slot?.material as THREE.MeshStandardMaterial | undefined;
      mat?.color.setHex(i < this.hopper.length ? kindColor[this.hopper[i]] : 0x444444);
    }

    this.trajectory.visible = showTrajectory && this.hopper.length > 0;
    if (this.trajectory.visible) {
      const start = this.exitPoint(this.launchExit);
      const p0 = toWorld(start.x, start.y, start.z);
      const v = this.launchVelocity();
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 40; i++) {
        const time = i * 0.03;
        const p = new THREE.Vector3(p0.x + v.x * time, p0.y + v.y * time - 4.905 * time * time, p0.z + v.z * time);
        if (p.y < 0) break;
        points.push(p);
      }
      this.trajectory.geometry.setFromPoints(points);
      this.trajectory.computeLineDistances();
    }
  }
}
