// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.robotcore.internal.opmode;

public class OpModeMeta {
    public enum Flavor { AUTONOMOUS, TELEOP, UTILITY, SYSTEM }
    public enum Source { ANDROID_STUDIO, BLOCKLY, ONBOTJAVA, EXTERNAL_LIBRARY }

    public static final String DefaultGroup = "$$$$$$$";

    public final Flavor flavor;
    public final String group;
    public final String name;
    public final String systemOpModeBaseDisplayName;
    public final String autoTransition;
    public final Source source;
    public final String description;

    private OpModeMeta(Builder b) {
        flavor = b.flavor;
        group = b.group;
        name = b.name;
        systemOpModeBaseDisplayName = b.systemOpModeBaseDisplayName;
        autoTransition = b.autoTransition;
        source = b.source;
        description = b.description;
    }

    public static boolean nameIsLegalForOpMode(String name, boolean isSystem) { return name != null && !name.trim().isEmpty(); }
    public static boolean isSystemName(String name) { return false; }
    public String getDisplayName() { return name; }
    @Override public String toString() { return name; }

    public static class Builder {
        public Flavor flavor = Flavor.TELEOP;
        public String group = DefaultGroup;
        public String name = "";
        public String systemOpModeBaseDisplayName;
        public String autoTransition;
        public Source source = Source.ANDROID_STUDIO;
        public String description = "";

        public Builder() {}

        public Builder(OpModeMeta meta) {
            flavor = meta.flavor;
            group = meta.group;
            name = meta.name;
            systemOpModeBaseDisplayName = meta.systemOpModeBaseDisplayName;
            autoTransition = meta.autoTransition;
            source = meta.source;
            description = meta.description;
        }

        public Builder setFlavor(Flavor flavor) { this.flavor = flavor; return this; }
        public Builder setGroup(String group) { this.group = group; return this; }
        public Builder setName(String name) { this.name = name; return this; }
        public Builder setSystemOpModeBaseDisplayName(String name) { this.systemOpModeBaseDisplayName = name; return this; }
        public Builder setTransitionTarget(String target) { this.autoTransition = target; return this; }
        public Builder setSource(Source source) { this.source = source; return this; }
        public Builder setDescription(String description) { this.description = description; return this; }
        public OpModeMeta build() { return new OpModeMeta(this); }
        public static Builder wrap(OpModeMeta meta) { return new Builder(meta); }
    }
}
