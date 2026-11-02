// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Tela de jogo: canvas 3D + Score Overlay + HUD + pausa + resultado.
import { Game, type GameOptions, type GameView } from "../game/game";
import { recordMatchPlayed } from "../config/app";
import { ICON_POLLINATOR, ICON_ROBOT, ICON_SWARM } from "./icons";
import { escapeHtml } from "./dom";
import type { AllianceScore } from "../scoring/scoring";

export type OverlayMode = "broadcast" | "driver" | "hidden";
export type OverlayScale = 0.5 | 0.75 | 1;

const OVERLAY_MODES: Array<{ id: OverlayMode; label: string }> = [
  { id: "broadcast", label: "Transmissão" },
  { id: "driver", label: "Piloto (compacto)" },
  { id: "hidden", label: "Oculto" },
];
const OVERLAY_SCALES: OverlayScale[] = [0.5, 0.75, 1];
const HUD_KEY = "buzz-simulator:hud";

interface HudPrefs {
  mode: OverlayMode;
  scale: OverlayScale;
  robotPanelCollapsed: boolean;
}

function loadHudPrefs(): HudPrefs {
  // Padrão 0,5×: o placar inteiro continua legível e deixa a HIVE livre na visão do piloto.
  const fallback: HudPrefs = { mode: "broadcast", scale: 0.5, robotPanelCollapsed: false };
  try {
    const saved = JSON.parse(localStorage.getItem(HUD_KEY) ?? "{}") as Partial<HudPrefs>;
    return {
      mode: OVERLAY_MODES.some((m) => m.id === saved.mode) ? saved.mode! : fallback.mode,
      scale: OVERLAY_SCALES.includes(saved.scale as OverlayScale) ? saved.scale! : fallback.scale,
      robotPanelCollapsed: saved.robotPanelCollapsed === true,
    };
  } catch {
    return fallback;
  }
}

