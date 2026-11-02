// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.robotcore.external.navigation;

public class Orientation {
    public enum AngleSet { THEONE, THEOTHER }

    public AxesReference axesReference;
    public AxesOrder axesOrder;
    public AngleUnit angleUnit;
    public float firstAngle;
    public float secondAngle;
    public float thirdAngle;
    public long acquisitionTime;

    public Orientation() {
        this(AxesReference.EXTRINSIC, AxesOrder.XYZ, AngleUnit.RADIANS, 0, 0, 0, 0);
    }

    public Orientation(AxesReference reference, AxesOrder order, AngleUnit unit, float first, float second, float third, long acquisitionTime) {
        this.axesReference = reference;
        this.axesOrder = order;
        this.angleUnit = unit;
        this.firstAngle = first;
        this.secondAngle = second;
        this.thirdAngle = third;
        this.acquisitionTime = acquisitionTime;
    }

    public Orientation toAngleUnit(AngleUnit unit) {
        return new Orientation(axesReference, axesOrder, unit, unit.fromUnit(angleUnit, firstAngle), unit.fromUnit(angleUnit, secondAngle), unit.fromUnit(angleUnit, thirdAngle), acquisitionTime);
    }

    /** O robô simulado só gira em Z, então trocar a referência equivale a inverter a ordem. */
    public Orientation toAxesReference(AxesReference reference) {
        if (reference == axesReference) return this;
        return new Orientation(reference, axesOrder.reverse(), angleUnit, thirdAngle, secondAngle, firstAngle, acquisitionTime);
    }

    public Orientation toAxesOrder(AxesOrder order) {
        float[] byAxis = new float[3];
        int[] idx = axesOrder.indices();
        byAxis[idx[0]] = firstAngle;
        byAxis[idx[1]] = secondAngle;
        byAxis[idx[2]] = thirdAngle;
        int[] out = order.indices();
        return new Orientation(axesReference, order, angleUnit, byAxis[out[0]], byAxis[out[1]], byAxis[out[2]], acquisitionTime);
    }

    @Override
    public String toString() {
        return String.format("{%s %s %.3f %.3f %.3f}", axesReference, axesOrder, firstAngle, secondAngle, thirdAngle);
    }
}
