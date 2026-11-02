// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.buzzsim.internal;

import com.qualcomm.robotcore.hardware.DcMotorController;
import com.qualcomm.robotcore.hardware.DcMotorEx;
import com.qualcomm.robotcore.hardware.PIDCoefficients;
import com.qualcomm.robotcore.hardware.PIDFCoefficients;
import com.qualcomm.robotcore.hardware.configuration.typecontainers.MotorConfigurationType;
import org.firstinspires.ftc.robotcore.external.navigation.AngleUnit;
import org.firstinspires.ftc.robotcore.external.navigation.CurrentUnit;

/**
 * Motor simulado. O controle de RUN_TO_POSITION e RUN_USING_ENCODER roda no simulador
 * (como no Control Hub, independente do laço do OpMode). Aqui ficam direção e zero do encoder.
 */
public final class SimMotor implements DcMotorEx {
    private final String name;
    private Direction direction = Direction.FORWARD;
    private RunMode mode = RunMode.RUN_WITHOUT_ENCODER;
    private ZeroPowerBehavior zeroPower = ZeroPowerBehavior.BRAKE;
    private double power;
    private int targetPosition;
    private int tolerance = 5;
    private double encoderZero;
    private boolean enabled = true;
    private MotorConfigurationType type;
    private PIDFCoefficients velocityPidf = new PIDFCoefficients(10, 3, 0, 0);
    private PIDFCoefficients positionPidf = new PIDFCoefficients(10, 0, 0, 0);

    public SimMotor(String name) {
        this.name = name;
        type = new MotorConfigurationType(Hw.get(name, "ticksPerRev"), Hw.get(name, "maxRpm"), 1);
        encoderZero = 0;
        Hw.set(name, "brake", 1);
    }

    private double sign() {
        return direction == Direction.FORWARD ? 1 : -1;
    }

    private int modeCode() {
        switch (mode) {
            case RUN_USING_ENCODER: case RUN_USING_ENCODERS: return 1;
            case RUN_TO_POSITION: return 2;
            default: return 0;
        }
    }

    private void push() {
        Hw.set(name, "mode", modeCode());
        Hw.set(name, "target", encoderZero + sign() * targetPosition);
        Hw.set(name, "power", enabled ? sign() * power : 0);
    }

    public void internalStop() {
        power = 0;
        Hw.set(name, "mode", 0);
        Hw.set(name, "power", 0);
    }

    @Override public Manufacturer getManufacturer() { return Manufacturer.Lynx; }
    @Override public String getDeviceName() { return name; }
    @Override public String getConnectionInfo() { return "Buzz Simulator; " + name; }
    @Override public int getVersion() { return 1; }
    @Override public void resetDeviceConfigurationForOpMode() {}
    @Override public void close() { internalStop(); }

    @Override public void setDirection(Direction direction) { this.direction = direction; push(); }
    @Override public Direction getDirection() { return direction; }

    @Override
    public void setPower(double power) {
        this.power = Math.max(-1, Math.min(1, power));
        push();
    }

    @Override public double getPower() { return power; }
    @Override public MotorConfigurationType getMotorType() { return type; }
    @Override public void setMotorType(MotorConfigurationType motorType) { type = motorType; }
    @Override public DcMotorController getController() { return null; }
    @Override public int getPortNumber() { return 0; }

    @Override
    public void setZeroPowerBehavior(ZeroPowerBehavior behavior) {
        zeroPower = behavior;
        Hw.set(name, "brake", behavior == ZeroPowerBehavior.FLOAT ? 0 : 1);
    }

    @Override public ZeroPowerBehavior getZeroPowerBehavior() { return zeroPower; }
    @Override public void setPowerFloat() { setZeroPowerBehavior(ZeroPowerBehavior.FLOAT); setPower(0); }
    @Override public boolean getPowerFloat() { return zeroPower == ZeroPowerBehavior.FLOAT && power == 0; }
    @Override public void setTargetPosition(int position) { targetPosition = position; push(); }
    @Override public int getTargetPosition() { return targetPosition; }

    @Override
    public boolean isBusy() {
        return mode == RunMode.RUN_TO_POSITION && power != 0 && Math.abs(getCurrentPosition() - targetPosition) > tolerance;
    }

    @Override
    public int getCurrentPosition() {
        return (int) Math.round(sign() * (Hw.get(name, "position") - encoderZero));
    }

    @Override
    public void setMode(RunMode mode) {
        RunMode m = mode.migrate();
        if (m == RunMode.STOP_AND_RESET_ENCODER) {
            encoderZero = Hw.get(name, "position");
            power = 0;
            targetPosition = 0;
        }
        this.mode = m;
        push();
    }

    @Override public RunMode getMode() { return mode; }
    @Override public void setMotorEnable() { enabled = true; push(); }
    @Override public void setMotorDisable() { enabled = false; push(); }
    @Override public boolean isMotorEnabled() { return enabled; }

    @Override
    public void setVelocity(double ticksPerSecond) {
        Hw.set(name, "mode", 3);
        Hw.set(name, "velocity", sign() * ticksPerSecond);
        power = ticksPerSecond / Math.max(1, type.getAchieveableMaxTicksPerSecond());
    }

    @Override
    public void setVelocity(double angularRate, AngleUnit unit) {
        double revPerSec = unit.toRadians(angularRate) / (2 * Math.PI);
        setVelocity(revPerSec * type.getTicksPerRev());
    }

    @Override public double getVelocity() { return sign() * Hw.get(name, "velocity"); }

    @Override
    public double getVelocity(AngleUnit unit) {
        return unit.fromRadians(getVelocity() / type.getTicksPerRev() * 2 * Math.PI);
    }

    @Override public void setPIDCoefficients(RunMode mode, PIDCoefficients pid) { setPIDFCoefficients(mode, new PIDFCoefficients(pid)); }

    @Override
    public void setPIDFCoefficients(RunMode mode, PIDFCoefficients pidf) {
        if (mode == RunMode.RUN_TO_POSITION) positionPidf = new PIDFCoefficients(pidf);
        else velocityPidf = new PIDFCoefficients(pidf);
    }

    @Override public void setVelocityPIDFCoefficients(double p, double i, double d, double f) { velocityPidf = new PIDFCoefficients(p, i, d, f); }
    @Override public void setPositionPIDFCoefficients(double p) { positionPidf = new PIDFCoefficients(p, 0, 0, 0); }
    @Override public PIDCoefficients getPIDCoefficients(RunMode mode) { PIDFCoefficients c = getPIDFCoefficients(mode); return new PIDCoefficients(c.p, c.i, c.d); }
    @Override public PIDFCoefficients getPIDFCoefficients(RunMode mode) { return mode == RunMode.RUN_TO_POSITION ? positionPidf : velocityPidf; }
    @Override public void setTargetPositionTolerance(int tolerance) { this.tolerance = tolerance; Hw.set(name, "tolerance", tolerance); }
    @Override public int getTargetPositionTolerance() { return tolerance; }
    @Override public double getCurrent(CurrentUnit unit) { return unit.convert(Hw.get(name, "current"), CurrentUnit.AMPS); }
    @Override public double getCurrentAlert(CurrentUnit unit) { return unit.convert(10, CurrentUnit.AMPS); }
    @Override public void setCurrentAlert(double current, CurrentUnit unit) {}
    @Override public boolean isOverCurrent() { return false; }
}
