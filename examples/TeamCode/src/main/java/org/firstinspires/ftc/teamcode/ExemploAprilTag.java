// Buzz Simulator — exemplo de visão. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Procura as AprilTags da própria HIVE (IDs 30–37 na vermelha), vira para elas e para a 50 pol, usando só a câmera.
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.DcMotorSimple;
import java.util.List;
import org.firstinspires.ftc.robotcore.external.hardware.camera.WebcamName;
import org.firstinspires.ftc.robotcore.external.navigation.AngleUnit;
import org.firstinspires.ftc.robotcore.external.navigation.DistanceUnit;
import org.firstinspires.ftc.robotcore.external.navigation.Position;
import org.firstinspires.ftc.robotcore.external.navigation.YawPitchRollAngles;
import org.firstinspires.ftc.vision.VisionPortal;
import org.firstinspires.ftc.vision.apriltag.AprilTagDetection;
import org.firstinspires.ftc.vision.apriltag.AprilTagProcessor;

@Autonomous(name = "Exemplo: ir até a HIVE pela AprilTag", group = "Exemplos")
public class ExemploAprilTag extends LinearOpMode {
    private static final double DESIRED_RANGE = 50; // pol

    private DcMotor leftFront, leftBack, rightFront, rightBack;

    @Override
    public void runOpMode() {
        leftFront = hardwareMap.get(DcMotor.class, "leftFront");
        leftBack = hardwareMap.get(DcMotor.class, "leftBack");
        rightFront = hardwareMap.get(DcMotor.class, "rightFront");
        rightBack = hardwareMap.get(DcMotor.class, "rightBack");
        leftFront.setDirection(DcMotorSimple.Direction.REVERSE);
        leftBack.setDirection(DcMotorSimple.Direction.REVERSE);

        // câmera na frente do robô, a 8 pol do chão, inclinada 25° para cima (pitch -90 = horizontal)
        AprilTagProcessor aprilTag = new AprilTagProcessor.Builder()
                .setOutputUnits(DistanceUnit.INCH, AngleUnit.DEGREES)
                .setCameraPose(new Position(DistanceUnit.INCH, 0, 7, 8, 0), new YawPitchRollAngles(AngleUnit.DEGREES, 0, -65, 0, 0))
                .build();
        VisionPortal portal = new VisionPortal.Builder()
                .setCamera(hardwareMap.get(WebcamName.class, "Webcam 1"))
                .addProcessor(aprilTag)
                .build();

        telemetry.addData("Câmera", portal.getCameraState());
        telemetry.update();
        waitForStart();

        while (opModeIsActive()) {
            AprilTagDetection target = null;
            List<AprilTagDetection> detections = aprilTag.getDetections();
            for (AprilTagDetection d : detections) {
                if (d.metadata == null || d.id < 30 || d.id > 37) continue;
                if (target == null || d.ftcPose.range < target.ftcPose.range) target = d;
            }

            double forward = 0;
            double turn;
            if (target == null) {
                turn = 0.25; // gira devagar para a esquerda até achar a HIVE
                telemetry.addLine("Procurando a HIVE...");
            } else {
                double rangeError = target.ftcPose.range - DESIRED_RANGE;
                turn = clip(target.ftcPose.bearing * 0.02, 0.3);
                forward = Math.abs(target.ftcPose.bearing) < 10 ? clip(rangeError * 0.03, 0.5) : 0;
                telemetry.addData("Tag", "%d (%s)", target.id, target.metadata.name);
                telemetry.addData("Distância", "%.1f pol", target.ftcPose.range);
                telemetry.addData("Direção", "%.1f°", target.ftcPose.bearing);
                telemetry.addData("Robô (pela tag)", "x %.1f  y %.1f  %.0f°",
                        target.robotPose.getPosition().x, target.robotPose.getPosition().y, target.robotPose.getOrientation().getYaw(AngleUnit.DEGREES));
                if (Math.abs(rangeError) < 1.5 && Math.abs(target.ftcPose.bearing) < 2) {
                    forward = 0;
                    turn = 0;
                    telemetry.addLine("Chegou!");
                }
            }
            telemetry.addData("Tags vistas", detections.size());
            telemetry.update();
            leftFront.setPower(forward - turn);
            leftBack.setPower(forward - turn);
            rightFront.setPower(forward + turn);
            rightBack.setPower(forward + turn);
        }
        portal.close();
    }

    private static double clip(double v, double max) {
        return Math.max(-max, Math.min(max, v));
    }
}
