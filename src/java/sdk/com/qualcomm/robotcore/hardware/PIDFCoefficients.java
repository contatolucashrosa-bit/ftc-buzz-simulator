// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package com.qualcomm.robotcore.hardware;

public class PIDFCoefficients {
    public double p;
    public double i;
    public double d;
    public double f;
    public MotorControlAlgorithm algorithm = MotorControlAlgorithm.PIDF;

    public PIDFCoefficients() {}

    public PIDFCoefficients(double p, double i, double d, double f, MotorControlAlgorithm algorithm) {
        this(p, i, d, f);
        this.algorithm = algorithm;
    }

    public PIDFCoefficients(double p, double i, double d, double f) {
        this.p = p;
        this.i = i;
        this.d = d;
        this.f = f;
    }

    public PIDFCoefficients(PIDFCoefficients other) {
        this(other.p, other.i, other.d, other.f, other.algorithm);
    }

    public PIDFCoefficients(PIDCoefficients other) {
        this(other.p, other.i, other.d, 0);
    }

    @Override
    public String toString() {
        return "p=" + p + " i=" + i + " d=" + d + " f=" + f + " alg=" + algorithm;
    }
}
