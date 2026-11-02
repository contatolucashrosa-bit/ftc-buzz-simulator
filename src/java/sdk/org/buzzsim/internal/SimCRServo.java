// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.buzzsim.internal;

import com.qualcomm.robotcore.hardware.CRServo;
import com.qualcomm.robotcore.hardware.ServoController;

public final class SimCRServo implements CRServo {
    private final String name;
    private Direction direction = Direction.FORWARD;
    private double power;

    public SimCRServo(String name) {
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
    @Override public void setDirection(Direction direction) { this.direction = direction; setPower(power); }
    @Override public Direction getDirection() { return direction; }

    @Override
    public void setPower(double power) {
        this.power = Math.max(-1, Math.min(1, power));
        Hw.set(name, "power", direction == Direction.FORWARD ? this.power : -this.power);
    }

    @Override public double getPower() { return power; }
}
