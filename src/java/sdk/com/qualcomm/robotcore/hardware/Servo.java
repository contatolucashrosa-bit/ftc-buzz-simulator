// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package com.qualcomm.robotcore.hardware;

public interface Servo extends HardwareDevice {
    enum Direction { FORWARD, REVERSE }

    double MIN_POSITION = 0.0;
    double MAX_POSITION = 1.0;

    ServoController getController();
    int getPortNumber();
    void setDirection(Direction direction);
    Direction getDirection();
    void setPosition(double position);
    double getPosition();
    void scaleRange(double min, double max);
}
