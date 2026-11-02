// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package com.qualcomm.robotcore.hardware;

public interface DigitalChannel extends HardwareDevice {
    enum Mode { INPUT, OUTPUT }

    Mode getMode();
    void setMode(Mode mode);
    boolean getState();
    void setState(boolean state);
}
