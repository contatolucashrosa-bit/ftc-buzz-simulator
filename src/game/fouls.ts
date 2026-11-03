// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Faltas de contato entre robôs, avaliadas pela posição física (sem árbitro humano):
// G402 (interferir no lado adversário durante o AUTO) e G421 (PIN por mais de 3 s).
import type { Alliance } from "../rules/rules";

type Point = { x: number; y: number };

export interface FoulRobot {
  /** Identificador estável do robô na partida (ex.: "red-1"). */
  key: string;
  alliance: Alliance;
  /** Cantos da base, em pol. */
  footprint: Point[];
  /** Velocidade real (pol/s). */
  velocity: Point;
  /** Direção em que o robô está tentando andar (comando no campo, -1..1). */
  push: Point;
  /** Encostado na parede do perímetro ou em outra estrutura que impede a fuga. */
  blocked: boolean;
}

export interface FoulEvent {
  rule: "G402" | "G421";
  /** Aliança que cometeu a falta. */
  alliance: Alliance;
  penalty: "major";
  text: string;
}

/** Distância (pol) abaixo da qual dois robôs contam como encostados. */
const CONTACT_MARGIN = 1;
/** G421: PIN por mais de 3 s gera MAJOR, e mais uma MAJOR a cada 3 s seguintes. */
const PIN_SECONDS = 3;
/** Um robô preso quase não se move (pol/s). */
const PINNED_SPEED = 3;
/** O PIN acaba quando os robôs se afastam por esse tempo (s), não por um tremor de 1 quadro. */
const PIN_RELEASE_S = 0.4;

function axesOf(poly: Point[]): Point[] {
  return poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const nx = -(b.y - a.y);
    const ny = b.x - a.x;
    const len = Math.hypot(nx, ny) || 1;
    return { x: nx / len, y: ny / len };
  });
}

/** Teste de eixos separadores (SAT) com folga: os polígonos se tocam ou estão a menos de `margin` pol. */
export function polygonsTouch(a: Point[], b: Point[], margin = CONTACT_MARGIN): boolean {
  return [...axesOf(a), ...axesOf(b)].every((axis) => {
    const pa = a.map((p) => p.x * axis.x + p.y * axis.y);
    const pb = b.map((p) => p.x * axis.x + p.y * axis.y);
    return Math.max(...pa) + margin >= Math.min(...pb) && Math.max(...pb) + margin >= Math.min(...pa);
  });
}

function center(poly: Point[]): Point {
  return { x: poly.reduce((s, p) => s + p.x, 0) / poly.length, y: poly.reduce((s, p) => s + p.y, 0) / poly.length };
}

/** O robô inteiro está no lado do campo da outra aliança (vermelho joga em x < 0). */
export function fullyOnOpponentSide(robot: FoulRobot): boolean {
  return robot.footprint.every((p) => (robot.alliance === "red" ? p.x > 0 : p.x < 0));
}

export class FoulMonitor {
  private readonly pins = new Map<string, { time: number; called: number; apart: number }>();
  private readonly autoInterference = new Set<string>();

  /** Avalia um passo da física. `auto`: a partida está no período AUTO. */
  update(dt: number, robots: FoulRobot[], auto: boolean): FoulEvent[] {
    const events: FoulEvent[] = [];
    for (const a of robots) {
      for (const b of robots) {
        if (a === b || a.alliance === b.alliance) continue;
        const touching = polygonsTouch(a.footprint, b.footprint);

        // G402: no AUTO, encostar num adversário estando todo no lado dele (uma vez por robô)
        if (auto && touching && fullyOnOpponentSide(a) && !this.autoInterference.has(a.key)) {
          this.autoInterference.add(a.key);
          events.push({ rule: "G402", alliance: a.alliance, penalty: "major", text: "interferiu no lado adversário durante o AUTO" });
        }

        // G421: `a` empurra `b`, que está encostado (parede/estrutura) e não consegue sair
        const key = `${a.key}>${b.key}`;
        const pin = this.pins.get(key) ?? { time: 0, called: 0, apart: 0 };
        const ca = center(a.footprint);
        const cb = center(b.footprint);
        const dir = { x: cb.x - ca.x, y: cb.y - ca.y };
        const len = Math.hypot(dir.x, dir.y) || 1;
        const pushing = (a.push.x * dir.x + a.push.y * dir.y) / len > 0.2;
        // preso: parado e encostado na parede ou num terceiro robô (sanduíche)
        const sandwiched = robots.some((c) => c !== a && c !== b && polygonsTouch(b.footprint, c.footprint));
        const stuck = Math.hypot(b.velocity.x, b.velocity.y) < PINNED_SPEED && (b.blocked || sandwiched);
        if (touching && pushing && stuck) {
          pin.apart = 0;
          pin.time += dt;
          if (pin.time >= PIN_SECONDS * (pin.called + 1)) {
            pin.called++;
            events.push({
              rule: "G421",
              alliance: a.alliance,
              penalty: "major",
              text: pin.called === 1 ? "PIN no adversário por mais de 3 s" : `PIN continua (${Math.round(pin.time)} s)`,
            });
          }
        } else if (pin.time > 0) {
          pin.apart += dt;
          if (pin.apart >= PIN_RELEASE_S) {
            pin.time = 0;
            pin.called = 0;
          }
        }
        this.pins.set(key, pin);
      }
    }
    return events;
  }
}
