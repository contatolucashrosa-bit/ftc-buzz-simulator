// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Cenário: a arena num galpão industrial (src/render/venue.ts, modelado no Blender), com a plateia na arquibancada
// no preset Alto. Nas ALLIANCE AREAS ficam as equipes, apicultores de macacão inteiro (rosa na aliança vermelha,
// lavanda na azul), gerados no código e animados (HUMAN PLAYER entrega o NECTAR, comemoração no TIP).
import * as THREE from "three";
import type { Quality } from "./stage";
import { loadVenue, placeholderFloor, type Venue } from "./venue";

type Alliance = "red" | "blue";
const FIELD_HALF_M = 1.83;
// ALLIANCE AREA (§9.3): 54 × 97 pol, encostada na parede lateral do campo
const AREA = { inner: FIELD_HALF_M + 0.05, outer: FIELD_HALF_M + 0.05 + 54 * 0.0254, halfDepth: (97 * 0.0254) / 2 };
/** Macacões das equipes: cor do tecido, chapéu e luvas/botas por aliança. */
const SUIT: Record<Alliance, { cloth: number; hat: number; trim: number }> = {
  red: { cloth: 0xd77f8c, hat: 0xc9506a, trim: 0xb8405c },
  blue: { cloth: 0xa4a9dc, hat: 0x7f85d6, trim: 0x6f75c8 },
};

/** Gerador pseudoaleatório com semente: o cenário é sempre igual (bom para replays e capturas). */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lambert = (color: number, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color, ...extra });


// ---------- equipes: apicultores ----------

/** Apicultor low-poly de macacão inteiro, com braços articulados para animar. */
export interface Person {
  root: THREE.Group;
  rightArm: THREE.Group;
  leftArm: THREE.Group;
}

function beekeeper(alliance: Alliance, holding: "controller" | "none"): Person {
  const colors = SUIT[alliance];
  const root = new THREE.Group();
  const cloth = lambert(colors.cloth);
  const trim = lambert(colors.trim);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z = 0, parent: THREE.Object3D = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  // pernas largas do macacão e botas de borracha
  for (const side of [-1, 1]) {
    add(new THREE.CapsuleGeometry(0.095, 0.5, 4, 10), cloth, side * 0.1, 0.42);
    const boot = add(new THREE.CapsuleGeometry(0.075, 0.12, 4, 8), trim, side * 0.1, 0.08, 0.04);
    boot.rotation.x = Math.PI / 2;
  }
  // tronco "fofo" do macacão, com cinto
  const torso = add(new THREE.CapsuleGeometry(0.21, 0.42, 4, 14), cloth, 0, 1.0);
  torso.scale.set(1, 1, 0.78);
  const belt = add(new THREE.CylinderGeometry(0.205, 0.205, 0.035, 16), trim, 0, 0.84);
  belt.scale.set(1, 1, 0.8);
  // capuz, véu escuro na frente do rosto e chapéu de abas largas
  add(new THREE.SphereGeometry(0.16, 16, 12), cloth, 0, 1.43, -0.015);
  add(new THREE.SphereGeometry(0.135, 14, 10).scale(1, 1.05, 0.9), lambert(0x22232b), 0, 1.45, 0.05);
  add(new THREE.CylinderGeometry(0.17, 0.2, 0.2, 18, 1, true), lambert(0x2a2c35, { transparent: true, opacity: 0.55, side: THREE.DoubleSide }), 0, 1.45);
  const hat = lambert(colors.hat);
  // chapéu de apicultor: aba larga e caída, copa baixa e arredondada
  add(new THREE.CylinderGeometry(0.2, 0.34, 0.06, 24), hat, 0, 1.57);
  add(new THREE.SphereGeometry(0.17, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.62, 1), hat, 0, 1.59);

  const arm = (side: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.27, 1.25, 0);
    root.add(shoulder);
    add(new THREE.CapsuleGeometry(0.068, 0.44, 4, 8), cloth, 0, -0.27, 0, shoulder);
    add(new THREE.SphereGeometry(0.07, 10, 8), trim, 0, -0.57, 0.01, shoulder); // luva
    return shoulder;
  };
  const person = { root, rightArm: arm(1), leftArm: arm(-1) };
  if (holding === "controller") {
    // controle na frente do peito, segurado com as duas mãos
    const pad = new THREE.Group();
    add(new THREE.BoxGeometry(0.17, 0.035, 0.08), lambert(0x2b2d33), 0, 0, 0, pad);
    add(new THREE.BoxGeometry(0.05, 0.036, 0.05), lambert(0x2bc4d8), -0.075, 0.001, -0.01, pad);
    add(new THREE.BoxGeometry(0.05, 0.036, 0.05), lambert(0x2bc4d8), 0.075, 0.001, -0.01, pad);
    pad.position.set(0, 0.93, 0.27);
    pad.rotation.x = 0.5;
    root.add(pad);
  }
  return person;
}

