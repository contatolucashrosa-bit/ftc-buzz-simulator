// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.buzzsim.internal;

import com.qualcomm.robotcore.hardware.DigitalChannel;
import com.qualcomm.robotcore.hardware.DistanceSensor;
import com.qualcomm.robotcore.hardware.HardwareDevice;
import com.qualcomm.robotcore.hardware.TouchSensor;
import com.qualcomm.robotcore.hardware.VoltageSensor;
import org.firstinspires.ftc.robotcore.external.navigation.DistanceUnit;

/** Sensores simples. */
public final class SimDevices {
    private SimDevices() {}

    abstract static class Base implements HardwareDevice {
        final String name;

        Base(String name) {
            this.name = name;
        }

        @Override public Manufacturer getManufacturer() { return Manufacturer.Lynx; }
        @Override public String getDeviceName() { return name; }
        @Override public String getConnectionInfo() { return "Buzz Simulator"; }
        @Override public int getVersion() { return 1; }
        @Override public void resetDeviceConfigurationForOpMode() {}
        @Override public void close() {}
    }

    private static VoltageSensor voltage;

    public static VoltageSensor voltage() {
        if (voltage == null) {
            voltage = new VoltageSensor() {
                @Override public double getVoltage() { return Hw.get("battery", "volts"); }
                @Override public Manufacturer getManufacturer() { return Manufacturer.Lynx; }
                @Override public String getDeviceName() { return "Control Hub"; }
                @Override public String getConnectionInfo() { return "Buzz Simulator"; }
                @Override public int getVersion() { return 1; }
                @Override public void resetDeviceConfigurationForOpMode() {}
                @Override public void close() {}
            };
        }
        return voltage;
    }

    public static DistanceSensor distance(String name) {
        class Distance extends Base implements DistanceSensor {
            Distance(String deviceName) { super(deviceName); }
            @Override public double getDistance(DistanceUnit unit) { return unit.fromMm(Hw.get(this.name, "mm")); }
        }
        return new Distance(name);
    }

    public static TouchSensor touch(String name) {
        class Touch extends Base implements TouchSensor {
            Touch(String deviceName) { super(deviceName); }
            @Override public double getValue() { return Hw.get(this.name, "pressed"); }
            @Override public boolean isPressed() { return Hw.get(this.name, "pressed") > 0.5; }
        }
        return new Touch(name);
    }

    public static DigitalChannel digital(String name) {
        class Digital extends Base implements DigitalChannel {
            Mode mode = Mode.INPUT;
            Digital(String deviceName) { super(deviceName); }
            @Override public Mode getMode() { return mode; }
            @Override public void setMode(Mode mode) { this.mode = mode; }
            // Como no REV Touch Sensor: true = solto, false = pressionado.
            @Override public boolean getState() { return Hw.get(this.name, "pressed") < 0.5; }
            @Override public void setState(boolean state) {}
        }
        return new Digital(name);
    }
}
