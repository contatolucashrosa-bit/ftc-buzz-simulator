// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.buzzsim.internal;

import com.qualcomm.robotcore.hardware.Servo;
import com.qualcomm.robotcore.hardware.ServoController;

public final class SimServo implements Servo {
    private final String name;
    private Direction direction = Direction.FORWARD;
    private double position = Double.NaN;
    private double min = 0;
    private double max = 1;

    public SimServo(String name) {
        this.name = name;
    }

    @Override public Manufacturer getManufacturer() { return Manufacturer.Lynx; }
    @Override public String getDeviceName() { return name; }
    @Override public String getConnectionInfo() { return "Buzz Simulator; " + name; }
    @Override public int getVersion() { return 1; }
    @Override public void resetDeviceConfigurationForOpMode() {}
    @Override public void close() {}
    @Override public ServoController getController() { return null; }
    @Override public int getPortNumber() { return 0; }
    @Override public void setDirection(Direction direction) { this.direction = direction; }
    @Override public Direction getDirection() { return direction; }

    @Override
    public void setPosition(double position) {
        this.position = Math.max(0, Math.min(1, position));
        double scaled = min + this.position * (max - min);
        if (direction == Direction.REVERSE) scaled = 1 - scaled;
        Hw.set(name, "position", scaled);
    }

    @Override public double getPosition() { return Double.isNaN(position) ? 0 : position; }

    @Override
    public void scaleRange(double min, double max) {
        if (min < 0 || max > 1 || min >= max) throw new IllegalArgumentException("scaleRange: limites inválidos");
        this.min = min;
        this.max = max;
    }
}
