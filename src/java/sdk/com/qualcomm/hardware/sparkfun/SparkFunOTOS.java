// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package com.qualcomm.hardware.sparkfun;

import com.qualcomm.robotcore.hardware.HardwareDevice;
import org.buzzsim.internal.Odometry;
import org.firstinspires.ftc.robotcore.external.navigation.AngleUnit;
import org.firstinspires.ftc.robotcore.external.navigation.DistanceUnit;

/** SparkFun OTOS com a odometria ideal do simulador. */
public class SparkFunOTOS implements HardwareDevice {
    public static final byte DEFAULT_ADDRESS = 0x17;
    public static final double MIN_SCALAR = 0.872;
    public static final double MAX_SCALAR = 1.127;

    public static class Pose2D {
        public double x;
        public double y;
        public double h;

        public Pose2D() {}

        public Pose2D(double x, double y, double h) {
            this.x = x;
            this.y = y;
            this.h = h;
        }

        public void set(Pose2D pose) {
            x = pose.x;
            y = pose.y;
            h = pose.h;
        }

        @Override
        public String toString() {
            return "(" + x + ", " + y + ", " + h + ")";
        }
    }

    private final String name;
    private final Odometry odometry;
    private DistanceUnit linearUnit = DistanceUnit.INCH;
    private AngleUnit angularUnit = AngleUnit.DEGREES;
    private double linearScalar = 1;
    private double angularScalar = 1;

    public SparkFunOTOS(String name) {
        this.name = name;
        this.odometry = new Odometry(name);
    }

    @Override public Manufacturer getManufacturer() { return Manufacturer.SparkFun; }
    @Override public String getDeviceName() { return "SparkFun OTOS " + name; }
    @Override public String getConnectionInfo() { return "Buzz Simulator; " + name; }
    @Override public int getVersion() { return 1; }
    @Override public void resetDeviceConfigurationForOpMode() {}
    @Override public void close() {}

    public boolean begin() { return true; }
    public boolean isConnected() { return true; }
    public boolean selfTest() { return true; }
    public boolean calibrateImu() { return true; }
    public boolean calibrateImu(int numSamples, boolean waitUntilDone) { return true; }
    public int getImuCalibrationProgress() { return 0; }
    public void setLinearUnit(DistanceUnit unit) { linearUnit = unit; }
    public void setAngularUnit(AngleUnit unit) { angularUnit = unit; }
    public double getLinearScalar() { return linearScalar; }
    public boolean setLinearScalar(double scalar) { linearScalar = scalar; return true; }
    public double getAngularScalar() { return angularScalar; }
    public boolean setAngularScalar(double scalar) { angularScalar = scalar; return true; }
    public void resetTracking() { odometry.reset(); }
    public void setOffset(Pose2D pose) {}

    public Pose2D getPosition() {
        odometry.update();
        return new Pose2D(linearUnit.fromMm(odometry.x), linearUnit.fromMm(odometry.y), angularUnit.fromRadians(odometry.h));
    }

    public void setPosition(Pose2D pose) {
        odometry.setPose(linearUnit.toMm(pose.x), linearUnit.toMm(pose.y), angularUnit.toRadians(pose.h));
    }

    public Pose2D getVelocity() {
        odometry.update();
        return new Pose2D(linearUnit.fromMm(odometry.vx), linearUnit.fromMm(odometry.vy), angularUnit.fromRadians(odometry.vh));
    }

    public void getPosVelAcc(Pose2D pos, Pose2D vel, Pose2D acc) {
        pos.set(getPosition());
        vel.set(getVelocity());
        acc.set(new Pose2D());
    }

    public void getPosVelAccStdDev(Pose2D pos, Pose2D vel, Pose2D acc) {
        pos.set(new Pose2D());
        vel.set(new Pose2D());
        acc.set(new Pose2D());
    }

    public void getPosVelAccAndStdDev(Pose2D pos, Pose2D vel, Pose2D acc, Pose2D posStd, Pose2D velStd, Pose2D accStd) {
        getPosVelAcc(pos, vel, acc);
        getPosVelAccStdDev(posStd, velStd, accStd);
    }

    public Pose2D getPositionStdDev() { return new Pose2D(); }
    public Pose2D getVelocityStdDev() { return new Pose2D(); }
}
