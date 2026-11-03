// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.robotcore.external.navigation;

public class Pose3D {
    private final Position position;
    private final YawPitchRollAngles orientation;

    public Pose3D(Position position, YawPitchRollAngles orientation) {
        this.position = position;
        this.orientation = orientation;
    }

    public Position getPosition() { return position; }
    public YawPitchRollAngles getOrientation() { return orientation; }

    @Override public String toString() { return "position=" + position + " orientation=" + orientation; }
}
