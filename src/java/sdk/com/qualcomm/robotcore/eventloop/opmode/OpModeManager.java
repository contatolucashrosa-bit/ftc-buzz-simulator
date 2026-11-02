// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package com.qualcomm.robotcore.eventloop.opmode;

import org.firstinspires.ftc.robotcore.internal.opmode.OpModeMeta;

public interface OpModeManager {
    String DEFAULT_OP_MODE_NAME = "$Stop$Robot$";

    void register(String name, Class<? extends OpMode> opModeClass);
    void register(OpModeMeta meta, Class<? extends OpMode> opModeClass);
    void register(String name, OpMode opModeInstance);
    void register(OpModeMeta meta, OpMode opModeInstance);
}
