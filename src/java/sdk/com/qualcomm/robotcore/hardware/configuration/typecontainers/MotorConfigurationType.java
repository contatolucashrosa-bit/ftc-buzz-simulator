// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package com.qualcomm.robotcore.hardware.configuration.typecontainers;

/** Tipo de motor: valores do motor goBILDA 5203 312 RPM do robô simulado. */
public class MotorConfigurationType implements Cloneable {
    private double ticksPerRev;
    private double maxRPM;
    private double achieveableMaxRPMFraction = 0.85;
    private double gearing;

    public MotorConfigurationType(double ticksPerRev, double maxRPM, double gearing) {
        this.ticksPerRev = ticksPerRev;
        this.maxRPM = maxRPM;
        this.gearing = gearing;
    }

    public static MotorConfigurationType getUnspecifiedMotorType() {
        return new MotorConfigurationType(28, 6000, 1);
    }

    public double getTicksPerRev() { return ticksPerRev; }
    public void setTicksPerRev(double ticksPerRev) { this.ticksPerRev = ticksPerRev; }
    public double getMaxRPM() { return maxRPM; }
    public void setMaxRPM(double maxRPM) { this.maxRPM = maxRPM; }
    public double getGearing() { return gearing; }
    public void setGearing(double gearing) { this.gearing = gearing; }
    public double getAchieveableMaxRPMFraction() { return achieveableMaxRPMFraction; }
    public void setAchieveableMaxRPMFraction(double fraction) { this.achieveableMaxRPMFraction = fraction; }
    public double getAchieveableMaxTicksPerSecond() { return ticksPerRev * maxRPM * achieveableMaxRPMFraction / 60.0; }
    public int getAchieveableMaxTicksPerSecondRounded() { return (int) Math.round(getAchieveableMaxTicksPerSecond()); }
    public String getName() { return "goBILDA 5203"; }

    @Override
    public MotorConfigurationType clone() {
        MotorConfigurationType copy = new MotorConfigurationType(ticksPerRev, maxRPM, gearing);
        copy.achieveableMaxRPMFraction = achieveableMaxRPMFraction;
        return copy;
    }
}
