// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package com.qualcomm.robotcore.util;

import java.util.concurrent.TimeUnit;
import org.buzzsim.internal.Hw;

/** Cronômetro no tempo de simulação (para quando o jogo pausa). */
public class ElapsedTime {
    public enum Resolution { SECONDS, MILLISECONDS }

    public static final long SECOND_IN_NANO = 1000000000L;
    public static final long MILLIS_IN_NANO = 1000000L;

    private long startNanos;
    private final Resolution resolution;

    public ElapsedTime() {
        this(Resolution.SECONDS);
    }

    public ElapsedTime(long startTime) {
        this.resolution = Resolution.SECONDS;
        this.startNanos = startTime;
    }

    public ElapsedTime(Resolution resolution) {
        this.resolution = resolution;
        reset();
    }

    private static long nowNanos() {
        return (long) (Hw.time() * SECOND_IN_NANO);
    }

    public long now(TimeUnit unit) { return unit.convert(nowNanos(), TimeUnit.NANOSECONDS); }
    public void reset() { startNanos = nowNanos(); }
    public double startTime() { return resolution == Resolution.SECONDS ? startNanos / (double) SECOND_IN_NANO : startNanos / (double) MILLIS_IN_NANO; }
    public long startTimeNanoseconds() { return startNanos; }
    public double time() { return resolution == Resolution.SECONDS ? seconds() : milliseconds(); }
    public long time(TimeUnit unit) { return unit.convert(nanoseconds(), TimeUnit.NANOSECONDS); }
    public double seconds() { return nanoseconds() / (double) SECOND_IN_NANO; }
    public double milliseconds() { return nanoseconds() / (double) MILLIS_IN_NANO; }
    public long nanoseconds() { return nowNanos() - startNanos; }
    public Resolution getResolution() { return resolution; }
    public void log(String label) { Hw.log(label + ": " + toString()); }

    @Override
    public String toString() {
        return resolution == Resolution.SECONDS ? String.format("%.4f seconds", seconds()) : String.format("%.4f milliseconds", milliseconds());
    }
}
