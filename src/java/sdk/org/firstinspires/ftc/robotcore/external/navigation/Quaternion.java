// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.robotcore.external.navigation;

public class Quaternion {
    public float w;
    public float x;
    public float y;
    public float z;
    public long acquisitionTime;

    public Quaternion() {
        this(1, 0, 0, 0, 0);
    }

    public Quaternion(float w, float x, float y, float z, long acquisitionTime) {
        this.w = w;
        this.x = x;
        this.y = y;
        this.z = z;
        this.acquisitionTime = acquisitionTime;
    }

    public static Quaternion identityQuaternion() {
        return new Quaternion(1, 0, 0, 0, 0);
    }

    public float magnitude() { return (float) Math.sqrt(w * w + x * x + y * y + z * z); }

    public Quaternion normalized() {
        float m = magnitude();
        return new Quaternion(w / m, x / m, y / m, z / m, acquisitionTime);
    }

    public Quaternion congugate() { return new Quaternion(w, -x, -y, -z, acquisitionTime); }
    public Quaternion inverse() { return normalized().congugate(); }

    public Quaternion multiply(Quaternion q, long acquisitionTime) {
        return new Quaternion(
            w * q.w - x * q.x - y * q.y - z * q.z,
            w * q.x + x * q.w + y * q.z - z * q.y,
            w * q.y - x * q.z + y * q.w + z * q.x,
            w * q.z + x * q.y - y * q.x + z * q.w,
            acquisitionTime);
    }

    @Override
    public String toString() {
        return String.format("{w=%.3f, x=%.3f, y=%.3f, z=%.3f}", w, x, y, z);
    }
}
