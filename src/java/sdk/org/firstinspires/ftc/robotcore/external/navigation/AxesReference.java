// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.robotcore.external.navigation;

public enum AxesReference {
    EXTRINSIC, INTRINSIC;

    public AxesReference reverse() { return this == EXTRINSIC ? INTRINSIC : EXTRINSIC; }
}
