// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.buzzsim.internal;

import org.firstinspires.ftc.robotcore.external.hardware.camera.WebcamName;

/** Todo robô simulado tem uma câmera; qualquer nome configurado no código ("Webcam 1"...) aponta para ela. */
public class SimWebcam implements WebcamName {
    private final String name;

    public SimWebcam(String name) {
        this.name = name;
    }

    @Override public boolean isWebcam() { return true; }
    @Override public boolean isCameraDirection() { return false; }
    @Override public boolean isSwitchable() { return false; }
    @Override public boolean isUnknown() { return false; }
    @Override public boolean isAttached() { return true; }
    @Override public Manufacturer getManufacturer() { return Manufacturer.Other; }
    @Override public String getDeviceName() { return name; }
    @Override public String getConnectionInfo() { return "Buzz Simulator"; }
    @Override public int getVersion() { return 1; }
    @Override public void resetDeviceConfigurationForOpMode() {}
    @Override public void close() {}
}
