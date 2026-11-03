// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { packageFileName, packRobot, RobotPackageError, unpackRobot } from "./robotPackage";
import type { StoredRobot } from "./robotStore";

const glb = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 1, 2, 3, 4]);
const robot: StoredRobot = {
  id: "a",
  name: "Tubarão 2027",
  preset: "gobilda",
  sizeIn: { length: 17.8, width: 16.8, height: 12 },
  sourceFile: "robo.step",
  triangles: 1234,
  createdAt: 1,
  glb: glb.slice().buffer,
};

describe("pacote .buzzrobot.zip", () => {
  it("exporta e importa o mesmo robô, com créditos", () => {
    const zip = packRobot(robot, { team: "WestSharksFTC #24823", author: "Equipe de CAD" });
    const back = unpackRobot(zip, "b", 99);
    expect(back.id).toBe("b");
    expect(back.name).toBe("Tubarão 2027");
    expect(back.preset).toBe("gobilda");
    expect(back.sizeIn).toEqual(robot.sizeIn);
    expect(new Uint8Array(back.glb)).toEqual(glb);
    expect(back.credits.team).toBe("WestSharksFTC #24823");
  });

  it("recusa arquivos que não são pacotes do simulador, com mensagem em pt-BR", () => {
    expect(() => unpackRobot(strToU8("não é zip"), "x")).toThrow(RobotPackageError);
    expect(() => unpackRobot(zipSync({ "outro.txt": strToU8("oi") }), "x")).toThrow(/robot.json/);
    const bad = zipSync({ "robot.json": strToU8(JSON.stringify({ format: "buzz-simulator-robot", version: 1, preset: "gobilda", sizeIn: { length: 18, width: 18, height: 18 } })), "model.glb": strToU8("xxxx") });
    expect(() => unpackRobot(bad, "x")).toThrow(/GLB/);
  });

  it("gera um nome de arquivo sem acentos nem espaços", () => {
    expect(packageFileName("Tubarão 2027!")).toBe("tubarao-2027.buzzrobot.zip");
  });
});
