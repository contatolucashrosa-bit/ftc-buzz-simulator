// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.opencv.core;

public class Point {
    public double x;
    public double y;

    public Point() {}
    public Point(double x, double y) { this.x = x; this.y = y; }

    @Override public String toString() { return "{" + x + ", " + y + "}"; }
}
