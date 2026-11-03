// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.vision.apriltag;

import java.util.ArrayList;
import org.buzzsim.internal.SimAprilTagProcessor;
import org.firstinspires.ftc.robotcore.external.navigation.AngleUnit;
import org.firstinspires.ftc.robotcore.external.navigation.DistanceUnit;
import org.firstinspires.ftc.robotcore.external.navigation.Position;
import org.firstinspires.ftc.robotcore.external.navigation.YawPitchRollAngles;
import org.firstinspires.ftc.vision.VisionProcessor;

public abstract class AprilTagProcessor implements VisionProcessor {
    public static final int THREADS_DEFAULT = 3;

    public enum TagFamily { TAG_36h11, TAG_25h9, TAG_16h5, TAG_standard41h12 }

    public enum PoseSolver { APRILTAG_BUILTIN, OPENCV_ITERATIVE, OPENCV_SOLVEPNP_EPNP, OPENCV_IPPE, OPENCV_IPPE_SQUARE, OPENCV_SQPNP }

    public static AprilTagProcessor easyCreateWithDefaults() {
        return new Builder().build();
    }

    public static class Builder {
        private AprilTagLibrary library = null;
        private TagFamily family = TagFamily.TAG_36h11;
        private DistanceUnit distanceUnit = DistanceUnit.INCH;
        private AngleUnit angleUnit = AngleUnit.DEGREES;
        private double fx, fy, cx, cy;
        private Position cameraPosition = null;
        private YawPitchRollAngles cameraOrientation = null;

        public Builder setTagLibrary(AprilTagLibrary tagLibrary) { library = tagLibrary; return this; }
        public Builder setTagFamily(TagFamily tagFamily) { family = tagFamily; return this; }
        public Builder setLensIntrinsics(double fx, double fy, double cx, double cy) {
            this.fx = fx;
            this.fy = fy;
            this.cx = cx;
            this.cy = cy;
            return this;
        }
        public Builder setOutputUnits(DistanceUnit distanceUnit, AngleUnit angleUnit) {
            this.distanceUnit = distanceUnit;
            this.angleUnit = angleUnit;
            return this;
        }
        public Builder setCameraPose(Position position, YawPitchRollAngles orientation) {
            cameraPosition = position;
            cameraOrientation = orientation;
            return this;
        }
        // desenho na imagem e ajustes de desempenho do detector real: sem efeito no simulador
        public Builder setDrawAxes(boolean drawAxes) { return this; }
        public Builder setDrawCubeProjection(boolean drawCube) { return this; }
        public Builder setDrawTagOutline(boolean drawOutline) { return this; }
        public Builder setDrawTagID(boolean drawTagId) { return this; }
        public Builder setNumThreads(int threads) { return this; }
        public Builder setSuppressCalibrationWarnings(boolean suppress) { return this; }

        public AprilTagProcessor build() {
            AprilTagLibrary lib = library != null ? library : AprilTagGameDatabase.getCurrentGameTagLibrary();
            // as tags do campo são 36h11: outra família não detecta nada
            return new SimAprilTagProcessor(lib, family == TagFamily.TAG_36h11, distanceUnit, angleUnit, fx, fy, cx, cy, cameraPosition, cameraOrientation);
        }
    }

    public abstract void setDecimation(float decimation);
    public abstract void setPoseSolver(PoseSolver poseSolver);
    public abstract int getPerTagAvgPoseSolveTime();
    public abstract ArrayList<AprilTagDetection> getDetections();
    public abstract ArrayList<AprilTagDetection> getFreshDetections();
}
