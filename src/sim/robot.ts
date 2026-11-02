// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Robô genérico para treino (até a Oficina chegar): chassi mecanum de 18 × 18 pol (R102),
// intake no chão, lançador e "colocador" para as FLOWERS. Peso livre (R104); a massa abaixo é só para a física.
import * as THREE from "three";
import type { Alliance } from "../rules/rules";
import { RULES } from "../rules/rules";
import { allianceOfNectar, type ElementKind, type ElementManager } from "./elements";
import { FIELD, INCH, toWorld, type Rect } from "./geometry";
import { RAPIER, quatAboutY, yawOf, type PhysicsWorld } from "./physics";
import { ALLIANCE_COLORS } from "./field";

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
}

export const DEFAULT_ROBOT: Omit<RobotConfig, "alliance" | "teamNumber" | "start"> = {
  massKg: 13, // suposição: robô típico de FTC
  maxSpeed: 1.6,
  maxAccel: 4,
  maxTurnRate: 3.5,
};

const HALF = 9; // pol (18 pol de lado)
const CHASSIS_HEIGHT = 5;
const TOWER_TOP = 16;
const INTAKE = { front: HALF, depth: 4.5, halfWidth: 7, maxZ: 4.2 };
const LAUNCH_EXIT = { forward: 6.5, z: 15 }; // à frente da torre, para não colidir com o próprio robô
// encostado no anel do meio (raio externo 2.6 pol), o eixo da FLOWER fica a ~HALF + 2.7 do centro do robô
const PLACE_EXIT = { forward: HALF + 2.7, z: 24.5 };

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
  launcherSpeed = 6.2; // m/s
  launcherPitchDeg = 42;
  disabled = false;
  private cooldown = 0;
  private velocity = new THREE.Vector2(); // m/s no mundo (x, z)
  private readonly trajectory: THREE.Line;

  constructor(
    readonly config: RobotConfig,
    physics: PhysicsWorld,
    scene: THREE.Scene,
  ) {
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
      RAPIER.ColliderDesc.cuboid(HALF * INCH, (CHASSIS_HEIGHT / 2) * INCH, HALF * INCH).setMass(chassisMass).setFriction(0.05).setRestitution(0.05),
      this.body,
    );
    // torre do lançador, no meio do robô
    physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(4 * INCH, ((TOWER_TOP - CHASSIS_HEIGHT) / 2) * INCH, 5 * INCH)
        .setTranslation(0, ((TOWER_TOP + CHASSIS_HEIGHT) / 2 - CHASSIS_HEIGHT / 2) * INCH, 0)
        .setMass(config.massKg - chassisMass)
        .setFriction(0.1),
      this.body,
    );

    this.buildMesh();
    scene.add(this.group);

    this.trajectory = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.05, gapSize: 0.04, transparent: true, opacity: 0.85 }),
    );
    scene.add(this.trajectory);
    this.sync();
  }

  private buildMesh(): void {
    const color = ALLIANCE_COLORS[this.config.alliance];
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.5, roughness: 0.5 });
    const alu = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 0.7, roughness: 0.35 });
    // No mesh, o "para a frente" do robô é +X local (heading 0 = +x do manual).
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(18 * INCH, CHASSIS_HEIGHT * INCH, 18 * INCH), dark);
    chassis.castShadow = true;
    this.group.add(chassis);

    const sign = new THREE.MeshStandardMaterial({ map: signTexture(this.config.teamNumber, color) });
    for (const [px, pz, ry] of [[0, HALF + 0.2, 0], [0, -HALF - 0.2, Math.PI], [-HALF - 0.2, 0, -Math.PI / 2]] as const) {
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(14 * INCH, 4.5 * INCH), sign);
      plate.position.set(px * INCH, 0, pz * INCH);
      plate.rotation.y = ry;
      this.group.add(plate);
    }

    const tower = new THREE.Mesh(new THREE.BoxGeometry(8 * INCH, (TOWER_TOP - CHASSIS_HEIGHT) * INCH, 10 * INCH), alu);
    tower.position.y = ((TOWER_TOP - CHASSIS_HEIGHT) / 2 + CHASSIS_HEIGHT / 2) * INCH;
    tower.castShadow = true;
    this.group.add(tower);

    // intake: rolo na frente
    const roller = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2 * INCH, 1.2 * INCH, 15 * INCH, 12),
      new THREE.MeshStandardMaterial({ color: 0xf57e25, roughness: 0.6 }), // laranja FTC
    );
    roller.rotation.x = Math.PI / 2;
    roller.position.set((HALF + 0.8) * INCH, (-CHASSIS_HEIGHT / 2 + 1.4) * INCH, 0);
    this.group.add(roller);

    // indicador de frente
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(1.6 * INCH, 4 * INCH, 3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    arrow.rotation.z = -Math.PI / 2;
    arrow.position.set(6.5 * INCH, (CHASSIS_HEIGHT / 2 + 0.2) * INCH, 0);
    this.group.add(arrow);

    // contador visual do depósito: até 4 esferas no topo
    for (let i = 0; i < RULES.maxControlledElements; i++) {
      const slot = new THREE.Mesh(new THREE.SphereGeometry(1.3 * INCH, 10, 6), new THREE.MeshStandardMaterial({ color: 0x444444 }));
      slot.position.set((-3 + i * 2) * INCH, (TOWER_TOP - CHASSIS_HEIGHT / 2 + 1.3) * INCH, 0);
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
      [HALF, HALF],
      [HALF, -HALF],
      [-HALF, -HALF],
      [-HALF, HALF],
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
    const str = active ? cmd.strafe : 0;
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
      if (along >= INTAKE.front - 1 && along <= INTAKE.front + INTAKE.depth && Math.abs(side) <= INTAKE.halfWidth && p.z <= INTAKE.maxZ) {
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

  /** Lança o próximo elemento. Devolve o tipo lançado ou null. */
  launch(elements: ElementManager, enabled: boolean): ElementKind | null {
    if (!enabled || this.disabled || this.cooldown > 0 || this.hopper.length === 0) return null;
    const kind = this.hopper.shift()!;
    const p = this.exitPoint(LAUNCH_EXIT);
    const e = elements.spawn(kind, p.x, p.y, p.z, this.launchVelocity());
    e.lastLaunchedBy = this.config.alliance;
    this.cooldown = 0.35;
    return kind;
  }

  /** Solta o próximo elemento à frente, no alto: para colocar dentro de uma FLOWER. */
  place(elements: ElementManager, enabled: boolean): ElementKind | null {
    if (!enabled || this.disabled || this.cooldown > 0 || this.hopper.length === 0) return null;
    const kind = this.hopper.shift()!;
    const p = this.exitPoint(PLACE_EXIT);
    const { heading } = this.pose();
    const v = new THREE.Vector3(Math.cos(heading) * 0.15, 0, -Math.sin(heading) * 0.15);
    const e = elements.spawn(kind, p.x, p.y, p.z, v);
    e.lastLaunchedBy = this.config.alliance;
    this.cooldown = 0.4;
    return kind;
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
      const start = this.exitPoint(LAUNCH_EXIT);
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
