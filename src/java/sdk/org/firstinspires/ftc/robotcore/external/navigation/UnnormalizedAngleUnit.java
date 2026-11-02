// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.robotcore.external.navigation;

public enum UnnormalizedAngleUnit {
    DEGREES(0), RADIANS(1);

    public final byte bVal;

    UnnormalizedAngleUnit(int b) {
        bVal = (byte) b;
    }

    public double fromDegrees(double degrees) { return this == RADIANS ? Math.toRadians(degrees) : degrees; }
    public float fromDegrees(float degrees) { return (float) fromDegrees((double) degrees); }
    public double fromRadians(double radians) { return this == RADIANS ? radians : Math.toDegrees(radians); }
    public float fromRadians(float radians) { return (float) fromRadians((double) radians); }
    public double fromUnit(UnnormalizedAngleUnit them, double theirs) { return them == DEGREES ? fromDegrees(theirs) : fromRadians(theirs); }
    public float fromUnit(UnnormalizedAngleUnit them, float theirs) { return (float) fromUnit(them, (double) theirs); }
    public double fromUnit(AngleUnit them, double theirs) { return them == AngleUnit.DEGREES ? fromDegrees(theirs) : fromRadians(theirs); }
    public float fromUnit(AngleUnit them, float theirs) { return (float) fromUnit(them, (double) theirs); }
    public double toDegrees(double inOurUnits) { return this == DEGREES ? inOurUnits : Math.toDegrees(inOurUnits); }
    public float toDegrees(float inOurUnits) { return (float) toDegrees((double) inOurUnits); }
    public double toRadians(double inOurUnits) { return this == RADIANS ? inOurUnits : Math.toRadians(inOurUnits); }
    public float toRadians(float inOurUnits) { return (float) toRadians((double) inOurUnits); }
    public AngleUnit getNormalized() { return this == DEGREES ? AngleUnit.DEGREES : AngleUnit.RADIANS; }
}
