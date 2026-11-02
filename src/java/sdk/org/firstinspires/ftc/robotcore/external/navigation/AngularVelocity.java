// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.robotcore.external.navigation;

public class AngularVelocity {
    public UnnormalizedAngleUnit angleUnit;
    public float xRotationRate;
    public float yRotationRate;
    public float zRotationRate;
    public long acquisitionTime;

    public AngularVelocity() {
        this(UnnormalizedAngleUnit.DEGREES, 0, 0, 0, 0);
    }

    public AngularVelocity(UnnormalizedAngleUnit unit, float x, float y, float z, long acquisitionTime) {
        this.angleUnit = unit;
        this.xRotationRate = x;
        this.yRotationRate = y;
        this.zRotationRate = z;
        this.acquisitionTime = acquisitionTime;
    }

    public AngularVelocity(AngleUnit unit, float x, float y, float z, long acquisitionTime) {
        this(unit.getUnnormalized(), x, y, z, acquisitionTime);
    }

    public AngularVelocity toAngleUnit(AngleUnit unit) {
        UnnormalizedAngleUnit u = unit.getUnnormalized();
        return new AngularVelocity(u, u.fromUnit(angleUnit, xRotationRate), u.fromUnit(angleUnit, yRotationRate), u.fromUnit(angleUnit, zRotationRate), acquisitionTime);
    }

    @Override
    public String toString() {
        return String.format("{x=%.3f, y=%.3f, z=%.3f}", xRotationRate, yRotationRate, zRotationRate);
    }
}
