// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package com.qualcomm.robotcore.hardware;

public class PIDCoefficients {
    public double p;
    public double i;
    public double d;

    public PIDCoefficients() {}

    public PIDCoefficients(double p, double i, double d) {
        this.p = p;
        this.i = i;
        this.d = d;
    }

    @Override
    public String toString() {
        return "p=" + p + " i=" + i + " d=" + d;
    }
}
