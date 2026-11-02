// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
import { describe, expect, it } from "vitest";
import { MotorModel, DRIVE_MOTOR, RobotHardware, mecanumFromWheels } from "./robotHardware";

describe("cinemática mecanum", () => {
  it("todas as rodas para frente = andar para frente", () => {
    expect(mecanumFromWheels({ leftFront: 1, leftBack: 1, rightFront: 1, rightBack: 1 })).toEqual({ forward: 1, strafe: 0, turn: 0 });
  });

  it("padrão de strafe para a direita (fl+, bl-, fr-, br+) = strafe negativo (direita)", () => {
    expect(mecanumFromWheels({ leftFront: 1, leftBack: -1, rightFront: -1, rightBack: 1 }).strafe).toBe(-1);
  });
});

describe("motor", () => {
  it("RUN_TO_POSITION para dentro da tolerância", () => {
    const m = new MotorModel(DRIVE_MOTOR);
    m.mode = 2;
    m.target = 500;
    m.power = 0.8;
    for (let i = 0; i < 400; i++) m.step(0.01);
    expect(Math.abs(m.position - 500)).toBeLessThanOrEqual(15);
  });

  it("sem REVERSE no lado esquerdo o robô gira em vez de andar (montagem espelhada)", () => {
    const hw = new RobotHardware();
    for (const n of ["leftFront", "leftBack", "rightFront", "rightBack"]) hw.motors.get(n)!.power = 1;
    let actions = hw.step(0.01);
    for (let i = 0; i < 100; i++) actions = hw.step(0.01);
    expect(Math.abs(actions.forward)).toBeLessThan(0.01);
    expect(actions.turn).toBeGreaterThan(0.9);
  });

  it("alimentador só lança na subida do servo e com o lançador girando", () => {
    const hw = new RobotHardware();
    hw.servos.set("feeder", 1);
    expect(hw.step(0.01).launch).toBe(false);
    hw.servos.set("feeder", 0);
    hw.step(0.01);
    hw.motors.get("launcher")!.power = 1;
    for (let i = 0; i < 50; i++) hw.step(0.01);
    hw.servos.set("feeder", 1);
    expect(hw.step(0.01).launch).toBe(true);
    expect(hw.step(0.01).launch).toBe(false);
  });
});