function saveHudPrefs(prefs: HudPrefs): void {
  try {
    localStorage.setItem(HUD_KEY, JSON.stringify(prefs));
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}

function rectsOverlap(a: { left: number; top: number; right: number; bottom: number }, b: DOMRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export interface GameScreenActions {
  exitToHome(): void;
  restart(options: GameOptions): void;
}

const HOPPER_LABEL: Record<string, string> = { pollen: "POLLEN", redNectar: "NECTAR vermelho", blueNectar: "NECTAR azul" };

function bonusHtml(score: AllianceScore): string {
  const icon = (on: boolean, svg: string, title: string, prog: string) =>
    `<div class="ov-icon ${on ? "on" : ""}" title="${title}" aria-label="${title}: ${prog}">${svg}<span class="ov-prog">${prog}</span></div>`;
  return [
    icon(score.swarm.achieved, ICON_SWARM, "SWARM RP (LEAVE + PARK ≥ 16)", `${score.swarm.progress}/${score.swarm.threshold}`),
    icon(score.pollinator1.achieved, ICON_POLLINATOR(1), "POLLINATOR 1 RP (4 TIPs)", `${score.pollinator1.progress}/${score.pollinator1.threshold}`),
    icon(score.pollinator2.achieved, ICON_POLLINATOR(2), "POLLINATOR 2 RP (7 TIPs)", `${score.pollinator2.progress}/${score.pollinator2.threshold}`),
  ].join("");
}

function resultRows(view: GameView): string {
  const r = view.score.red;
  const b = view.score.blue;
  const row = (label: string, ref: string, red: number, blue: number) =>
    `<tr><td>${label} <small>${ref}</small></td><td class="red">${red}</td><td class="blue">${blue}</td></tr>`;
  const rp = (s: AllianceScore) =>
    [s.swarm.achieved && "SWARM", s.pollinator1.achieved && "POLLINATOR 1", s.pollinator2.achieved && "POLLINATOR 2"].filter(Boolean).join(", ") || "—";
  return `
    <table class="result-table">
      <thead><tr><th>Conquista</th><th class="red">Vermelha</th><th class="blue">Azul</th></tr></thead>
      <tbody>
        ${row("LEAVE (AUTO)", "3 cada", r.autoLeavePoints, b.autoLeavePoints)}
        ${row("PARK (AUTO)", "5 cada", r.autoParkPoints, b.autoParkPoints)}
        ${row("HIVE TIP (AUTO)", "20 cada", r.autoHivePoints, b.autoHivePoints)}
        ${row("HIVE TIP (TELEOP)", "20 cada", r.teleopHivePoints, b.teleopHivePoints)}
        ${row("Elementos na CELL", "2 cada", r.teleopCellPoints, b.teleopCellPoints)}
        ${row("FLOWERS (dona + bônus)", "2 cada + 5", r.teleopFlowerPoints, b.teleopFlowerPoints)}
        ${row("GARDEN", "1 cada", r.teleopGardenPoints, b.teleopGardenPoints)}
        ${row("PARK (fim)", "5 cada", r.teleopParkPoints, b.teleopParkPoints)}
        ${row("Faltas da adversária", "MINOR 5 / MAJOR 20", r.foulPointsReceived, b.foulPointsReceived)}
        <tr class="total"><td>Total</td><td class="red">${r.total}</td><td class="blue">${b.total}</td></tr>
        <tr><td>RANKING POINTS <small>${escapeHtml(rp(r))} | ${escapeHtml(rp(b))}</small></td><td class="red">${r.rankingPoints}</td><td class="blue">${b.rankingPoints}</td></tr>
      </tbody>
    </table>
    <p><small>Pontuação conforme a Tabela 10-2 (p.89) do manual BIOBUZZ TU07.</small></p>`;
}

export async function mountGameScreen(root: HTMLElement, options: GameOptions, actions: GameScreenActions): Promise<() => void> {
  const isTouch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  root.innerHTML = `
    <div class="game" role="application" aria-label="Arena do Buzz Simulator">
      <div class="stage-host"></div>
      <div class="overlay" aria-live="off" data-overlay>
        <div class="ov-top"><span class="ov-event"></span><span class="ov-match"></span><span></span></div>
        <div class="ov-main">
          <div class="ov-alliance blue"><div class="ov-bonus" data-bonus="blue"></div><div class="ov-teams"><span>—</span><span>—</span></div><div class="ov-score" data-score="blue">0</div></div>
          <div class="ov-center">${ICON_ROBOT}<div class="ov-timer-wrap"><div class="ov-timer">2:30</div><div class="ov-phase"></div></div></div>
          <div class="ov-alliance red"><div class="ov-bonus" data-bonus="red"></div><div class="ov-teams"><span data-team></span><span>—</span></div><div class="ov-score" data-score="red">0</div></div>
        </div>
      </div>
      <div class="toast-area" aria-live="polite"></div>
      <div class="game-actions">
        <button class="icon-btn" data-act="pause">Pausar (Esc)</button>
        <button class="icon-btn" data-act="camera">Câmera (C)</button>
        <button class="icon-btn" data-act="overlay" aria-expanded="false">Placar (V)</button>
        <div class="panel overlay-settings" data-overlay-settings hidden>
          <h4>Placar</h4>
          <fieldset class="seg" aria-label="Modo do placar">
            ${OVERLAY_MODES.map((m) => `<label><input type="radio" name="ov-mode" value="${m.id}"> ${m.label}</label>`).join("")}
          </fieldset>
          <h4>Escala</h4>
          <div class="seg-buttons" role="group" aria-label="Escala do placar">
            ${OVERLAY_SCALES.map((s) => `<button type="button" data-scale="${s}">${String(s).replace(".", ",")}×</button>`).join("")}
          </div>
          <p class="hint">Na câmera "Seguir robô": arraste para girar, use a roda para aproximar e dê dois cliques para voltar ao padrão. No controle: analógico direito (com R3 para girar).</p>
        </div>
        <button class="icon-btn" data-act="help">Ajuda</button>
        <button class="icon-btn" data-act="touch">Toque</button>
      </div>
      <div class="hud">
        <div class="panel robot-panel" data-robot-panel>
          <button type="button" class="panel-toggle" data-robot-toggle aria-expanded="true" title="Recolher ou mostrar o painel do robô">
            <h4>Robô ${escapeHtml(options.teamNumber)}</h4><span class="chevron" aria-hidden="true">▾</span>
          </button>
          <div class="panel-body">
          <div class="hopper" data-hopper aria-label="Depósito"></div>
          <dl class="kv" style="margin-top:8px">
            <dt>Intake</dt><dd data-intake>parado</dd>
            <dt>Lançador</dt><dd data-launcher></dd>
            <dt>Rajada</dt><dd data-burst></dd>
            <dt>NECTAR liberado</dt><dd data-nectar></dd>
            <dt>Câmera</dt><dd data-camera></dd>
            <dt>Direção</dt><dd data-drive></dd>
            <dt>FPS</dt><dd data-fps></dd>
          </dl>
          </div>
        </div>
        <div class="panel fouls" data-fouls hidden></div>
      </div>
      <div class="panel help" data-help ${isTouch ? "hidden" : ""}>
        <h4>Controles</h4>
        <table>
          <tr><td>W A S D</td><td>mover</td></tr>
          <tr><td>Q / E</td><td>girar</td></tr>
          <tr><td>Espaço</td><td>intake (segurar)</td></tr>
          <tr><td>F</td><td>lançar tudo em rajada (HIVE)</td></tr>
          <tr><td>G</td><td>colocar (FLOWER)</td></tr>
          <tr><td>↑ ↓ / ← →</td><td>velocidade / ângulo</td></tr>
          <tr><td>N</td><td>HUMAN PLAYER: NECTAR</td></tr>
          <tr><td>C · O · R · V</td><td>câmera · direção · reiniciar · placar</td></tr>
          <tr><td>Mouse</td><td>câmera do robô: arrastar gira, roda aproxima</td></tr>
          <tr><td>Gamepad</td><td>analógicos, LT coleta, RT lança, RB coloca, Y NECTAR; analógico direito ↕ inclina a câmera do robô, R3 + ↔ gira</td></tr>
        </table>
      </div>
      <div class="touch ${isTouch ? "show" : ""}" data-touch>
        <div class="stick" data-stick="move" aria-label="Mover"><div class="knob"></div></div>
        <div class="touch-buttons">
          <button data-action="intake">Coletar</button>
          <button data-action="launch">Lançar</button>
          <button data-action="place">Colocar</button>
          <button data-action="nectar">NECTAR</button>
        </div>
        <div class="stick" data-stick="turn" aria-label="Girar"><div class="knob"></div></div>
      </div>
      <div data-modal></div>
    </div>`;

  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  q(".ov-event").textContent = options.eventName;
  q(".ov-match").textContent = options.matchLabel;
  q("[data-team]").textContent = options.teamNumber;

  const modal = q("[data-modal]");
  let game: Game | null = null;

  const showModal = (html: string, bind: (el: HTMLElement) => void) => {
    modal.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
    bind(modal);
    modal.querySelector<HTMLElement>("button")?.focus();
  };
  const closeModal = () => (modal.innerHTML = "");

  const pauseMenu = () => {
    if (!game) return;
    game.setPaused(true);
    showModal(
      `<h2>Pausado</h2><p>A física e o relógio estão parados.</p>
       <div class="actions">
         <button class="btn btn-primary" data-m="resume">Continuar</button>
         <button class="btn btn-secondary" data-m="restart">Reiniciar</button>
         <button class="btn btn-secondary" data-m="exit">Sair para o início</button>
       </div>`,
      (el) => {
        el.querySelector('[data-m="resume"]')!.addEventListener("click", () => {
          closeModal();
          game?.setPaused(false);
        });
        el.querySelector('[data-m="restart"]')!.addEventListener("click", () => actions.restart(options));
        el.querySelector('[data-m="exit"]')!.addEventListener("click", () => actions.exitToHome());
      },
    );
  };

  const startPrompt = () => {
    showModal(
      `<h2>${escapeHtml(options.matchLabel)}</h2>
       <p>O robô <strong>${escapeHtml(options.teamNumber)}</strong> está na posição de largada, com 4 POLLEN pré-carregados (G304).
       O AUTO dura 30 s e roda o programa escolhido; depois de 8 s de transição, você assume no TELEOP (2:00).</p>
       <p class="notice">Nesta versão a aliança azul não tem robôs (treino solo). Os robôs-bot chegam no marco M9.</p>
       <div class="actions"><button class="btn btn-primary" data-m="go">Iniciar partida</button>
       <button class="btn btn-secondary" data-m="exit">Voltar</button></div>`,
      (el) => {
        el.querySelector('[data-m="go"]')!.addEventListener("click", () => {
          closeModal();
          game?.startMatch();
        });
        el.querySelector('[data-m="exit"]')!.addEventListener("click", () => actions.exitToHome());
      },
    );
  };

  const onFinished = (view: GameView) => {
    recordMatchPlayed();
    const r = view.score.red.total;
    const b = view.score.blue.total;
    const headline = r > b ? "Vitória da aliança vermelha!" : r < b ? "Vitória da aliança azul" : "Empate";
    showModal(
      `<h2>${headline}</h2>${resultRows(view)}
       ${view.fouls.length ? `<h3>Faltas</h3><ul>${view.fouls.map((f) => `<li>${f.clock} — ${f.rule}: ${escapeHtml(f.text)} (${f.penalty === "major" ? "MAJOR" : "MINOR"}, ${f.alliance === "red" ? "vermelha" : "azul"})</li>`).join("")}</ul>` : ""}
       <div class="actions">
         <button class="btn btn-primary" data-m="again">Jogar de novo</button>
         <button class="btn btn-secondary" data-m="exit">Início</button>
       </div>`,
      (el) => {
        el.querySelector('[data-m="again"]')!.addEventListener("click", () => actions.restart(options));
        el.querySelector('[data-m="exit"]')!.addEventListener("click", () => actions.exitToHome());
      },
    );
  };

  // Placar: modo, escala e transparência automática sobre a HIVE
  const overlayEl = q("[data-overlay]");
  const settingsEl = q("[data-overlay-settings]");
  const hud = loadHudPrefs();
  const applyOverlay = () => {
    overlayEl.dataset.mode = hud.mode;
    overlayEl.style.setProperty("--ov-scale", String(hud.scale));
    settingsEl.querySelectorAll<HTMLInputElement>('input[name="ov-mode"]').forEach((r) => (r.checked = r.value === hud.mode));
    settingsEl.querySelectorAll<HTMLButtonElement>("[data-scale]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.scale) === hud.scale)));
    saveHudPrefs(hud);
  };
  const cycleOverlayMode = () => {
    const i = OVERLAY_MODES.findIndex((m) => m.id === hud.mode);
    hud.mode = OVERLAY_MODES[(i + 1) % OVERLAY_MODES.length].id;
    applyOverlay();
  };
  settingsEl.querySelectorAll<HTMLInputElement>('input[name="ov-mode"]').forEach((r) =>
    r.addEventListener("change", () => {
      hud.mode = r.value as OverlayMode;
      applyOverlay();
    }),
  );
  settingsEl.querySelectorAll<HTMLButtonElement>("[data-scale]").forEach((b) =>
    b.addEventListener("click", () => {
      hud.scale = Number(b.dataset.scale) as OverlayScale;
      applyOverlay();
    }),
  );
  applyOverlay();

  // Painel do robô recolhível (fica só o título, para liberar a tela)
  const robotPanel = q("[data-robot-panel]");
  const robotToggle = q<HTMLButtonElement>("[data-robot-toggle]");
  const applyRobotPanel = () => {
    robotPanel.classList.toggle("collapsed", hud.robotPanelCollapsed);
    robotToggle.setAttribute("aria-expanded", String(!hud.robotPanelCollapsed));
    saveHudPrefs(hud);
  };
  robotToggle.addEventListener("click", () => {
    hud.robotPanelCollapsed = !hud.robotPanelCollapsed;
    applyRobotPanel();
  });
  applyRobotPanel();

  const toastArea = q(".toast-area");
  let lastToasts = "";
  const onView = (view: GameView) => {
    const { red, blue } = view.score;
    q('[data-score="red"]').textContent = String(red.total);
    q('[data-score="blue"]').textContent = String(blue.total);
    q('[data-bonus="red"]').innerHTML = bonusHtml(red);
    q('[data-bonus="blue"]').innerHTML = bonusHtml(blue);
    q(".ov-timer").textContent = view.clockText;
    q(".ov-phase").textContent = view.settling ? "Apurando…" : view.clock.flowerUnlocked && view.mode === "match" && view.clock.phase === "teleop" ? "TELEOP · FLOWERS" : view.phaseLabel;
    q(".ov-center").classList.toggle("unlocked", view.clock.flowerUnlocked);

    q("[data-hopper]").innerHTML = [0, 1, 2, 3]
      .map((i) => `<i class="${view.hopper[i] ?? ""}" title="${view.hopper[i] ? HOPPER_LABEL[view.hopper[i]] : "vazio"}"></i>`)
      .join("");
    q("[data-intake]").textContent = view.intakeOn ? "coletando" : "parado";
    q("[data-launcher]").textContent = `${view.launcherSpeed.toFixed(1)} m/s · ${Math.round(view.launcherPitch)}°`;
    q("[data-burst]").textContent = `${view.launchIntervalS.toFixed(2).replace(".", ",")} s entre bolas${view.bursting ? " · lançando…" : ""}`;
    q("[data-nectar]").textContent = `${view.nectarAvailable} de ${view.nectarInArea} na área`;
    q("[data-camera]").textContent = view.cameraLabel;
    q("[data-drive]").textContent = view.relativeDrive ? "relativa à câmera" : "relativa ao robô";
    q("[data-fps]").textContent = String(view.fps);

    const foulsEl = q("[data-fouls]");
    foulsEl.hidden = view.fouls.length === 0;
    foulsEl.innerHTML = `<h4>Faltas</h4>${view.fouls.slice(-3).map((f) => `<div>${f.clock} ${f.rule} — ${escapeHtml(f.text)}</div>`).join("")}`;

    const overlayRect = q(".ov-main").getBoundingClientRect();
    const stageRect = q(".stage-host").getBoundingClientRect();
    const hive = view.hiveRect
      ? { left: view.hiveRect.left + stageRect.left, right: view.hiveRect.right + stageRect.left, top: view.hiveRect.top + stageRect.top, bottom: view.hiveRect.bottom + stageRect.top }
      : null;
    overlayEl.classList.toggle("ov-dim", hud.mode !== "hidden" && !!hive && rectsOverlap(hive, overlayRect));

    const toasts = view.messages.slice(-3).join("|");
    if (toasts !== lastToasts) {
      lastToasts = toasts;
      toastArea.innerHTML = view.messages.slice(-3).map((m) => `<div class="toast">${escapeHtml(m)}</div>`).join("");
    }
  };

  game = await Game.create(q(".stage-host"), options, { onView, onFinished, onPauseRequest: () => (modal.innerHTML ? null : pauseMenu()), onOverlayModeRequest: cycleOverlayMode });
  game.bindTouch(q("[data-touch]"));

  root.querySelector('[data-act="pause"]')!.addEventListener("click", pauseMenu);
  root.querySelector('[data-act="camera"]')!.addEventListener("click", () => game?.setCamera());
  root.querySelector('[data-act="overlay"]')!.addEventListener("click", (e) => {
    settingsEl.hidden = !settingsEl.hidden;
    (e.currentTarget as HTMLElement).setAttribute("aria-expanded", String(!settingsEl.hidden));
  });
  root.querySelector('[data-act="help"]')!.addEventListener("click", () => {
    const help = q("[data-help]");
    help.hidden = !help.hidden;
  });
  root.querySelector('[data-act="touch"]')!.addEventListener("click", () => q("[data-touch]").classList.toggle("show"));

  const onKey = (e: KeyboardEvent) => {
    if (e.code === "KeyR" && !modal.innerHTML) actions.restart(options);
  };
  window.addEventListener("keydown", onKey);

  if (options.mode === "match") startPrompt();

  return () => {
    window.removeEventListener("keydown", onKey);
    game?.dispose();
    game = null;
  };
}
