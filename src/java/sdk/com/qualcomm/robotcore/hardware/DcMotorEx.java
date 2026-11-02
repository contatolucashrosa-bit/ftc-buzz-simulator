// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package com.qualcomm.robotcore.hardware;

import org.firstinspires.ftc.robotcore.external.navigation.AngleUnit;
import org.firstinspires.ftc.robotcore.external.navigation.CurrentUnit;

public interface DcMotorEx extends DcMotor {
    void setMotorEnable();
    void setMotorDisable();
    boolean isMotorEnabled();
    void setVelocity(double angularRate);
    void setVelocity(double angularRate, AngleUnit unit);
    double getVelocity();
    double getVelocity(AngleUnit unit);
    @Deprecated void setPIDCoefficients(RunMode mode, PIDCoefficients pidCoefficients);
    void setPIDFCoefficients(RunMode mode, PIDFCoefficients pidfCoefficients) throws UnsupportedOperationException;
    void setVelocityPIDFCoefficients(double p, double i, double d, double f);
    void setPositionPIDFCoefficients(double p);
    @Deprecated PIDCoefficients getPIDCoefficients(RunMode mode);
    PIDFCoefficients getPIDFCoefficients(RunMode mode);
    void setTargetPositionTolerance(int tolerance);
    int getTargetPositionTolerance();
    double getCurrent(CurrentUnit unit);
    double getCurrentAlert(CurrentUnit unit);
    void setCurrentAlert(double current, CurrentUnit unit);
    boolean isOverCurrent();
}
