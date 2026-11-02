// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.robotcore.external.navigation;

public class YawPitchRollAngles {
    private final double yawDeg;
    private final double pitchDeg;
    private final double rollDeg;
    private final long acquisitionTime;

    public YawPitchRollAngles(AngleUnit angleUnit, double yaw, double pitch, double roll, long acquisitionTime) {
        this.yawDeg = angleUnit.toDegrees(yaw);
        this.pitchDeg = angleUnit.toDegrees(pitch);
        this.rollDeg = angleUnit.toDegrees(roll);
        this.acquisitionTime = acquisitionTime;
    }

    public double getYaw() { return yawDeg; }
    public double getYaw(AngleUnit unit) { return unit.fromDegrees(yawDeg); }
    public double getPitch() { return pitchDeg; }
    public double getPitch(AngleUnit unit) { return unit.fromDegrees(pitchDeg); }
    public double getRoll() { return rollDeg; }
    public double getRoll(AngleUnit unit) { return unit.fromDegrees(rollDeg); }
    public long getAcquisitionTime() { return acquisitionTime; }

    @Override
    public String toString() {
        return String.format("{yaw=%.3f, pitch=%.3f, roll=%.3f}", yawDeg, pitchDeg, rollDeg);
    }
}
