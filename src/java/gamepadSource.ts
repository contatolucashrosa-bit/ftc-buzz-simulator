// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Gamepad do Driver Station para o código Java: controle físico (mapeamento padrão do navegador) ou teclado.
// Teclado: WASD = analógico esquerdo, Q/E = analógico direito (giro), setas = direcional,
// Espaço = gatilho esquerdo, F = gatilho direito, H/G = bumpers esquerdo/direito, I/J/K/L = Y/X/A/B.

const BUTTONS: Record<string, number> = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  left_bumper: 4,
  right_bumper: 5,
  back: 8,
  start: 9,
  left_stick_button: 10,
  right_stick_button: 11,
  dpad_up: 12,
  dpad_down: 13,
  dpad_left: 14,
  dpad_right: 15,
  guide: 16,
  ps: 16,
  touchpad: 17,
};

const KEYS: Record<string, string> = {
  a: "KeyK",
  b: "KeyL",
  x: "KeyJ",
  y: "KeyI",
  left_bumper: "KeyH",
  right_bumper: "KeyG",
  dpad_up: "ArrowUp",
  dpad_down: "ArrowDown",
  dpad_left: "ArrowLeft",
  dpad_right: "ArrowRight",
  start: "Enter",
  back: "Backspace",
};

/** Com um 2º jogador no teclado (I/J/K/L e H), os botões do gamepad1 vão para teclas que ele não usa. */
const SHARED_KEYS: Record<string, string> = {
  ...KEYS,
  a: "Digit1",
  b: "Digit2",
  x: "Digit3",
  y: "Digit4",
  left_bumper: "KeyZ",
  right_bumper: "KeyX",
};

export class GamepadSource {
  private readonly keys: Record<string, string>;
  private readonly down = new Set<string>();
  private readonly onDown = (e: KeyboardEvent) => this.down.add(e.code);
  private readonly onUp = (e: KeyboardEvent) => this.down.delete(e.code);

  constructor(shareKeyboard = false) {
    this.keys = shareKeyboard ? SHARED_KEYS : KEYS;
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
    window.addEventListener("blur", () => this.down.clear());
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
  }

  read(index: number, field: string): number {
    const pad = navigator.getGamepads?.()[index];
    if (pad?.connected) {
      const axis = (i: number) => (Math.abs(pad.axes[i] ?? 0) > 0.06 ? pad.axes[i] : 0);
      switch (field) {
        case "left_stick_x":
          return axis(0);
        case "left_stick_y":
          return axis(1);
        case "right_stick_x":
          return axis(2);
        case "right_stick_y":
          return axis(3);
        case "left_trigger":
          return pad.buttons[6]?.value ?? 0;
        case "right_trigger":
          return pad.buttons[7]?.value ?? 0;
        default: {
          const b = BUTTONS[field];
          return b !== undefined && pad.buttons[b]?.pressed ? 1 : 0;
        }
      }
    }
    // só o gamepad1 tem teclado
    if (index !== 0) return 0;
    const key = (code: string) => (this.down.has(code) ? 1 : 0);
    switch (field) {
      case "left_stick_x":
        return key("KeyD") - key("KeyA");
      case "left_stick_y":
        return key("KeyS") - key("KeyW"); // no SDK, para cima é negativo
      case "right_stick_x":
        return key("KeyE") - key("KeyQ");
      case "right_stick_y":
        return 0;
      case "left_trigger":
        return key("Space");
      case "right_trigger":
        return key("KeyF");
      default:
        return this.keys[field] ? key(this.keys[field]) : 0;
    }
  }
}
