// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
import { describe, expect, it } from "vitest";
import { FoulMonitor, polygonsTouch, type FoulRobot } from "./fouls";

function box(x: number, y: number, half = 9): Array<{ x: number; y: number }> {
  return [
    { x: x + half, y: y + half },
    { x: x + half, y: y - half },
    { x: x - half, y: y - half },
    { x: x - half, y: y + half },
  ];
}

function robot(key: string, alliance: "red" | "blue", x: number, y: number, extra: Partial<FoulRobot> = {}): FoulRobot {
  return { key, alliance, footprint: box(x, y), velocity: { x: 0, y: 0 }, push: { x: 0, y: 0 }, blocked: false, ...extra };
}

describe("faltas de contato", () => {
  it("detecta contato com folga de 1 pol", () => {
    expect(polygonsTouch(box(0, 0), box(18.5, 0))).toBe(true);
    expect(polygonsTouch(box(0, 0), box(20, 0))).toBe(false);
  });

  it("G421: empurrar um adversário preso na parede por mais de 3 s, e de novo a cada 3 s", () => {
    const monitor = new FoulMonitor();
    const red = robot("red-1", "red", 44, 0, { push: { x: 1, y: 0 } });
    const blue = robot("blue-1", "blue", 62, 0, { blocked: true });
    const events = [];
    for (let t = 0; t < 6.5; t += 0.1) events.push(...monitor.update(0.1, [red, blue], false));
    expect(events.map((e) => e.rule)).toEqual(["G421", "G421"]);
    expect(events[0].alliance).toBe("red");
  });

  it("G421 não conta quando o adversário consegue andar ou quando ninguém empurra", () => {
    const monitor = new FoulMonitor();
    const red = robot("red-1", "red", 44, 0, { push: { x: 1, y: 0 } });
    const moving = robot("blue-1", "blue", 62, 0, { blocked: true, velocity: { x: 0, y: 10 } });
    const idle = robot("red-2", "red", 44, 30);
    const walled = robot("blue-2", "blue", 62, 30, { blocked: true });
    const events = [];
    for (let t = 0; t < 5; t += 0.1) events.push(...monitor.update(0.1, [red, moving, idle, walled], false));
    expect(events).toEqual([]);
  });

  it("G402: encostar no adversário estando todo no lado dele durante o AUTO, uma vez por robô", () => {
    const monitor = new FoulMonitor();
    const red = robot("red-1", "red", 30, 0);
    const blue = robot("blue-1", "blue", 48, 0);
    expect(monitor.update(0.1, [red, blue], true).map((e) => [e.rule, e.alliance])).toEqual([["G402", "red"]]);
    expect(monitor.update(0.1, [red, blue], true)).toEqual([]);
    // no TELEOP o mesmo contato não é falta
    const later = new FoulMonitor();
    expect(later.update(0.1, [red, blue], false)).toEqual([]);
  });
});
