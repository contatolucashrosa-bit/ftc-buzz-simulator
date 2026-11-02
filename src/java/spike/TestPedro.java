// Buzz Simulator — teste do M5a. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
package org.firstinspires.ftc.teamcode;

import com.pedropathing.api.Paths;
import com.pedropathing.drivetrain.DrivePowers;
import com.pedropathing.math.Pose;
import com.pedropathing.paths.Path;
import com.pedropathing.revhub.drivetrains.Mecanum;
import com.pedropathing.revhub.drivetrains.MecanumConfig;
import com.pedropathing.revhub.localizers.PinpointConfig;
import com.pedropathing.revhub.localizers.PinpointLocalizer;
import com.qualcomm.hardware.gobilda.GoBildaPinpointDriver;
import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.DcMotorSimple;

@Autonomous(name = "Teste Pedro", group = "M5a")
public class TestPedro extends LinearOpMode {
    @Override
    public void runOpMode() {
        Mecanum drive = new Mecanum(hardwareMap, new MecanumConfig(c -> {
            c.frontLeftName.set("leftFront");
            c.backLeftName.set("leftBack");
            c.frontRightName.set("rightFront");
            c.backRightName.set("rightBack");
            c.frontLeftDirection.set(DcMotorSimple.Direction.REVERSE);
            c.backLeftDirection.set(DcMotorSimple.Direction.REVERSE);
            c.frontRightDirection.set(DcMotorSimple.Direction.FORWARD);
            c.backRightDirection.set(DcMotorSimple.Direction.FORWARD);
        }));
        PinpointLocalizer localizer = new PinpointLocalizer(hardwareMap, new PinpointConfig(c -> {
            c.name.set("pinpoint");
            c.xPodDirection.set(GoBildaPinpointDriver.EncoderDirection.FORWARD);
            c.yPodDirection.set(GoBildaPinpointDriver.EncoderDirection.FORWARD);
            c.xPodOffset.set(0.0);
            c.yPodOffset.set(0.0);
        }));
        Path path = Paths.line(new Pose(0, 0, 0), new Pose(24, 12, 0));
        telemetry.addData("caminho", path.toString());
        telemetry.update();

        waitForStart();
        long frames = 0;
        double start = getRuntime();
        while (opModeIsActive() && getRuntime() - start < 0.6) {
            drive.drive(new DrivePowers(0.5, 0, 0), true);
            localizer.update();
            frames++;
        }
        drive.stop();
        localizer.update();
        telemetry.addData("frames", frames);
        telemetry.addData("estado", localizer.state().toString());
        telemetry.update();
    }
}
