// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.buzzsim.internal;

import org.teavm.interop.Async;
import org.teavm.interop.AsyncCallback;
import org.teavm.jso.JSBody;
import org.teavm.jso.JSFunctor;
import org.teavm.jso.JSObject;

/** Ponte com o simulador (JavaScript). Tudo passa por globalThis.__buzzHw. */
public final class Hw {
    private Hw() {}

    @JSBody(params = {"name"}, script = "return globalThis.__buzzHw.kind(name);")
    public static native String kind(String name);

    @JSBody(params = {"name", "prop"}, script = "return globalThis.__buzzHw.get(name, prop);")
    public static native double get(String name, String prop);

    @JSBody(params = {"name", "prop", "value"}, script = "globalThis.__buzzHw.set(name, prop, value);")
    public static native void set(String name, String prop, double value);

    @JSBody(params = {"index", "field"}, script = "return globalThis.__buzzHw.gamepad(index, field);")
    public static native double gamepad(int index, String field);

    /** 0 = INIT, 1 = rodando (depois do START), 2 = parada pedida. */
    @JSBody(script = "return globalThis.__buzzHw.state();")
    public static native int state();

    /** Tempo de simulação em segundos (para enquanto o jogo está pausado). */
    @JSBody(script = "return globalThis.__buzzHw.time();")
    public static native double time();

    @JSBody(params = {"text"}, script = "globalThis.__buzzHw.telemetry(text);")
    public static native void telemetry(String text);

    @JSBody(params = {"text"}, script = "globalThis.__buzzHw.log(text);")
    public static native void log(String text);

    /** AprilTags vistas pela câmera montada (pol, graus), uma por ";" (ver hardwareBus.ts). */
    @JSBody(params = {"x", "y", "z", "yaw", "pitch", "roll", "fx", "fy", "cx", "cy", "width", "height"},
            script = "return globalThis.__buzzHw.aprilTags(x, y, z, yaw, pitch, roll, fx, fy, cx, cy, width, height);")
    public static native String aprilTags(double x, double y, double z, double yaw, double pitch, double roll,
                                          double fx, double fy, double cx, double cy, int width, int height);

    /** Tags do campo: "id,x,y,z" separadas por ";" (pol). */
    @JSBody(script = "return globalThis.__buzzHw.tagLibrary();")
    public static native String tagLibrary();

    /** Nomes configurados de um tipo, separados por vírgula. */
    @JSBody(params = {"kind"}, script = "return globalThis.__buzzHw.names(kind);")
    public static native String names(String kind);

    @JSFunctor
    public interface Resume extends JSObject {
        void run();
    }

    @JSBody(params = {"resume"}, script = "globalThis.__buzzHw.onNextStep(resume);")
    private static native void scheduleOnNextStep(Resume resume);

    @Async
    private static native Void waitNextStep();

    private static void waitNextStep(AsyncCallback<Void> callback) {
        scheduleOnNextStep(() -> callback.complete(null));
    }

    /**
     * Devolve a vez ao simulador e espera o próximo passo da física.
     * Assim o laço do OpMode roda no ritmo da simulação (como um Control Hub) e pausa junto com o jogo.
     */
    public static void sync() {
        waitNextStep();
    }
}
