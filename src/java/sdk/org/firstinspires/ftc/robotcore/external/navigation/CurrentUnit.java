// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.robotcore.external.navigation;

public enum CurrentUnit {
    AMPS, MILLIAMPS;

    public double toAmps(double current) { return this == AMPS ? current : current / 1000.0; }
    public double toMilliAmps(double current) { return this == MILLIAMPS ? current : current * 1000.0; }
    public double convert(double current, CurrentUnit unit) { return this == AMPS ? unit.toAmps(current) : unit.toMilliAmps(current); }
}
