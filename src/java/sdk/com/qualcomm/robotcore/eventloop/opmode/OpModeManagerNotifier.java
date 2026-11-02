// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package com.qualcomm.robotcore.eventloop.opmode;

public interface OpModeManagerNotifier {
    interface Notifications {
        void onOpModePreInit(OpMode opMode);
        void onOpModePreStart(OpMode opMode);
        void onOpModePostStop(OpMode opMode);
    }

    OpMode registerListener(Notifications listener);
    void unregisterListener(Notifications listener);
}
