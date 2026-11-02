// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.robotcore.external.navigation;

public enum AngleUnit {
    DEGREES(0), RADIANS(1);

    public final byte bVal;
    public static final float Pif = (float) Math.PI;
    private static final double TAU = Math.PI * 2;

    AngleUnit(int b) {
        bVal = (byte) b;
    }

    public double fromDegrees(double degrees) { return this == RADIANS ? normalizeRadians(Math.toRadians(degrees)) : normalizeDegrees(degrees); }
    public float fromDegrees(float degrees) { return (float) fromDegrees((double) degrees); }
    public double fromRadians(double radians) { return this == RADIANS ? normalizeRadians(radians) : normalizeDegrees(Math.toDegrees(radians)); }
    public float fromRadians(float radians) { return (float) fromRadians((double) radians); }
    public double fromUnit(AngleUnit them, double theirs) { return them == DEGREES ? fromDegrees(theirs) : fromRadians(theirs); }
    public float fromUnit(AngleUnit them, float theirs) { return (float) fromUnit(them, (double) theirs); }
    public double toDegrees(double inOurUnits) { return this == DEGREES ? normalizeDegrees(inOurUnits) : normalizeDegrees(Math.toDegrees(inOurUnits)); }
    public float toDegrees(float inOurUnits) { return (float) toDegrees((double) inOurUnits); }
    public double toRadians(double inOurUnits) { return this == RADIANS ? normalizeRadians(inOurUnits) : normalizeRadians(Math.toRadians(inOurUnits)); }
    public float toRadians(float inOurUnits) { return (float) toRadians((double) inOurUnits); }
    public double normalize(double mine) { return this == RADIANS ? normalizeRadians(mine) : normalizeDegrees(mine); }
    public float normalize(float mine) { return (float) normalize((double) mine); }

    public static double normalizeDegrees(double degrees) {
        while (degrees >= 180.0) degrees -= 360.0;
        while (degrees < -180.0) degrees += 360.0;
        return degrees;
    }

    public static float normalizeDegrees(float degrees) { return (float) normalizeDegrees((double) degrees); }

    public static double normalizeRadians(double radians) {
        while (radians >= Math.PI) radians -= TAU;
        while (radians < -Math.PI) radians += TAU;
        return radians;
    }

    public static float normalizeRadians(float radians) { return (float) normalizeRadians((double) radians); }

    public UnnormalizedAngleUnit getUnnormalized() { return this == DEGREES ? UnnormalizedAngleUnit.DEGREES : UnnormalizedAngleUnit.RADIANS; }
}
