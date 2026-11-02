// Buzz Simulator — teste do M5a. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
package org.firstinspires.ftc.teamcode;

import com.acmerobotics.roadrunner.Pose2d;
import com.acmerobotics.roadrunner.Vector2d;
import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;

/** Usa o MecanumDrive do Quickstart do RoadRunner, sem alterações, compilado junto. */
@Autonomous(name = "Teste RoadRunner", group = "M5a")
public class TestRoadRunner extends LinearOpMode {
    @Override
    public void runOpMode() {
        Pose2d start = new Pose2d(0, 0, 0);
        MecanumDrive drive = new MecanumDrive(hardwareMap, start);
        Vector2d target = new Vector2d(24, 0);
        telemetry.addData("inicio", start.toString());
        telemetry.update();

        waitForStart();
        long frames = 0;
        double t0 = getRuntime();
        while (opModeIsActive() && getRuntime() - t0 < 0.6) {
            drive.setDrivePowers(new com.acmerobotics.roadrunner.PoseVelocity2d(new Vector2d(0.5, 0), 0));
            drive.updatePoseEstimate();
            frames++;
        }
        drive.setDrivePowers(new com.acmerobotics.roadrunner.PoseVelocity2d(new Vector2d(0, 0), 0));
        telemetry.addData("frames", frames);
        telemetry.addData("pose", drive.localizer.getPose().toString());
        telemetry.addData("alvo", target.toString());
        telemetry.update();
    }
}
