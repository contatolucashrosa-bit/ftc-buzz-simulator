// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package com.qualcomm.robotcore.util;

import org.buzzsim.internal.Hw;

/** Log do robô: no simulador aparece no console do jogo. */
public class RobotLog {
    private static String globalError = "";

    private RobotLog() {}

    private static String safe(String format, Object... args) {
        try {
            return args == null || args.length == 0 ? format : String.format(format, args);
        } catch (RuntimeException e) {
            return format;
        }
    }

    private static void write(String level, String tag, String message) {
        Hw.log("ROBOTLOG " + level + "/" + tag + ": " + message);
    }

    public static void a(String format, Object... args) { write("A", "RobotCore", safe(format, args)); }
    public static void a(String message) { write("A", "RobotCore", message); }
    public static void aa(String tag, String format, Object... args) { write("A", tag, safe(format, args)); }
    public static void aa(String tag, String message) { write("A", tag, message); }
    public static void aa(String tag, Throwable t, String format, Object... args) { write("A", tag, safe(format, args) + " " + t); }
    public static void aa(String tag, Throwable t, String message) { write("A", tag, message + " " + t); }
    public static void v(String format, Object... args) { write("V", "RobotCore", safe(format, args)); }
    public static void v(String message) { write("V", "RobotCore", message); }
    public static void vv(String tag, String format, Object... args) { write("V", tag, safe(format, args)); }
    public static void vv(String tag, String message) { write("V", tag, message); }
    public static void vv(String tag, Throwable t, String format, Object... args) { write("V", tag, safe(format, args) + " " + t); }
    public static void vv(String tag, Throwable t, String message) { write("V", tag, message + " " + t); }
    public static void d(String format, Object... args) { write("D", "RobotCore", safe(format, args)); }
    public static void d(String message) { write("D", "RobotCore", message); }
    public static void dd(String tag, String format, Object... args) { write("D", tag, safe(format, args)); }
    public static void dd(String tag, String message) { write("D", tag, message); }
    public static void dd(String tag, Throwable t, String format, Object... args) { write("D", tag, safe(format, args) + " " + t); }
    public static void dd(String tag, Throwable t, String message) { write("D", tag, message + " " + t); }
    public static void i(String format, Object... args) { write("I", "RobotCore", safe(format, args)); }
    public static void i(String message) { write("I", "RobotCore", message); }
    public static void ii(String tag, String format, Object... args) { write("I", tag, safe(format, args)); }
    public static void ii(String tag, String message) { write("I", tag, message); }
    public static void ii(String tag, Throwable t, String format, Object... args) { write("I", tag, safe(format, args) + " " + t); }
    public static void ii(String tag, Throwable t, String message) { write("I", tag, message + " " + t); }
    public static void w(String format, Object... args) { write("W", "RobotCore", safe(format, args)); }
    public static void w(String message) { write("W", "RobotCore", message); }
    public static void ww(String tag, String format, Object... args) { write("W", tag, safe(format, args)); }
    public static void ww(String tag, String message) { write("W", tag, message); }
    public static void ww(String tag, Throwable t, String format, Object... args) { write("W", tag, safe(format, args) + " " + t); }
    public static void ww(String tag, Throwable t, String message) { write("W", tag, message + " " + t); }
    public static void e(String format, Object... args) { write("E", "RobotCore", safe(format, args)); }
    public static void e(String message) { write("E", "RobotCore", message); }
    public static void ee(String tag, String format, Object... args) { write("E", tag, safe(format, args)); }
    public static void ee(String tag, String message) { write("E", tag, message); }
    public static void ee(String tag, Throwable t, String format, Object... args) { write("E", tag, safe(format, args) + " " + t); }
    public static void ee(String tag, Throwable t, String message) { write("E", tag, message + " " + t); }

    public static void logStacktrace(Throwable t) { write("E", "RobotCore", String.valueOf(t)); }
    public static void logStackTrace(Throwable t) { write("E", "RobotCore", String.valueOf(t)); }
    public static void logStackTrace(String tag, Throwable t) { write("E", tag, String.valueOf(t)); }
    public static void logExceptionHeader(Exception e, String format, Object... args) { write("E", "RobotCore", safe(format, args) + " " + e); }
    public static void logExceptionHeader(String tag, Exception e, String format, Object... args) { write("E", tag, safe(format, args) + " " + e); }
    public static boolean setGlobalErrorMsg(String message) { globalError = message; write("E", "RobotCore", message); return true; }
    public static void setGlobalErrorMsg(String format, Object... args) { setGlobalErrorMsg(safe(format, args)); }
    public static void setGlobalErrorMsg(RuntimeException e, String message) { setGlobalErrorMsg(message + " " + e); }
    public static void addGlobalWarningMessage(String message) { write("W", "RobotCore", message); }
    public static void addGlobalWarningMessage(String format, Object... args) { addGlobalWarningMessage(safe(format, args)); }
    public static String getGlobalErrorMsg() { return globalError; }
    public static void clearGlobalErrorMsg() { globalError = ""; }
    public static void clearGlobalWarningMsg() {}
    public static void setGlobalErrorMsgSticky(boolean sticky) {}
}
