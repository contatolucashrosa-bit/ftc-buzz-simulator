// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.robotcore.external.navigation;

public class Pose2D {
    protected final DistanceUnit distanceUnit;
    protected final double x;
    protected final double y;
    protected final AngleUnit headingUnit;
    protected final double heading;

    public Pose2D(DistanceUnit distanceUnit, double x, double y, AngleUnit headingUnit, double heading) {
        this.distanceUnit = distanceUnit;
        this.x = x;
        this.y = y;
        this.headingUnit = headingUnit;
        this.heading = heading;
    }

    public double getX(DistanceUnit unit) { return unit.fromUnit(distanceUnit, x); }
    public double getY(DistanceUnit unit) { return unit.fromUnit(distanceUnit, y); }
    public double getHeading(AngleUnit unit) { return unit.fromUnit(headingUnit, heading); }

    @Override
    public String toString() {
        return String.format("(%.3f %.3f)%s  %.3f%s", x, y, distanceUnit, heading, headingUnit);
    }
}
