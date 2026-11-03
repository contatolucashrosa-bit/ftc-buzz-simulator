// Buzz Simulator — exemplo de TeleOp. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Código Java comum do Android Studio: roda igual no Control Hub e no simulador.
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.DcMotorEx;
import com.qualcomm.robotcore.hardware.DcMotorSimple;
import com.qualcomm.robotcore.hardware.Servo;

@TeleOp(name = "Exemplo: TeleOp mecanum", group = "Exemplos")
public class ExemploTeleOp extends LinearOpMode {
    @Override
    public void runOpMode() {
        DcMotor leftFront = hardwareMap.get(DcMotor.class, "leftFront");
        DcMotor leftBack = hardwareMap.get(DcMotor.class, "leftBack");
        DcMotor rightFront = hardwareMap.get(DcMotor.class, "rightFront");
        DcMotor rightBack = hardwareMap.get(DcMotor.class, "rightBack");
        DcMotor intake = hardwareMap.get(DcMotor.class, "intake");
        DcMotorEx launcher = hardwareMap.get(DcMotorEx.class, "launcher");
        Servo feeder = hardwareMap.get(Servo.class, "feeder");
        Servo hood = hardwareMap.get(Servo.class, "hood");

        // as rodas esquerdas ficam espelhadas no chassi
        leftFront.setDirection(DcMotorSimple.Direction.REVERSE);
        leftBack.setDirection(DcMotorSimple.Direction.REVERSE);
        launcher.setMode(DcMotor.RunMode.RUN_USING_ENCODER);
        double hoodPosition = 0.4;

        telemetry.addLine("Pronto. Analógico esquerdo anda, direito gira.");
        telemetry.addLine("Gatilho esquerdo: intake. Bumper direito: liga o lançador. A: lança.");
        telemetry.update();
        waitForStart();

        boolean launcherOn = false;
        while (opModeIsActive()) {
            double y = -gamepad1.left_stick_y;
            double x = gamepad1.left_stick_x;
            double rx = gamepad1.right_stick_x;
            double denominator = Math.max(Math.abs(y) + Math.abs(x) + Math.abs(rx), 1);
            leftFront.setPower((y + x + rx) / denominator);
            leftBack.setPower((y - x + rx) / denominator);
            rightFront.setPower((y - x - rx) / denominator);
            rightBack.setPower((y + x - rx) / denominator);

            intake.setPower(gamepad1.left_trigger > 0.3 ? 1.0 : 0.0);
            if (gamepad1.rightBumperWasPressed()) launcherOn = !launcherOn;
            launcher.setVelocity(launcherOn ? 2000 : 0);
            feeder.setPosition(gamepad1.a ? 1.0 : 0.0);
            if (gamepad1.dpad_up) hoodPosition = Math.min(1, hoodPosition + 0.01);
            if (gamepad1.dpad_down) hoodPosition = Math.max(0, hoodPosition - 0.01);
            hood.setPosition(hoodPosition);

            telemetry.addData("Lançador", launcherOn ? "ligado" : "desligado");
            telemetry.addData("Velocidade do lançador", "%.0f ticks/s", launcher.getVelocity());
            telemetry.addData("Capô", "%.2f", hoodPosition);
            telemetry.addData("Encoder leftFront", leftFront.getCurrentPosition());
            telemetry.update();
        }
    }
}
