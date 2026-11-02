// Buzz Simulator — teste do M5a. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
package org.firstinspires.ftc.teamcode;

import com.qualcomm.hardware.rev.RevHubOrientationOnRobot;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.DcMotorEx;
import com.qualcomm.robotcore.hardware.DcMotorSimple;
import com.qualcomm.robotcore.hardware.IMU;
import com.qualcomm.robotcore.util.ElapsedTime;
import com.qualcomm.robotcore.util.Range;
import org.firstinspires.ftc.robotcore.external.navigation.AngleUnit;

@TeleOp(name = "Teste básico", group = "M5a")
public class TestBasic extends LinearOpMode {
    @Override
    public void runOpMode() {
        DcMotor leftFront = hardwareMap.get(DcMotor.class, "leftFront");
        DcMotorEx rightFront = hardwareMap.get(DcMotorEx.class, "rightFront");
        leftFront.setDirection(DcMotorSimple.Direction.REVERSE);
        IMU imu = hardwareMap.get(IMU.class, "imu");
        imu.initialize(new IMU.Parameters(new RevHubOrientationOnRobot(
            RevHubOrientationOnRobot.LogoFacingDirection.UP, RevHubOrientationOnRobot.UsbFacingDirection.FORWARD)));
        telemetry.addData("Status", "Inicializado");
        telemetry.update();

        waitForStart();
        ElapsedTime timer = new ElapsedTime();
        int loops = 0;
        while (opModeIsActive() && timer.seconds() < 1.0) {
            double power = Range.clip(-gamepad1.left_stick_y + 0.5, -1, 1);
            leftFront.setPower(power);
            rightFront.setPower(power);
            loops++;
            telemetry.addData("yaw", "%.1f", imu.getRobotYawPitchRollAngles().getYaw(AngleUnit.DEGREES));
            telemetry.addData("lf", leftFront.getCurrentPosition());
            telemetry.update();
        }

        leftFront.setMode(DcMotor.RunMode.STOP_AND_RESET_ENCODER);
        leftFront.setTargetPosition(500);
        leftFront.setMode(DcMotor.RunMode.RUN_TO_POSITION);
        leftFront.setPower(0.8);
        while (opModeIsActive() && leftFront.isBusy()) {
            idle();
        }
        telemetry.addData("loops", loops);
        telemetry.addData("lfFinal", leftFront.getCurrentPosition());
        telemetry.addData("rfVel", "%.0f", rightFront.getVelocity());
        telemetry.update();
    }
}