// ---------- ambiente completo ----------

interface AnimatedPerson extends Person {
  role: "humanPlayer" | "driver" | "coach";
  phase: number;
  home: THREE.Vector3;
  facing: number;
}

/**
 * HUMAN PLAYER que entrega NECTAR (G426/G427): vai até a cesta da ALLIANCE AREA, pega um NECTAR,
 * volta para a borda da LOADING ZONE e o coloca no campo. O elemento só aparece no campo no instante
 * em que é solto (callback `release`).
 */
type DeliveryState = "idle" | "toCrate" | "pick" | "toZone" | "release";

interface Delivery {
  person: AnimatedPerson;
  crate: THREE.Vector3;
  state: DeliveryState;
  t: number;
  queue: Array<() => void>;
  current: (() => void) | null;
  ball: THREE.Mesh;
  crateBalls: THREE.Mesh[];
}

const WALK_SPEED = 1.3; // m/s
const PICK_S = 0.4;
const RELEASE_S = 0.7;
const ALLIANCE_HEX: Record<Alliance, number> = { red: 0xed1c24, blue: 0x0066b3 };

export class Environment {
  readonly group = new THREE.Group();
  /** Pessoas de cada ALLIANCE AREA (DRIVE TEAMS e HUMAN PLAYERS). */
  readonly alliances: Record<Alliance, THREE.Group> = { red: new THREE.Group(), blue: new THREE.Group() };
  private readonly people: Record<Alliance, AnimatedPerson[]> = { red: [], blue: [] };
  private readonly delivery = {} as Record<Alliance, Delivery>;
  private time = 0;
  private venue: Venue | null = null;
  private readonly cheering: Record<Alliance, number> = { red: 0, blue: 0 };

