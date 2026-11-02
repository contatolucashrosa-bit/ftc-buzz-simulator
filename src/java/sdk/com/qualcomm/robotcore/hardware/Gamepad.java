// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package com.qualcomm.robotcore.hardware;

import org.buzzsim.internal.Hw;

/** Gamepad lido do teclado/controle do simulador a cada sincronização. */
public class Gamepad {
    public enum Type { UNKNOWN, LOGITECH_F310, XBOX_360, SONY_PS4, SONY_PS4_SUPPORTED_BY_KERNEL }

    public static final int ID_UNASSOCIATED = -1;
    public static final int ID_SYNTHETIC = -2;
    public static final float DEFAULT_TRIGGER_THRESHOLD = 0.2f;
    public static final int LED_DURATION_CONTINUOUS = -1;
    public static final int RUMBLE_DURATION_CONTINUOUS = -1;

    public volatile Type type = Type.XBOX_360;
    public volatile float left_stick_x;
    public volatile float left_stick_y;
    public volatile float right_stick_x;
    public volatile float right_stick_y;
    public volatile float left_trigger;
    public volatile float right_trigger;
    public volatile boolean dpad_up;
    public volatile boolean dpad_down;
    public volatile boolean dpad_left;
    public volatile boolean dpad_right;
    public volatile boolean a;
    public volatile boolean b;
    public volatile boolean x;
    public volatile boolean y;
    public volatile boolean guide;
    public volatile boolean start;
    public volatile boolean back;
    public volatile boolean left_bumper;
    public volatile boolean right_bumper;
    public volatile boolean left_stick_button;
    public volatile boolean right_stick_button;
    public volatile boolean touchpad;
    public volatile boolean ps;
    public volatile boolean left_trigger_pressed;
    public volatile boolean right_trigger_pressed;
    public volatile boolean circle;
    public volatile boolean cross;
    public volatile boolean triangle;
    public volatile boolean square;
    public volatile boolean share;
    public volatile boolean options;
    public volatile boolean touchpad_finger_1;
    public volatile boolean touchpad_finger_2;
    public volatile float touchpad_finger_1_x;
    public volatile float touchpad_finger_1_y;
    public volatile float touchpad_finger_2_x;
    public volatile float touchpad_finger_2_y;
    public volatile int id = ID_UNASSOCIATED;
    public volatile long timestamp;
    public long nextRumbleApproxFinishTime;

    private float triggerThreshold = DEFAULT_TRIGGER_THRESHOLD;
    private final boolean[] previous = new boolean[19];
    private final boolean[] pressed = new boolean[19];
    private final boolean[] released = new boolean[19];

    public Gamepad() {}

    private boolean read(int index, int slot, String field) {
        boolean value = Hw.gamepad(index, field) > 0.5;
        track(slot, value);
        return value;
    }

    private void track(int slot, boolean value) {
        if (value && !previous[slot]) pressed[slot] = true;
        if (!value && previous[slot]) released[slot] = true;
        previous[slot] = value;
    }

    private static boolean take(boolean[] flags, int slot) {
        boolean v = flags[slot];
        flags[slot] = false;
        return v;
    }

    /** Uso interno do simulador: copia o estado do controle {index} (0 ou 1). */
    public void internalRefresh(int index) {
        left_stick_x = (float) Hw.gamepad(index, "left_stick_x");
        left_stick_y = (float) Hw.gamepad(index, "left_stick_y");
        right_stick_x = (float) Hw.gamepad(index, "right_stick_x");
        right_stick_y = (float) Hw.gamepad(index, "right_stick_y");
        left_trigger = (float) Hw.gamepad(index, "left_trigger");
        right_trigger = (float) Hw.gamepad(index, "right_trigger");
        dpad_up = read(index, 0, "dpad_up");
        dpad_down = read(index, 1, "dpad_down");
        dpad_left = read(index, 2, "dpad_left");
        dpad_right = read(index, 3, "dpad_right");
        a = read(index, 4, "a");
        b = read(index, 5, "b");
        x = read(index, 6, "x");
        y = read(index, 7, "y");
        guide = read(index, 8, "guide");
        start = read(index, 9, "start");
        back = read(index, 10, "back");
        left_bumper = read(index, 11, "left_bumper");
        right_bumper = read(index, 12, "right_bumper");
        left_stick_button = read(index, 13, "left_stick_button");
        right_stick_button = read(index, 14, "right_stick_button");
        touchpad = read(index, 15, "touchpad");
        ps = read(index, 16, "ps");
        left_trigger_pressed = left_trigger > triggerThreshold;
        right_trigger_pressed = right_trigger > triggerThreshold;
        track(17, left_trigger_pressed);
        track(18, right_trigger_pressed);
        cross = a;
        circle = b;
        square = x;
        triangle = y;
        share = back;
        options = start;
        timestamp = System.nanoTime();
    }

