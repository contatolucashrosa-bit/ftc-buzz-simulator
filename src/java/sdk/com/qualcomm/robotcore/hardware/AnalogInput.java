// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package com.qualcomm.robotcore.hardware;

import org.buzzsim.internal.Hw;

/** Entrada analógica (ex.: encoder absoluto de servo). */
public class AnalogInput implements HardwareDevice {
    private final String name;

    public AnalogInput(String name) {
        this.name = name;
    }

    public double getVoltage() { return Hw.get(name, "volts"); }
    public double getMaxVoltage() { return 3.3; }
    @Override public Manufacturer getManufacturer() { return Manufacturer.Lynx; }
    @Override public String getDeviceName() { return "Analog Input " + name; }
    @Override public String getConnectionInfo() { return "Buzz Simulator; " + name; }
    @Override public int getVersion() { return 1; }
    @Override public void resetDeviceConfigurationForOpMode() {}
    @Override public void close() {}
}
