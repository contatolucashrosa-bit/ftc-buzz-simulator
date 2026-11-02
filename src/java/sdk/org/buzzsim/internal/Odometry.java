// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.buzzsim.internal;

/**
 * Odometria ideal (sem ruído) do robô simulado, usada por Pinpoint, OTOS e OctoQuad.
 * Coordenadas como nos sensores reais: X para a frente do robô no instante do reset, Y para a esquerda, mm e rad.
 */
public final class Odometry {
    private final String name;
    private double trueX0, trueY0, trueH0;
    private double setX, setY, setH;
    public double x, y, h, vx, vy, vh;

    public Odometry(String name) {
        this.name = name;
        reset();
    }

    /** Zera a posição (como resetPosAndIMU / resetTracking). */
    public void reset() {
        setPose(0, 0, 0);
    }

    /** Define a pose atual (mm, mm, rad). */
    public void setPose(double px, double py, double ph) {
        trueX0 = Hw.get(name, "x");
        trueY0 = Hw.get(name, "y");
        trueH0 = Hw.get(name, "h");
        setX = px;
        setY = py;
        setH = ph;
        update();
    }

    /** Lê a pose verdadeira do simulador e converte para o referencial do sensor. */
    public void update() {
        double dx = Hw.get(name, "x") - trueX0;
        double dy = Hw.get(name, "y") - trueY0;
        double rot = setH - trueH0;
        double c = Math.cos(rot);
        double s = Math.sin(rot);
        x = setX + dx * c - dy * s;
        y = setY + dx * s + dy * c;
        h = setH + (Hw.get(name, "h") - trueH0);
        h = Math.atan2(Math.sin(h), Math.cos(h));
        double tvx = Hw.get(name, "vx");
        double tvy = Hw.get(name, "vy");
        vx = tvx * c - tvy * s;
        vy = tvx * s + tvy * c;
        vh = Hw.get(name, "vh");
    }
}
