// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.robotcore.external.navigation;

public enum DistanceUnit {
    METER(0), CM(1), MM(2), INCH(3);

    public final byte bVal;
    public static final double infinity = Double.MAX_VALUE;
    public static final double mmPerInch = 25.4;
    public static final double mPerInch = mmPerInch * 0.001;

    DistanceUnit(int b) {
        bVal = (byte) b;
    }

    private double mmPerUnit() {
        switch (this) {
            case METER: return 1000.0;
            case CM: return 10.0;
            case MM: return 1.0;
            default: return mmPerInch;
        }
    }

    public double fromMeters(double meters) { return meters == infinity ? infinity : meters * 1000.0 / mmPerUnit(); }
    public double fromInches(double inches) { return inches == infinity ? infinity : inches * mmPerInch / mmPerUnit(); }
    public double fromCm(double cm) { return cm == infinity ? infinity : cm * 10.0 / mmPerUnit(); }
    public double fromMm(double mm) { return mm == infinity ? infinity : mm / mmPerUnit(); }
    public double fromUnit(DistanceUnit him, double his) { return his == infinity ? infinity : his * him.mmPerUnit() / mmPerUnit(); }
    public double toMeters(double inOurUnits) { return inOurUnits == infinity ? infinity : inOurUnits * mmPerUnit() / 1000.0; }
    public double toInches(double inOurUnits) { return inOurUnits == infinity ? infinity : inOurUnits * mmPerUnit() / mmPerInch; }
    public double toCm(double inOurUnits) { return inOurUnits == infinity ? infinity : inOurUnits * mmPerUnit() / 10.0; }
    public double toMm(double inOurUnits) { return inOurUnits == infinity ? infinity : inOurUnits * mmPerUnit(); }
    public String toString(double inOurUnits) { return String.format("%.3f%s", inOurUnits, toString()); }

    @Override
    public String toString() {
        switch (this) {
            case METER: return "m";
            case CM: return "cm";
            case MM: return "mm";
            default: return "in";
        }
    }
}
