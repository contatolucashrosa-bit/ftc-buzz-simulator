// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.buzzsim.internal;

import com.qualcomm.robotcore.hardware.IMU;
import org.firstinspires.ftc.robotcore.external.navigation.AngleUnit;
import org.firstinspires.ftc.robotcore.external.navigation.AngularVelocity;
import org.firstinspires.ftc.robotcore.external.navigation.AxesOrder;
import org.firstinspires.ftc.robotcore.external.navigation.AxesReference;
import org.firstinspires.ftc.robotcore.external.navigation.Orientation;
import org.firstinspires.ftc.robotcore.external.navigation.Quaternion;
import org.firstinspires.ftc.robotcore.external.navigation.YawPitchRollAngles;

/** IMU do Control Hub: o robô simulado só gira no plano (pitch e roll = 0). */
public final class SimImu implements IMU {
    private final String name;
    private double yawZero;

    public SimImu(String name) {
        this.name = name;
    }

    private double yawRad() {
        return AngleUnit.normalizeRadians(Hw.get(name, "yaw") - yawZero);
    }

    @Override public Manufacturer getManufacturer() { return Manufacturer.Lynx; }
    @Override public String getDeviceName() { return "IMU " + name; }
    @Override public String getConnectionInfo() { return "Buzz Simulator; " + name; }
    @Override public int getVersion() { return 1; }
    @Override public void resetDeviceConfigurationForOpMode() {}
    @Override public void close() {}
    @Override public boolean initialize(Parameters parameters) { return true; }
    @Override public void resetYaw() { yawZero = Hw.get(name, "yaw"); }

    @Override
    public YawPitchRollAngles getRobotYawPitchRollAngles() {
        return new YawPitchRollAngles(AngleUnit.RADIANS, yawRad(), 0, 0, System.nanoTime());
    }

    @Override
    public Orientation getRobotOrientation(AxesReference reference, AxesOrder order, AngleUnit unit) {
        float yaw = (float) unit.fromRadians(yawRad());
        int[] idx = order.indices();
        float[] angles = new float[3];
        for (int k = 0; k < 3; k++) if (idx[k] == 2) angles[k] = yaw;
        return new Orientation(reference, order, unit, angles[0], angles[1], angles[2], System.nanoTime());
    }

    @Override
    public Quaternion getRobotOrientationAsQuaternion() {
        double h = yawRad() / 2;
        return new Quaternion((float) Math.cos(h), 0, 0, (float) Math.sin(h), System.nanoTime());
    }

    @Override
    public AngularVelocity getRobotAngularVelocity(AngleUnit unit) {
        return new AngularVelocity(unit.getUnnormalized(), 0, 0, (float) unit.fromRadians(Hw.get(name, "yawRate")), System.nanoTime());
    }
}
