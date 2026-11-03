// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.vision.apriltag;

import org.firstinspires.ftc.robotcore.external.matrices.VectorF;
import org.firstinspires.ftc.robotcore.external.navigation.DistanceUnit;
import org.firstinspires.ftc.robotcore.external.navigation.Quaternion;

public class AprilTagMetadata {
    public final int id;
    public final double tagsize;
    public final String name;
    public final DistanceUnit distanceUnit;
    public final VectorF fieldPosition;
    public final Quaternion fieldOrientation;

    public AprilTagMetadata(int id, String name, double tagsize, VectorF fieldPosition, DistanceUnit distanceUnit, Quaternion fieldOrientation) {
        this.id = id;
        this.name = name;
        this.tagsize = tagsize;
        this.fieldPosition = fieldPosition;
        this.distanceUnit = distanceUnit;
        this.fieldOrientation = fieldOrientation;
    }

    public AprilTagMetadata(int id, String name, double tagsize, DistanceUnit distanceUnit) {
        this(id, name, tagsize, new VectorF(0, 0, 0), distanceUnit, new Quaternion());
    }
}