  constructor(scene: THREE.Scene, quality: Quality) {
    const rand = seeded(24823);

    // galpão industrial: fundo cinza-escuro e uma névoa leve que suaviza o fundo do galpão
    scene.background = new THREE.Color(0x2b2e33);
    scene.fog = new THREE.Fog(0x3a3e44, 24, 60);
    const floor = placeholderFloor();
    this.group.add(floor);
    void loadVenue(quality === "high").then((venue) => {
      if (!venue) return;
      this.group.remove(floor);
      this.group.add(venue.root);
      this.venue = venue;
    });

    // ALLIANCE AREAS: 2 HUMAN PLAYERS perto da LOADING ZONE, 2 pilotos e 1 técnico por aliança
    for (const alliance of ["red", "blue"] as const) {
      const sign = alliance === "red" ? -1 : 1;
      const facing = alliance === "red" ? Math.PI / 2 : -Math.PI / 2; // de frente para o campo
      // LOADING ZONE vermelha fica em z < 0 (lado oposto à plateia); a azul, em z > 0
      const lz = alliance === "red" ? -1 : 1;
      const spots: Array<{ role: AnimatedPerson["role"]; x: number; z: number }> = [
        { role: "humanPlayer", x: AREA.inner + 0.3, z: lz * 0.95 },
        { role: "humanPlayer", x: AREA.inner + 0.75, z: lz * 0.55 },
        // DRIVE TEAM no fundo da ALLIANCE AREA, para não tapar o campo na câmera da plateia
        { role: "driver", x: AREA.outer - 0.3, z: -lz * 0.2 },
        { role: "driver", x: AREA.outer - 0.3, z: -lz * 0.75 },
        { role: "coach", x: AREA.outer - 0.15, z: -lz * 1.1 },
      ];
      for (const spot of spots) {
        const p = beekeeper(alliance, spot.role === "driver" ? "controller" : "none");
        p.root.position.set(sign * spot.x, 0, spot.z);
        p.root.rotation.y = facing;
        if (spot.role === "driver") {
          // braços dobrados segurando o controle
          p.rightArm.rotation.x = -0.95;
          p.leftArm.rotation.x = -0.95;
          p.rightArm.rotation.z = 0.32;
          p.leftArm.rotation.z = -0.32;
        }
        this.alliances[alliance].add(p.root);
        this.people[alliance].push({ ...p, role: spot.role, phase: rand() * 6, home: p.root.position.clone(), facing });
      }

      // cesta de vime com os NECTAR da aliança ainda fora do campo, atrás do HUMAN PLAYER
      const crate = new THREE.Vector3(sign * (AREA.inner + 1.0), 0, lz * 1.05);
      const basket = new THREE.Group();
      const wicker = lambert(0xa07a48);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.19, 0.22, 16, 1, true), lambert(0xa07a48, { side: THREE.DoubleSide }));
      body.position.y = 0.11;
      body.castShadow = true;
      const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.19, 16).rotateX(-Math.PI / 2), wicker);
      bottom.position.y = 0.01;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.015, 6, 20).rotateX(Math.PI / 2), lambert(0x7d5a32));
      rim.position.y = 0.22;
      basket.add(body, bottom, rim);
      basket.position.copy(crate);
      const ballGeo = new THREE.SphereGeometry(0.046, 12, 8);
      const ballMat = lambert(ALLIANCE_HEX[alliance]);
      const crateBalls = Array.from({ length: 8 }, (_, i) => {
        const b = new THREE.Mesh(ballGeo, ballMat);
        const a = (i / 4) * Math.PI * 2 + (i >= 4 ? 0.5 : 0);
        const r = i >= 4 ? 0.06 : 0.11;
        b.position.set(Math.cos(a) * r, 0.06 + (i >= 4 ? 0.08 : 0), Math.sin(a) * r);
        basket.add(b);
        return b;
      });
      this.alliances[alliance].add(basket);
      const hp = this.people[alliance].find((p) => p.role === "humanPlayer")!;
      // NECTAR na mão (aparece entre pegar e soltar)
      const ball = new THREE.Mesh(ballGeo, ballMat);
      ball.position.set(0, -0.66, 0.04);
      ball.visible = false;
      hp.rightArm.add(ball);
      this.delivery[alliance] = { person: hp, crate, state: "idle", t: 0, queue: [], current: null, ball, crateBalls };
      this.group.add(this.alliances[alliance]);
    }

    scene.add(this.group);
  }

  /** Pede ao HUMAN PLAYER que entregue um NECTAR; `release` é chamado quando ele o solta na LOADING ZONE. */
  /** A aliança comemora por alguns instantes (TIP da própria HIVE): braços para cima e pulinhos. */
  cheer(alliance: Alliance, seconds = 1.8): void {
    this.cheering[alliance] = seconds;
  }

  requestNectar(alliance: Alliance, release: () => void): void {
    this.delivery[alliance].queue.push(release);
  }

  /** Quantos NECTAR ainda estão na ALLIANCE AREA (aparecem na cesta). */
  setNectarStock(alliance: Alliance, count: number): void {
    const d = this.delivery[alliance];
    // a bola que está na mão já saiu da cesta
    const inCrate = Math.max(0, count - (d.ball.visible ? 1 : 0));
    d.crateBalls.forEach((b, i) => (b.visible = i < inCrate));
  }

  /** Andar até um ponto; devolve true ao chegar. Balança braços e corpo enquanto anda. */
  private walk(p: AnimatedPerson, to: THREE.Vector3, dt: number): boolean {
    const pos = p.root.position;
    const dx = to.x - pos.x;
    const dz = to.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.02) return true;
    const step = Math.min(dist, WALK_SPEED * dt);
    pos.x += (dx / dist) * step;
    pos.z += (dz / dist) * step;
    p.root.rotation.y = Math.atan2(dx, dz);
    const swing = Math.sin(this.time * 9) * 0.5;
    p.rightArm.rotation.x = swing;
    p.leftArm.rotation.x = -swing;
    pos.y = Math.abs(Math.sin(this.time * 9)) * 0.03;
    return false;
  }

  private updateDelivery(d: Delivery, dt: number): void {
    const p = d.person;
    d.t += dt;
    switch (d.state) {
      case "idle":
        if (d.queue.length) {
          d.current = d.queue.shift()!;
          d.state = "toCrate";
          d.t = 0;
        }
        return;
      case "toCrate": {
        // para ao lado da cesta (sem entrar nela)
        const side = new THREE.Vector3().subVectors(p.home, d.crate).setLength(0.34).add(d.crate);
        if (this.walk(p, side, dt)) {
          d.state = "pick";
          d.t = 0;
        }
        return;
      }
      case "pick": {
        // abaixa o braço até a cesta e pega
        const k = Math.min(1, d.t / PICK_S);
        p.root.rotation.y = Math.atan2(d.crate.x - p.root.position.x, d.crate.z - p.root.position.z);
        p.rightArm.rotation.x = -Math.sin(k * Math.PI) * 0.9;
        if (k > 0.5) d.ball.visible = true;
        if (k >= 1) {
          d.state = "toZone";
          d.t = 0;
        }
        return;
      }
      case "toZone":
        if (this.walk(p, p.home, dt)) {
          d.state = "release";
          d.t = 0;
        }
        p.rightArm.rotation.x = -0.7; // segura o NECTAR à frente
        return;
      case "release": {
        const k = Math.min(1, d.t / RELEASE_S);
        p.root.rotation.y = p.facing;
        p.root.position.y = 0;
        const lift = Math.sin(k * Math.PI);
        p.rightArm.rotation.x = -0.7 - lift * 1.1;
        p.leftArm.rotation.x = -lift * 0.6;
        if (k >= 0.5 && d.current) {
          d.ball.visible = false;
          d.current();
          d.current = null;
        }
        if (k >= 1) {
          d.state = "idle";
          d.t = 0;
        }
        return;
      }
    }
  }

  /** `camera`: posição da câmera; quem estiver colado a ela some, para não tapar a tela (câmera do robô). */
  update(dt: number, camera?: THREE.Vector3): void {
    this.time += dt;
    this.venue?.update(this.time, Math.max(this.cheering.red, this.cheering.blue));
    for (const alliance of ["red", "blue"] as const) {
      this.cheering[alliance] = Math.max(0, this.cheering[alliance] - dt);
      for (const p of this.people[alliance]) {
        if (camera) p.root.visible = Math.hypot(camera.x - p.root.position.x, camera.z - p.root.position.z) > 0.9;
        const cheer = this.cheering[alliance];
        const delivering = Object.values(this.delivery).some((x) => x.person === p && (x.state !== "idle" || x.queue.length > 0));
        if (cheer > 0 && !delivering) {
          // entra e sai suave; o piloto levanta só um braço (o outro segura o controle)
          const k = Math.min(1, cheer * 4, (1.8 - cheer) * 6 + 0.2);
          const wave = Math.sin(this.time * 14 + p.phase) * 0.18;
          p.rightArm.rotation.x = -2.7 * k + wave;
          p.leftArm.rotation.x = p.role === "driver" ? -0.95 : -2.7 * k - wave;
          p.root.position.y = Math.abs(Math.sin(this.time * 9 + p.phase)) * 0.09 * k;
          continue;
        }
        if (p.root.position.y > 0.01) p.root.position.y = 0;
        if (p.role === "driver") {
          // pequenos ajustes no controle
          p.rightArm.rotation.x = -0.95 + Math.sin(this.time * 3 + p.phase) * 0.04;
          p.leftArm.rotation.x = -0.95 + Math.sin(this.time * 3.3 + p.phase) * 0.04;
          continue;
        }
        const d = p.role === "humanPlayer" ? Object.values(this.delivery).find((x) => x.person === p) : undefined;
        if (d && (d.state !== "idle" || d.queue.length)) {
          this.updateDelivery(d, dt);
        } else {
          const idle = Math.sin(this.time * 1.4 + p.phase) * 0.06;
          p.rightArm.rotation.x = idle;
          p.leftArm.rotation.x = -idle;
          p.root.position.y = Math.max(0, Math.sin(this.time * 1.4 + p.phase)) * 0.004;
        }
      }
    }
  }
}
