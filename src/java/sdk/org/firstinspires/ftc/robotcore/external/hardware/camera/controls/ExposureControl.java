// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.robotcore.external.hardware.camera.controls;

import java.util.concurrent.TimeUnit;

/** A câmera simulada não tem borrão nem ruído: exposição e ganho são aceitos e guardados, sem efeito na detecção. */
public interface ExposureControl extends CameraControl {
    enum Mode { Unknown, Auto, Manual, ShutterPriority, AperturePriority, ContinuousAuto }

    Mode getMode();
    boolean setMode(Mode mode);
    boolean isModeSupported(Mode mode);
    long getMinExposure(TimeUnit resultUnit);
    long getMaxExposure(TimeUnit resultUnit);
    long getExposure(TimeUnit resultUnit);
    boolean setExposure(long duration, TimeUnit durationUnit);
    boolean isExposureSupported();
    boolean getAePriority();
    boolean setAePriority(boolean priority);
}
