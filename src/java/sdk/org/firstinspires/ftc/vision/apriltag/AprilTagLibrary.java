// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.vision.apriltag;

import java.util.ArrayList;
import java.util.List;
import org.firstinspires.ftc.robotcore.external.matrices.VectorF;
import org.firstinspires.ftc.robotcore.external.navigation.DistanceUnit;
import org.firstinspires.ftc.robotcore.external.navigation.Quaternion;

public class AprilTagLibrary {
    private final AprilTagMetadata[] data;

    private AprilTagLibrary(AprilTagMetadata[] data) {
        this.data = data;
    }

    public AprilTagMetadata[] getAllTags() {
        return data;
    }

    public AprilTagMetadata lookupTag(int id) {
        for (AprilTagMetadata tag : data) if (tag.id == id) return tag;
        return null;
    }

    public static class Builder {
        private final List<AprilTagMetadata> data = new ArrayList<>();
        private boolean allowOverwrite = false;

        public Builder setAllowOverwrite(boolean allowOverwrite) {
            this.allowOverwrite = allowOverwrite;
            return this;
        }

        public Builder addTag(AprilTagMetadata tag) {
            for (int i = 0; i < data.size(); i++) {
                if (data.get(i).id != tag.id) continue;
                if (!allowOverwrite) throw new RuntimeException("You attempted to add a tag to the library when it already contains a tag with that ID!");
                data.set(i, tag);
                return this;
            }
            data.add(tag);
            return this;
        }

        public Builder addTag(int id, String name, double size, VectorF fieldPosition, DistanceUnit distanceUnit, Quaternion fieldOrientation) {
            return addTag(new AprilTagMetadata(id, name, size, fieldPosition, distanceUnit, fieldOrientation));
        }

        public Builder addTag(int id, String name, double size, DistanceUnit distanceUnit) {
            return addTag(new AprilTagMetadata(id, name, size, distanceUnit));
        }

        public Builder addTags(AprilTagLibrary library) {
            for (AprilTagMetadata tag : library.getAllTags()) addTag(tag);
            return this;
        }

        public AprilTagLibrary build() {
            return new AprilTagLibrary(data.toArray(new AprilTagMetadata[0]));
        }
    }
}
