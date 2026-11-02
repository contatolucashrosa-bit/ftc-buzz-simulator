// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package com.qualcomm.robotcore.eventloop.opmode;

import org.buzzsim.internal.Hw;

public abstract class LinearOpMode extends OpMode {
    public LinearOpMode() {}

    public abstract void runOpMode() throws InterruptedException;

    public void waitForStart() {
        while (!isStarted() && !isStopRequested()) {
            idle();
        }
        resetRuntime();
    }

    public final void idle() {
        internalSync();
    }

    /** Dorme em tempo de simulação (respeita a pausa do jogo). */
    public final void sleep(long milliseconds) {
        double until = Hw.time() + milliseconds / 1000.0;
        do {
            idle();
        } while (Hw.time() < until && !isStopRequested());
    }

    public final boolean opModeIsActive() {
        boolean active = isStarted() && !isStopRequested();
        idle();
        return active;
    }

    public final boolean opModeInInit() {
        return !isStarted() && !isStopRequested();
    }

    public final boolean isStarted() {
        return Hw.state() >= 1;
    }

    public final boolean isStopRequested() {
        return Hw.state() >= 2;
    }

    @Override public final void init() {}
    @Override public final void init_loop() {}
    @Override public final void start() {}
    @Override public final void loop() {}
    @Override public final void stop() {}
}
