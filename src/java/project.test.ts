// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
import { describe, expect, it } from "vitest";
import { detectLibs, findHardware, guessDeviceMap, parseOpModes, selectTeamCode } from "./project";

const TELEOP = `package org.firstinspires.ftc.teamcode;
import com.qualcomm.robotcore.eventloop.opmode.*;
import com.qualcomm.robotcore.hardware.*;
// @Autonomous(name = "comentado") não conta
@TeleOp(name = "Pilotagem", group = "Comp")
public class Drive extends LinearOpMode {
  @Override public void runOpMode() {
    DcMotor fl = hardwareMap.get(DcMotor.class, "fl");
    DcMotor br = hardwareMap.get(DcMotorEx.class, "backRight");
    DcMotor shooter = hardwareMap.dcMotor.get("shooter");
    Servo kicker = hardwareMap.servo.get("kicker");
    IMU imu = hardwareMap.get(IMU.class, "imu");
  }
}`;
const AUTO = `package org.firstinspires.ftc.teamcode.auto;
import com.pedropathing.follower.Follower;
@Disabled
@Autonomous
public class OldAuto extends OpMode { public void init() {} public void loop() {} }`;

describe("projeto Java da equipe", () => {
  it("pega só o TeamCode de um projeto inteiro do Android Studio", () => {
    const files = selectTeamCode([
      { path: "MyRobot/TeamCode/src/main/java/org/firstinspires/ftc/teamcode/Drive.java", text: TELEOP },
      { path: "MyRobot/FtcRobotController/src/main/java/Sample.java", text: "class Sample {}" },
      { path: "MyRobot/README.md", text: "" },
    ]);
    expect(Object.keys(files)).toEqual(["org/firstinspires/ftc/teamcode/Drive.java"]);
  });

  it("acha OpModes com nome, tipo, grupo e @Disabled", () => {
    const ops = parseOpModes({ "Drive.java": TELEOP, "OldAuto.java": AUTO });
    expect(ops).toHaveLength(2);
    const teleop = ops.find((o) => o.type === "teleop")!;
    expect(teleop).toMatchObject({ className: "org.firstinspires.ftc.teamcode.Drive", name: "Pilotagem", group: "Comp", disabled: false });
    const auto = ops.find((o) => o.type === "autonomous")!;
    expect(auto).toMatchObject({ className: "org.firstinspires.ftc.teamcode.auto.OldAuto", name: "OldAuto", disabled: true });
  });

  it("detecta as bibliotecas pelos imports", () => {
    expect(detectLibs({ a: AUTO })).toEqual(["sdk", "pedro"]);
    expect(detectLibs({ a: "import com.acmerobotics.roadrunner.Pose2d;" })).toContain("kotlin");
  });

  it("lista o hardware pedido e liga aos dispositivos do robô simulado", () => {
    const hw = findHardware({ "Drive.java": TELEOP });
    expect(hw).toEqual(
      expect.arrayContaining([
        { name: "fl", kind: "motor" },
        { name: "backRight", kind: "motor" },
        { name: "shooter", kind: "motor" },
        { name: "kicker", kind: "servo" },
        { name: "imu", kind: "imu" },
      ]),
    );
    const map = guessDeviceMap(hw);
    expect(map).toMatchObject({ fl: "leftFront", backRight: "rightBack", shooter: "launcher", kicker: "feeder", imu: "imu" });
  });
});
