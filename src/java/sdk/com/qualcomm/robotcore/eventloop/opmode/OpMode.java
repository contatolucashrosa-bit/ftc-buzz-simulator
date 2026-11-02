// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package com.qualcomm.robotcore.eventloop.opmode;

import com.qualcomm.robotcore.hardware.Gamepad;
import com.qualcomm.robotcore.hardware.HardwareMap;
import org.buzzsim.internal.Hw;
import org.firstinspires.ftc.robotcore.external.Telemetry;

public abstract class OpMode {
    public static final java.util.HashMap<String, Object> blackboard = new java.util.HashMap<>();
    public HardwareMap hardwareMap;
    public Telemetry telemetry;
    public Gamepad gamepad1 = new Gamepad();
    public Gamepad gamepad2 = new Gamepad();
    public volatile double time;
    public int msStuckDetectInit = 5000;
    public int msStuckDetectInitLoop = 5000;
    public int msStuckDetectStart = 5000;
    public int msStuckDetectLoop = 5000;
    public int msStuckDetectStop = 900;
    private double startTime = Hw.time();

    public OpMode() {}

    public abstract void init();
    public void init_loop() {}
    public void start() {}
    public abstract void loop();
    public void stop() {}

    public final void terminateOpModeNow() {
        Hw.set("opmode", "requestStop", 1);
        throw new RuntimeException("terminateOpModeNow()");
    }

    public final void requestOpModeStop() {
        Hw.set("opmode", "requestStop", 1);
    }

    public double getRuntime() {
        return Hw.time() - startTime;
    }

    public void resetRuntime() {
        startTime = Hw.time();
    }

    public void updateTelemetry(Telemetry telemetry) {
        telemetry.update();
    }

    public void internalPreInit() {
        gamepad1.setGamepadId(1);
        gamepad2.setGamepadId(2);
    }

    public void internalPostInitLoop() {}
    public void internalPostLoop() {}

    /** Devolve a vez ao simulador e atualiza gamepads e o tempo. */
    public void internalSync() {
        Hw.sync();
        gamepad1.internalRefresh(0);
        gamepad2.internalRefresh(1);
        time = getRuntime();
    }
}
