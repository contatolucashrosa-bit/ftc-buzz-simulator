// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package com.qualcomm.hardware.gobilda;

import com.qualcomm.robotcore.hardware.HardwareDevice;
import org.buzzsim.internal.Odometry;
import org.firstinspires.ftc.robotcore.external.navigation.AngleUnit;
import org.firstinspires.ftc.robotcore.external.navigation.DistanceUnit;
import org.firstinspires.ftc.robotcore.external.navigation.Pose2D;
import org.firstinspires.ftc.robotcore.external.navigation.Quaternion;
import org.firstinspires.ftc.robotcore.external.navigation.UnnormalizedAngleUnit;

/** goBILDA Pinpoint com a odometria ideal do simulador. update() captura uma leitura, como no sensor real. */
public class GoBildaPinpointDriver implements HardwareDevice {
    public enum EncoderDirection { FORWARD, REVERSED }
    public enum GoBildaOdometryPods { goBILDA_SWINGARM_POD, goBILDA_4_BAR_POD }
    public enum DeviceStatus { NOT_READY, READY, CALIBRATING, FAULT_X_POD_NOT_DETECTED, FAULT_Y_POD_NOT_DETECTED, FAULT_NO_PODS_DETECTED, FAULT_IMU_RUNAWAY, FAULT_BAD_READ }
    public enum ReadData { ONLY_UPDATE_HEADING }
    public enum ErrorDetectionType { NONE, CRC, LOCAL_TEST, CRC_AND_LOCAL_TEST }
    public enum Register { DEVICE_ID, DEVICE_VERSION, DEVICE_STATUS, DEVICE_CONTROL, LOOP_TIME, X_ENCODER_VALUE, Y_ENCODER_VALUE, X_POSITION, Y_POSITION, H_ORIENTATION, X_VELOCITY, Y_VELOCITY, H_VELOCITY, MM_PER_TICK, X_POD_OFFSET, Y_POD_OFFSET, YAW_SCALAR, BULK_READ }

    private static final double TICKS_PER_MM_SWINGARM = 13.26291192;
    private static final double TICKS_PER_MM_4_BAR = 19.89436789;

    private final String name;
    private final Odometry odometry;
    private double ticksPerMm = TICKS_PER_MM_SWINGARM;
    private float xOffsetMm;
    private float yOffsetMm;
    private float yawScalar = 1;
    private double encX;
    private double encY;

    public GoBildaPinpointDriver(String name) {
        this.name = name;
        this.odometry = new Odometry(name);
    }

    @Override public Manufacturer getManufacturer() { return Manufacturer.Other; }
    @Override public String getDeviceName() { return "goBILDA Pinpoint Odometry Computer"; }
    @Override public String getConnectionInfo() { return "Buzz Simulator; " + name; }
    @Override public int getVersion() { return 3; }
    @Override public void resetDeviceConfigurationForOpMode() {}
    @Override public void close() {}

    public void update() {
        odometry.update();
        encX = odometry.x * ticksPerMm;
        encY = odometry.y * ticksPerMm;
    }

    public void update(ReadData data) { update(); }
    public void setBulkReadScope(Register... registers) {}
    public void setErrorDetectionType(ErrorDetectionType type) {}
    public void setOffsets(double xOffset, double yOffset, DistanceUnit unit) { xOffsetMm = (float) unit.toMm(xOffset); yOffsetMm = (float) unit.toMm(yOffset); }
    public void recalibrateIMU() {}
    public void resetPosAndIMU() { odometry.reset(); }
    public void setEncoderDirections(EncoderDirection x, EncoderDirection y) {}
    public void setEncoderResolution(GoBildaOdometryPods pods) { ticksPerMm = pods == GoBildaOdometryPods.goBILDA_4_BAR_POD ? TICKS_PER_MM_4_BAR : TICKS_PER_MM_SWINGARM; }
    public void setEncoderResolution(double ticksPerUnit, DistanceUnit unit) { ticksPerMm = ticksPerUnit / unit.toMm(1); }
    public void setYawScalar(double scalar) { yawScalar = (float) scalar; }

    public void setPosition(Pose2D pos) {
        odometry.setPose(pos.getX(DistanceUnit.MM), pos.getY(DistanceUnit.MM), pos.getHeading(AngleUnit.RADIANS));
    }

    public void setPosX(double x, DistanceUnit unit) { odometry.update(); odometry.setPose(unit.toMm(x), odometry.y, odometry.h); }
    public void setPosY(double y, DistanceUnit unit) { odometry.update(); odometry.setPose(odometry.x, unit.toMm(y), odometry.h); }
    public void setHeading(double heading, AngleUnit unit) { odometry.update(); odometry.setPose(odometry.x, odometry.y, unit.toRadians(heading)); }
    public int getDeviceID() { return 2; }
    public int getDeviceVersion() { return 3; }
    public float getYawScalar() { return yawScalar; }
    public DeviceStatus getDeviceStatus() { return DeviceStatus.READY; }
    public int getLoopTime() { return 667; }
    public double getFrequency() { return 1500; }
    public int getEncoderX() { return (int) Math.round(encX); }
    public int getEncoderY() { return (int) Math.round(encY); }
    public double getPosX(DistanceUnit unit) { return unit.fromMm(odometry.x); }
    public double getPosY(DistanceUnit unit) { return unit.fromMm(odometry.y); }
    public double getHeading(AngleUnit unit) { return unit.fromRadians(odometry.h); }
    public double getHeading(UnnormalizedAngleUnit unit) { return unit.fromRadians(odometry.h); }
    public double getVelX(DistanceUnit unit) { return unit.fromMm(odometry.vx); }
    public double getVelY(DistanceUnit unit) { return unit.fromMm(odometry.vy); }
    public double getHeadingVelocity(UnnormalizedAngleUnit unit) { return unit.fromRadians(odometry.vh); }
    public float getXOffset(DistanceUnit unit) { return (float) unit.fromMm(xOffsetMm); }
    public float getYOffset(DistanceUnit unit) { return (float) unit.fromMm(yOffsetMm); }
    public Pose2D getPosition() { return new Pose2D(DistanceUnit.MM, odometry.x, odometry.y, AngleUnit.RADIANS, odometry.h); }

    public Quaternion getQuaternion() {
        double h = odometry.h / 2;
        return new Quaternion((float) Math.cos(h), 0, 0, (float) Math.sin(h), System.nanoTime());
    }

    public double getPitch(AngleUnit unit) { return 0; }
    public double getRoll(AngleUnit unit) { return 0; }
}
