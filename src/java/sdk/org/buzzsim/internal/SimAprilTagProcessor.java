// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.buzzsim.internal;

import java.util.ArrayList;
import org.firstinspires.ftc.robotcore.external.navigation.AngleUnit;
import org.firstinspires.ftc.robotcore.external.navigation.DistanceUnit;
import org.firstinspires.ftc.robotcore.external.navigation.Pose3D;
import org.firstinspires.ftc.robotcore.external.navigation.Position;
import org.firstinspires.ftc.robotcore.external.navigation.YawPitchRollAngles;
import org.firstinspires.ftc.vision.apriltag.AprilTagDetection;
import org.firstinspires.ftc.vision.apriltag.AprilTagLibrary;
import org.firstinspires.ftc.vision.apriltag.AprilTagMetadata;
import org.firstinspires.ftc.vision.apriltag.AprilTagPoseFtc;
import org.firstinspires.ftc.vision.apriltag.AprilTagPoseRaw;
import org.firstinspires.ftc.vision.apriltag.AprilTagProcessor;
import org.opencv.core.Point;

/**
 * Processador de AprilTag do simulador: a "imagem" é a geometria do campo, calculada no JavaScript
 * (src/sim/vision.ts) a cada quadro de câmera (30 fps).
 */
public class SimAprilTagProcessor extends AprilTagProcessor {
    private static final double FPS = 30;
    /** Montagem física da câmera quando o código não chama setCameraPose: frente do robô, 8 pol, 25° para cima. */
    private static final double[] DEFAULT_MOUNT = {0, 7, 8, 0, -65, 0};

    private final AprilTagLibrary library;
    private final boolean detects;
    private final DistanceUnit distanceUnit;
    private final AngleUnit angleUnit;
    private final double fx, fy, cx, cy;
    private final double[] mount;
    private int width = 640;
    private int height = 480;
    private boolean enabled = true;
    private long lastFrame = -1;

    public SimAprilTagProcessor(AprilTagLibrary library, boolean detects, DistanceUnit distanceUnit, AngleUnit angleUnit,
                                double fx, double fy, double cx, double cy, Position cameraPosition, YawPitchRollAngles cameraOrientation) {
        this.library = library;
        this.detects = detects;
        this.distanceUnit = distanceUnit;
        this.angleUnit = angleUnit;
        this.fx = fx;
        this.fy = fy;
        this.cx = cx;
        this.cy = cy;
        if (cameraPosition == null || cameraOrientation == null) {
            mount = DEFAULT_MOUNT;
        } else {
            Position p = cameraPosition.toUnit(DistanceUnit.INCH);
            mount = new double[] {p.x, p.y, p.z, cameraOrientation.getYaw(AngleUnit.DEGREES), cameraOrientation.getPitch(AngleUnit.DEGREES), cameraOrientation.getRoll(AngleUnit.DEGREES)};
        }
    }

    /** Chamado pelo VisionPortal: resolução da câmera e se o processador está ligado e transmitindo. */
    public void attach(int width, int height) {
        this.width = width;
        this.height = height;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isEnabled() {
        return enabled;
    }

    @Override public void setDecimation(float decimation) {}
    @Override public void setPoseSolver(PoseSolver poseSolver) {}
    @Override public int getPerTagAvgPoseSolveTime() { return 1; }

    @Override
    public ArrayList<AprilTagDetection> getFreshDetections() {
        long frame = (long) Math.floor(Hw.time() * FPS);
        if (frame == lastFrame) return null;
        return getDetections();
    }

    @Override
    public ArrayList<AprilTagDetection> getDetections() {
        ArrayList<AprilTagDetection> out = new ArrayList<>();
        lastFrame = (long) Math.floor(Hw.time() * FPS);
        if (!enabled || !detects) return out;
        // sem calibração informada: a da Logitech C920, escalada para a resolução escolhida
        double scale = width / 640.0;
        double lfx = fx > 0 ? fx : 622.001 * scale;
        double lfy = fy > 0 ? fy : 622.001 * scale;
        double lcx = cx > 0 ? cx : width / 2.0;
        double lcy = cy > 0 ? cy : height / 2.0;
        String all = Hw.aprilTags(mount[0], mount[1], mount[2], mount[3], mount[4], mount[5], lfx, lfy, lcx, lcy, width, height);
        if (all == null || all.isEmpty()) return out;
        long nanos = (long) (Hw.time() * 1e9);
        for (String row : all.split(";")) {
            String[] s = row.split(",");
            double[] v = new double[s.length];
            for (int i = 0; i < s.length; i++) v[i] = Double.parseDouble(s[i]);
            int id = (int) v[0];
            double u = v[10];
            double w = v[11];
            double half = v[12] / 2;
            Point[] corners = {new Point(u - half, w + half), new Point(u + half, w + half), new Point(u + half, w - half), new Point(u - half, w - half)};
            AprilTagMetadata metadata = library.lookupTag(id);
            AprilTagPoseFtc ftcPose = null;
            AprilTagPoseRaw rawPose = null;
            Pose3D robotPose = null;
            // como no SDK: sem a tag na biblioteca (tamanho desconhecido) não há pose, só o ID e o centro
            if (metadata != null) {
                ftcPose = new AprilTagPoseFtc(
                        distanceUnit.fromInches(v[1]), distanceUnit.fromInches(v[2]), distanceUnit.fromInches(v[3]),
                        angleUnit.fromDegrees(v[4]), angleUnit.fromDegrees(v[5]), angleUnit.fromDegrees(v[6]),
                        distanceUnit.fromInches(v[7]), angleUnit.fromDegrees(v[8]), angleUnit.fromDegrees(v[9]));
                rawPose = new AprilTagPoseRaw(distanceUnit.fromInches(v[1]), distanceUnit.fromInches(-v[3]), distanceUnit.fromInches(v[2]));
                robotPose = new Pose3D(
                        new Position(distanceUnit, distanceUnit.fromInches(v[13]), distanceUnit.fromInches(v[14]), 0, nanos),
                        new YawPitchRollAngles(angleUnit, angleUnit.fromDegrees(v[15]), 0, 0, nanos));
            }
            float margin = (float) Math.min(100, v[12] * 2);
            out.add(new AprilTagDetection(id, 0, margin, new Point(u, w), corners, metadata, ftcPose, rawPose, robotPose, nanos));
        }
        return out;
    }
}
