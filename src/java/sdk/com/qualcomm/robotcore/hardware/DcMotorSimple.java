// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package com.qualcomm.robotcore.hardware;

public interface DcMotorSimple extends HardwareDevice {
    enum Direction {
        FORWARD, REVERSE;

        public Direction inverted() {
            return this == FORWARD ? REVERSE : FORWARD;
        }
    }

    void setDirection(Direction direction);
    Direction getDirection();
    void setPower(double power);
    double getPower();
}
