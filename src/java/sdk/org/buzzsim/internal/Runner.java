// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.buzzsim.internal;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.hardware.HardwareMap;

/** Executa um OpMode como o Control Hub faria: INIT → START → laço → STOP. */
public final class Runner {
    private Runner() {}

    public static void run(OpMode opMode) {
        opMode.hardwareMap = new HardwareMap(null, null);
        opMode.telemetry = new SimTelemetry();
        opMode.internalPreInit();
        try {
            if (opMode instanceof LinearOpMode) {
                ((LinearOpMode) opMode).runOpMode();
            } else {
                runIterative(opMode);
            }
            Hw.log("OPMODE_END");
        } catch (Throwable t) {
            Hw.log("OPMODE_ERROR " + describe(t));
        } finally {
            HardwareMap.stopAllMotors();
        }
    }

    private static String describe(Throwable t) {
        StringBuilder sb = new StringBuilder(String.valueOf(t));
        StackTraceElement[] stack = t.getStackTrace();
        if (stack != null) {
            for (int i = 0; i < Math.min(stack.length, 12); i++) sb.append("\n    em ").append(stack[i]);
        }
        Throwable cause = t.getCause();
        while (cause != null && cause != t) {
            sb.append(" | causa: ").append(cause);
            t = cause;
            cause = cause.getCause();
        }
        return sb.toString();
    }

    private static void runIterative(OpMode op) {
        op.init();
        op.telemetry.update();
        while (Hw.state() == 0) {
            op.internalSync();
            op.init_loop();
            op.telemetry.update();
        }
        if (Hw.state() == 1) {
            op.resetRuntime();
            op.start();
            while (Hw.state() == 1) {
                op.internalSync();
                op.loop();
                op.telemetry.update();
            }
        }
        op.stop();
    }
}
