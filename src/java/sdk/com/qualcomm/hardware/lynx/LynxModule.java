// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package com.qualcomm.hardware.lynx;

import com.qualcomm.robotcore.hardware.HardwareDevice;
import org.buzzsim.internal.Hw;
import org.firstinspires.ftc.robotcore.external.navigation.CurrentUnit;
import org.firstinspires.ftc.robotcore.external.navigation.VoltageUnit;

/** Control Hub simulado: aceita o modo de leitura em lote (bulk caching), que aqui não muda nada. */
public class LynxModule implements HardwareDevice {
    public enum BulkCachingMode { OFF, MANUAL, AUTO }

    private BulkCachingMode mode = BulkCachingMode.OFF;

    public LynxModule() {}

    @Override public Manufacturer getManufacturer() { return Manufacturer.Lynx; }
    @Override public String getDeviceName() { return "REV Control Hub (simulado)"; }
    @Override public String getConnectionInfo() { return "Buzz Simulator"; }
    @Override public int getVersion() { return 1; }
    @Override public void resetDeviceConfigurationForOpMode() {}
    @Override public void close() {}
    public BulkCachingMode getBulkCachingMode() { return mode; }
    public void setBulkCachingMode(BulkCachingMode mode) { this.mode = mode; }
    public void clearBulkCache() {}
    public boolean isParent() { return true; }
    public int getModuleAddress() { return 173; }
    // O RoadRunner exige firmware 1.8.2 ou mais novo.
    public String getFirmwareVersionString() { return "HW: 20, Maj: 1, Min: 8, Eng: 2"; }
    public String getNullableFirmwareVersionString() { return getFirmwareVersionString(); }
    public double getInputVoltage(VoltageUnit unit) { return unit.convert(Hw.get("battery", "volts"), VoltageUnit.VOLTS); }
    public double getCurrent(CurrentUnit unit) { return 0; }
    public void setConstant(int color) {}
}
