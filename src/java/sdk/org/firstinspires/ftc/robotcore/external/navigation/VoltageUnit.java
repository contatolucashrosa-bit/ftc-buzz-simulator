// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.robotcore.external.navigation;

public enum VoltageUnit {
    VOLTS, MILLIVOLTS;

    public double toVolts(double voltage) { return this == VOLTS ? voltage : voltage / 1000.0; }
    public double toMilliVolts(double voltage) { return this == MILLIVOLTS ? voltage : voltage * 1000.0; }
    public double convert(double voltage, VoltageUnit unit) { return this == VOLTS ? unit.toVolts(voltage) : unit.toMilliVolts(voltage); }
}
