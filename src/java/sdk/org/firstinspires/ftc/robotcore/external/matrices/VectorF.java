// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.robotcore.external.matrices;

public class VectorF {
    protected final float[] data;

    public VectorF(float[] data) { this.data = data; }
    public VectorF(float x) { this(new float[] {x}); }
    public VectorF(float x, float y) { this(new float[] {x, y}); }
    public VectorF(float x, float y, float z) { this(new float[] {x, y, z}); }
    public VectorF(float x, float y, float z, float w) { this(new float[] {x, y, z, w}); }

    public static VectorF length(int length) { return new VectorF(new float[length]); }
    public float[] getData() { return data; }
    public int length() { return data.length; }
    public float get(int index) { return data[index]; }
    public void put(int index, float value) { data[index] = value; }
    public float magnitude() {
        double sum = 0;
        for (float v : data) sum += v * v;
        return (float) Math.sqrt(sum);
    }
    public VectorF multiplied(float scale) {
        float[] out = new float[data.length];
        for (int i = 0; i < data.length; i++) out[i] = data[i] * scale;
        return new VectorF(out);
    }
    public VectorF added(VectorF him) {
        float[] out = new float[data.length];
        for (int i = 0; i < data.length; i++) out[i] = data[i] + him.data[i];
        return new VectorF(out);
    }
    public VectorF subtracted(VectorF him) { return added(him.multiplied(-1)); }
    public float dotProduct(VectorF him) {
        float sum = 0;
        for (int i = 0; i < data.length; i++) sum += data[i] * him.data[i];
        return sum;
    }

    @Override public String toString() {
        StringBuilder sb = new StringBuilder("{");
        for (int i = 0; i < data.length; i++) sb.append(i == 0 ? "" : " ").append(String.format("%.2f", data[i]));
        return sb.append("}").toString();
    }
}
