// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.vision.apriltag;

public class AprilTagPoseFtc {
    public final double x;
    public final double y;
    public final double z;
    public final double yaw;
    public final double pitch;
    public final double roll;
    public final double range;
    public final double bearing;
    public final double elevation;

    public AprilTagPoseFtc(double x, double y, double z, double yaw, double pitch, double roll, double range, double bearing, double elevation) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.yaw = yaw;
        this.pitch = pitch;
        this.roll = roll;
        this.range = range;
        this.bearing = bearing;
        this.elevation = elevation;
    }
}
