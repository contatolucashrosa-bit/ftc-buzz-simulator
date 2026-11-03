// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.vision.apriltag;

/** Pose "crua" do detector (referencial do OpenCV: x direita, y para baixo, z para a frente), sem a matriz de rotação. */
public class AprilTagPoseRaw {
    public final double x;
    public final double y;
    public final double z;

    public AprilTagPoseRaw(double x, double y, double z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}
