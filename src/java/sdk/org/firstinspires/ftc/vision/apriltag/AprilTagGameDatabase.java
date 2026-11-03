// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.vision.apriltag;

import org.buzzsim.internal.Hw;
import org.firstinspires.ftc.robotcore.external.matrices.VectorF;
import org.firstinspires.ftc.robotcore.external.navigation.DistanceUnit;
import org.firstinspires.ftc.robotcore.external.navigation.Quaternion;

/** Tags do BIOBUZZ (§9.9): IDs 30–45 sob as CELLS das HIVEs, 3,25 pol; posições do simulador com as HIVEs na largada. */
public class AprilTagGameDatabase {
    private AprilTagGameDatabase() {}

    private static final String[] CELLS = {"Red HIVE rear", "Red HIVE audience", "Blue HIVE audience", "Blue HIVE rear"};

    public static AprilTagLibrary getCurrentGameTagLibrary() {
        return new AprilTagLibrary.Builder().addTags(getSampleTagLibrary()).addTags(getBioBuzzTagLibrary()).build();
    }

    public static AprilTagLibrary getBioBuzzTagLibrary() {
        AprilTagLibrary.Builder builder = new AprilTagLibrary.Builder();
        String all = Hw.tagLibrary();
        if (all == null || all.isEmpty()) return builder.build();
        for (String row : all.split(";")) {
            String[] v = row.split(",");
            int id = Integer.parseInt(v[0]);
            String name = CELLS[Math.min(3, (id - 30) / 4)] + " " + ((id - 30) % 4 + 1);
            VectorF position = new VectorF(Float.parseFloat(v[1]), Float.parseFloat(v[2]), Float.parseFloat(v[3]));
            builder.addTag(id, name, 3.25, position, DistanceUnit.INCH, new Quaternion());
        }
        return builder.build();
    }

    /** Tags 583–587 das amostras do SDK: nenhuma está no campo, mas o código que as procura continua compilando. */
    public static AprilTagLibrary getSampleTagLibrary() {
        return new AprilTagLibrary.Builder()
                .addTag(583, "Nemo", 4, DistanceUnit.INCH)
                .addTag(584, "Jonah", 4, DistanceUnit.INCH)
                .addTag(585, "Cousteau", 6, DistanceUnit.INCH)
                .addTag(586, "Ariel", 6, DistanceUnit.INCH)
                .addTag(587, "Ursula", 6, DistanceUnit.INCH)
                .build();
    }
}