    public void setTriggerThreshold(float threshold) { triggerThreshold = threshold; }
    public float getTriggerThreshold() { return triggerThreshold; }
    public void setGamepadId(int id) { this.id = id; }
    public int getGamepadId() { return id; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
    public void refreshTimestamp() { timestamp = System.nanoTime(); }

    public void copy(Gamepad other) {
        left_stick_x = other.left_stick_x; left_stick_y = other.left_stick_y;
        right_stick_x = other.right_stick_x; right_stick_y = other.right_stick_y;
        left_trigger = other.left_trigger; right_trigger = other.right_trigger;
        dpad_up = other.dpad_up;
        dpad_down = other.dpad_down;
        dpad_left = other.dpad_left;
        dpad_right = other.dpad_right;
        a = other.a;
        b = other.b;
        x = other.x;
        y = other.y;
        guide = other.guide;
        start = other.start;
        back = other.back;
        left_bumper = other.left_bumper;
        right_bumper = other.right_bumper;
        left_stick_button = other.left_stick_button;
        right_stick_button = other.right_stick_button;
        touchpad = other.touchpad;
        ps = other.ps;
        left_trigger_pressed = other.left_trigger_pressed;
        right_trigger_pressed = other.right_trigger_pressed;
        cross = other.cross; circle = other.circle; square = other.square; triangle = other.triangle;
        share = other.share; options = other.options;
    }

    public void reset() { copy(new Gamepad()); }

    public boolean atRest() {
        return left_stick_x == 0 && left_stick_y == 0 && right_stick_x == 0 && right_stick_y == 0 && left_trigger == 0 && right_trigger == 0;
    }

    public Type type() { return type; }
    public void setLedColor(double r, double g, double b, int durationMs) {}
    public void rumble(int durationMs) {}
    public void rumble(double rumble1, double rumble2, int durationMs) {}
    public void stopRumble() {}
    public void rumbleBlips(int count) {}
    public boolean isRumbling() { return false; }

    public void resetEdgeDetection() {
        for (int i = 0; i < pressed.length; i++) { pressed[i] = false; released[i] = false; }
    }

    public boolean dpadUpWasPressed() { return take(pressed, 0); }
    public boolean dpadUpWasReleased() { return take(released, 0); }
    public boolean dpadDownWasPressed() { return take(pressed, 1); }
    public boolean dpadDownWasReleased() { return take(released, 1); }
    public boolean dpadLeftWasPressed() { return take(pressed, 2); }
    public boolean dpadLeftWasReleased() { return take(released, 2); }
    public boolean dpadRightWasPressed() { return take(pressed, 3); }
    public boolean dpadRightWasReleased() { return take(released, 3); }
    public boolean aWasPressed() { return take(pressed, 4); }
    public boolean aWasReleased() { return take(released, 4); }
    public boolean bWasPressed() { return take(pressed, 5); }
    public boolean bWasReleased() { return take(released, 5); }
    public boolean xWasPressed() { return take(pressed, 6); }
    public boolean xWasReleased() { return take(released, 6); }
    public boolean yWasPressed() { return take(pressed, 7); }
    public boolean yWasReleased() { return take(released, 7); }
    public boolean guideWasPressed() { return take(pressed, 8); }
    public boolean guideWasReleased() { return take(released, 8); }
    public boolean startWasPressed() { return take(pressed, 9); }
    public boolean startWasReleased() { return take(released, 9); }
    public boolean backWasPressed() { return take(pressed, 10); }
    public boolean backWasReleased() { return take(released, 10); }
    public boolean leftBumperWasPressed() { return take(pressed, 11); }
    public boolean leftBumperWasReleased() { return take(released, 11); }
    public boolean rightBumperWasPressed() { return take(pressed, 12); }
    public boolean rightBumperWasReleased() { return take(released, 12); }
    public boolean leftStickButtonWasPressed() { return take(pressed, 13); }
    public boolean leftStickButtonWasReleased() { return take(released, 13); }
    public boolean rightStickButtonWasPressed() { return take(pressed, 14); }
    public boolean rightStickButtonWasReleased() { return take(released, 14); }
    public boolean circleWasPressed() { return take(pressed, 5); }
    public boolean circleWasReleased() { return take(released, 5); }
    public boolean crossWasPressed() { return take(pressed, 4); }
    public boolean crossWasReleased() { return take(released, 4); }
    public boolean triangleWasPressed() { return take(pressed, 7); }
    public boolean triangleWasReleased() { return take(released, 7); }
    public boolean squareWasPressed() { return take(pressed, 6); }
    public boolean squareWasReleased() { return take(released, 6); }
    public boolean shareWasPressed() { return take(pressed, 10); }
    public boolean shareWasReleased() { return take(released, 10); }
    public boolean optionsWasPressed() { return take(pressed, 9); }
    public boolean optionsWasReleased() { return take(released, 9); }
    public boolean touchpadWasPressed() { return take(pressed, 15); }
    public boolean touchpadWasReleased() { return take(released, 15); }
    public boolean psWasPressed() { return take(pressed, 16); }
    public boolean psWasReleased() { return take(released, 16); }
    public boolean leftTriggerWasPressed() { return take(pressed, 17); }
    public boolean leftTriggerWasReleased() { return take(released, 17); }
    public boolean rightTriggerWasPressed() { return take(pressed, 18); }
    public boolean rightTriggerWasReleased() { return take(released, 18); }

    @Override
    public String toString() {
        return "ID: " + id + " lx: " + left_stick_x + " ly: " + left_stick_y + " rx: " + right_stick_x + " ry: " + right_stick_y;
    }
}
