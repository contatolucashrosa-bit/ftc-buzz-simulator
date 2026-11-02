// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Entrada unificada: teclado, gamepad (mapeamento "standard") e toque (tablet/Chromebook).

export interface ControlState {
  /** Movimento relativo à tela: x = direita, y = para frente. Entre -1 e 1. */
  moveX: number;
  moveY: number;
  turn: number;
  intakeHeld: boolean;
  launch: boolean;
  place: boolean;
  nectar: boolean;
  camera: boolean;
  pause: boolean;
  restart: boolean;
  toggleRelative: boolean;
  speedDelta: number;
  pitchDelta: number;
  /** Ajuste da câmera do robô pelo analógico direito (-1..1): guinada (com R3) e inclinação. */
  cameraYaw: number;
  cameraPitch: number;
  /** Alterna o modo do placar (transmissão → piloto → oculto). */
  overlayMode: boolean;
}

const ACTION_KEYS = {
  launch: ["KeyF"],
  place: ["KeyG"],
  nectar: ["KeyN"],
  camera: ["KeyC"],
  pause: ["Escape", "KeyP"],
  restart: ["KeyR"],
  toggleRelative: ["KeyO"],
  overlayMode: ["KeyV"],
} as const;

type EdgeAction = keyof typeof ACTION_KEYS;

const DEADZONE = 0.12;

function dz(v: number): number {
  return Math.abs(v) < DEADZONE ? 0 : (v - Math.sign(v) * DEADZONE) / (1 - DEADZONE);
}

export class Controls {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private prevPad: boolean[] = [];
  private touch = { moveX: 0, moveY: 0, turn: 0, intake: false, edges: new Set<EdgeAction>() };
  private readonly cleanup: Array<() => void> = [];

  constructor() {
    const onDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    };
    const onUp = (e: KeyboardEvent) => this.down.delete(e.code);
    const onBlur = () => this.down.clear();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    this.cleanup.push(() => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    });
  }

  /** Liga os controles de toque a elementos da tela (joysticks e botões). */
  bindTouch(root: HTMLElement): void {
    const stick = (el: HTMLElement, onMove: (x: number, y: number) => void) => {
      const knob = el.querySelector<HTMLElement>(".knob");
      let id: number | null = null;
      const update = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        let y = -(e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const len = Math.hypot(x, y);
        if (len > 1) {
          x /= len;
          y /= len;
        }
        onMove(x, y);
        if (knob) knob.style.transform = `translate(${x * 35}%, ${-y * 35}%)`;
      };
      el.addEventListener("pointerdown", (e) => {
        id = e.pointerId;
        el.setPointerCapture(e.pointerId);
        update(e);
      });
      el.addEventListener("pointermove", (e) => e.pointerId === id && update(e));
      const end = (e: PointerEvent) => {
        if (e.pointerId !== id) return;
        id = null;
        onMove(0, 0);
        if (knob) knob.style.transform = "";
      };
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
    };
    const move = root.querySelector<HTMLElement>("[data-stick=move]");
    const turn = root.querySelector<HTMLElement>("[data-stick=turn]");
    if (move) stick(move, (x, y) => ((this.touch.moveX = x), (this.touch.moveY = y)));
    if (turn) stick(turn, (x) => (this.touch.turn = -x));

    root.querySelectorAll<HTMLElement>("[data-action]").forEach((btn) => {
      const action = btn.dataset.action!;
      if (action === "intake") {
        btn.addEventListener("pointerdown", () => (this.touch.intake = true));
        const off = () => (this.touch.intake = false);
        btn.addEventListener("pointerup", off);
        btn.addEventListener("pointercancel", off);
        btn.addEventListener("pointerleave", off);
      } else {
        btn.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          this.touch.edges.add(action as EdgeAction);
        });
      }
    });
  }

  /** Lê o estado do quadro atual. As ações "de toque único" valem só uma vez. */
  poll(): ControlState {
    const key = (code: string) => this.down.has(code);
    const edge = (a: EdgeAction) => ACTION_KEYS[a].some((c) => this.pressed.has(c)) || this.touch.edges.has(a);

    let moveX = (key("KeyD") ? 1 : 0) - (key("KeyA") ? 1 : 0) + this.touch.moveX;
    let moveY = (key("KeyW") ? 1 : 0) - (key("KeyS") ? 1 : 0) + this.touch.moveY;
    let turn = (key("KeyQ") ? 1 : 0) - (key("KeyE") ? 1 : 0) + this.touch.turn;
    let intakeHeld = key("Space") || this.touch.intake;
    let speedDelta = (key("ArrowUp") ? 1 : 0) - (key("ArrowDown") ? 1 : 0);
    let pitchDelta = (key("ArrowRight") ? 1 : 0) - (key("ArrowLeft") ? 1 : 0);

    const state: ControlState = {
      moveX: 0,
      moveY: 0,
      turn: 0,
      intakeHeld: false,
      launch: edge("launch"),
      place: edge("place"),
      nectar: edge("nectar"),
      camera: edge("camera"),
      pause: edge("pause"),
      restart: edge("restart"),
      toggleRelative: edge("toggleRelative"),
      overlayMode: edge("overlayMode"),
      speedDelta: 0,
      pitchDelta: 0,
      cameraYaw: 0,
      cameraPitch: 0,
    };

    // Gamepad padrão: analógico esquerdo move, direito gira; RT lança, RB coloca, LT coleta.
    const pads = typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];
    const pad = Array.from(pads).find((p) => p && p.connected);
    if (pad) {
      const b = (i: number) => !!pad.buttons[i]?.pressed;
      const padEdge = (i: number) => b(i) && !this.prevPad[i];
      moveX += dz(pad.axes[0] ?? 0);
      moveY += -dz(pad.axes[1] ?? 0);
      // R3 segurado: o analógico direito gira a câmera do robô em vez de girar o robô
      if (b(11)) state.cameraYaw = -dz(pad.axes[2] ?? 0);
      else turn += -dz(pad.axes[2] ?? 0);
      state.cameraPitch = dz(pad.axes[3] ?? 0);
      intakeHeld ||= b(6) || b(4);
      state.launch ||= padEdge(7);
      state.place ||= padEdge(5);
      state.nectar ||= padEdge(3);
      state.camera ||= padEdge(8);
      state.pause ||= padEdge(9);
      speedDelta += (b(12) ? 1 : 0) - (b(13) ? 1 : 0);
      pitchDelta += (b(15) ? 1 : 0) - (b(14) ? 1 : 0);
      this.prevPad = pad.buttons.map((x) => x.pressed);
    }

    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    state.moveX = clamp(moveX);
    state.moveY = clamp(moveY);
    state.turn = clamp(turn);
    state.intakeHeld = intakeHeld;
    state.speedDelta = clamp(speedDelta);
    state.pitchDelta = clamp(pitchDelta);

    this.pressed.clear();
    this.touch.edges.clear();
    return state;
  }

  dispose(): void {
    this.cleanup.forEach((fn) => fn());
  }
}
