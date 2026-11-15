// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Tela de jogo: canvas 3D + Score Overlay + HUD + pausa + resultado.
import { Game, type GameOptions, type GameView } from "../game/game";
import { recordMatchPlayed } from "../config/app";
import { ICON_POLLINATOR, ICON_ROBOT, ICON_SWARM } from "./icons";
import { escapeHtml } from "./dom";
import { robotPreset } from "../config/robotPresets";
import type { AllianceScore } from "../scoring/scoring";
import { previousBest, rankTeams, recordFromScore, saveRecord } from "../match/history";
import { REPLAY_SECONDS } from "../game/replay";

/** Tempo total de pausa por aliança numa partida com dois jogadores. */
const PAUSE_BUDGET_S = 30;

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
  openRanking(): void;
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

/**
 * Número do placar que sobe contando (como nas transmissões) e mostra "+N" ao pontuar.
 * Quedas (ex.: reinício) aparecem na hora, sem animação.
 */
class ScoreCounter {
  private shown = 0;
  private target = 0;
  private from = 0;
  private start = 0;
  private raf = 0;

  constructor(private readonly el: HTMLElement) {
    el.textContent = "0";
  }

  set(value: number): void {
    if (value === this.target) return;
    const gain = value - this.target;
    this.target = value;
    if (gain < 0) {
      cancelAnimationFrame(this.raf);
      this.shown = value;
      this.el.textContent = String(value);
      return;
    }
    this.from = this.shown;
    this.start = performance.now();
    this.el.classList.remove("bump");
    void this.el.offsetWidth; // reinicia a animação CSS
    this.el.classList.add("bump");
    const chip = document.createElement("span");
    chip.className = "ov-gain";
    chip.textContent = `+${gain}`;
    this.el.parentElement?.appendChild(chip);
    setTimeout(() => chip.remove(), 1200);
    cancelAnimationFrame(this.raf);
    const tick = () => {
      const k = Math.min(1, (performance.now() - this.start) / 600);
      const eased = 1 - Math.pow(1 - k, 3);
      this.shown = Math.round(this.from + (this.target - this.from) * eased);
      this.el.textContent = String(this.shown);
      if (k < 1) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
  }
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
  const robot = robotPreset(options.robotPreset);
  // o botão G/RB muda conforme o mecanismo da FLOWER do robô escolhido
  const flowerKey = robot.canPlace
    ? { help: "colocar (FLOWER)", button: "Colocar" }
    : robot.flowerRetrieval === "servo"
      ? { help: "servo: tirar POLLEN da FLOWER", button: "Servo" }
      : { help: "", button: "" };
  root.innerHTML = `
    <div class="game" role="application" aria-label="Arena do Buzz Simulator">
      <div class="stage-host"></div>
      <div class="overlay" aria-live="off" data-overlay>
        <div class="ov-top"><span class="ov-event"></span><span class="ov-match"></span><span></span></div>
        <div class="ov-main">
          <div class="ov-alliance blue"><div class="ov-bonus" data-bonus="blue"></div><div class="ov-teams" data-teams="blue"><span>—</span><span>—</span></div><div class="ov-score" data-score="blue">0</div></div>
          <div class="ov-center">${ICON_ROBOT}<div class="ov-timer-wrap"><div class="ov-timer">2:30</div><div class="ov-phase"></div></div></div>
          <div class="ov-alliance red"><div class="ov-bonus" data-bonus="red"></div><div class="ov-teams" data-teams="red"><span data-team></span><span>—</span></div><div class="ov-score" data-score="red">0</div></div>
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
        <button class="icon-btn" data-act="sound" aria-pressed="false">Som (M)</button>
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
            <dt>Modelo</dt><dd>${escapeHtml(robot.label)}</dd>
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
        <div class="panel telemetry" data-telemetry hidden>
          <h4 data-telemetry-title>Telemetria</h4>
          <pre data-telemetry-text></pre>
          ${options.java?.teleop ? `<p class="hint">Gamepad 1 no teclado: W A S D (analógico esquerdo), Q/E (direito), setas (direcional), Espaço/F (gatilhos), H/G (bumpers), I J K L (Y X A B).</p>` : ""}
        </div>
      </div>
      <div class="panel help" data-help ${isTouch ? "hidden" : ""}>
        <h4>Controles</h4>
        <table>
          <tr><td>W A S D</td><td>${robot.drivetrain === "mecanum" ? "mover" : "W S andar · A D não fazem nada (tração tanque)"}</td></tr>
          <tr><td>Q / E</td><td>girar</td></tr>
          <tr><td>Espaço</td><td>intake (segurar)</td></tr>
          <tr><td>F</td><td>lançar tudo em rajada (HIVE)</td></tr>
          ${flowerKey.help ? `<tr><td>G</td><td>${flowerKey.help}</td></tr>` : ""}
          <tr><td>↑ ↓ / ← →</td><td>velocidade / ângulo</td></tr>
          <tr><td>N</td><td>HUMAN PLAYER: NECTAR</td></tr>
          <tr><td>C · O · R · V · M</td><td>câmera · direção · reiniciar · placar · som</td></tr>
          <tr><td>Mouse</td><td>câmera do robô: arrastar gira, roda aproxima</td></tr>
          <tr><td>Gamepad</td><td>analógicos, LT coleta, RT lança, ${flowerKey.button ? `RB ${flowerKey.button.toLowerCase()},` : ""} Y NECTAR; analógico direito ↕ inclina a câmera do robô, R3 + ↔ gira</td></tr>
        </table>
      </div>
      <div class="touch ${isTouch ? "show" : ""}" data-touch>
        <div class="stick" data-stick="move" aria-label="Mover"><div class="knob"></div></div>
        <div class="touch-buttons">
          <button data-action="intake">Coletar</button>
          <button data-action="launch">Lançar</button>
          ${flowerKey.button ? `<button data-action="place">${flowerKey.button}</button>` : ""}
          <button data-action="nectar">NECTAR</button>
        </div>
        <div class="stick" data-stick="turn" aria-label="Girar"><div class="knob"></div></div>
      </div>
      <div class="replay-bar" data-replay hidden>
        <span class="replay-tag">REPLAY</span>
        <button type="button" data-rp="toggle" aria-label="Pausar ou continuar">❚❚</button>
        <button type="button" data-rp="restart" aria-label="Do começo">⟲</button>
        <input type="range" min="0" max="1000" value="0" data-rp="seek" aria-label="Posição do replay">
        <span class="replay-time" data-rp-time>0,0 s</span>
        <span class="replay-speed">${[0.25, 0.5, 1, 2].map((v) => `<button type="button" data-rp-speed="${v}">${String(v).replace(".", ",")}×</button>`).join("")}</span>
        <button type="button" class="replay-exit" data-rp="exit">Sair do replay</button>
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

  // Pausa: livre no jogo solo. Com dois jogadores, cada aliança tem 30 s de pausa para a partida inteira
  // (pode pausar várias vezes; o tempo corre enquanto o menu está aberto e a partida volta sozinha no fim).
  const timedPause = options.mode === "match" && !!options.bots?.partnerPlayer;
  const pauseLeft = { red: PAUSE_BUDGET_S, blue: PAUSE_BUDGET_S };
  let pauseClock = 0;
  let latest: GameView | null = null;
  let matchOver = false;
  const pauseButton = q<HTMLButtonElement>('[data-act="pause"]');
  const showPauseBudget = () => {
    if (!timedPause) return;
    const left = Math.ceil(pauseLeft.red);
    pauseButton.textContent = left > 0 ? `Pausar (Esc) · ${left} s` : "Pausas esgotadas";
    pauseButton.disabled = left <= 0;
  };
  const stopPauseClock = () => {
    clearInterval(pauseClock);
    pauseClock = 0;
  };
  const resume = () => {
    stopPauseClock();
    closeModal();
    game?.setPaused(false);
    showPauseBudget();
  };

  const pauseMenu = () => {
    if (!game) return;
    // o limite só vale com a partida em andamento
    const limited = timedPause && !!latest?.started && !matchOver;
    if (limited && pauseLeft.red <= 0) return;
    game.setPaused(true);
    const score = latest?.score;
    showModal(
      `<div class="pause-menu">
         <span class="pause-tag">${escapeHtml(options.matchLabel)}</span>
         <h2>Partida pausada</h2>
         ${score ? `<div class="pause-score"><span class="red">${score.red.total}</span><span class="clock">${escapeHtml(latest!.clockText)}</span><span class="blue">${score.blue.total}</span></div>` : ""}
         ${limited ? `<div class="pause-budget" role="timer" aria-live="off"><div class="pause-budget-bar"><i data-budget-bar></i></div><p>Pausa da aliança: <strong data-budget></strong> de ${PAUSE_BUDGET_S} s. A partida volta sozinha quando o tempo acabar.</p></div>` : `<p class="pause-note">A física e o relógio estão parados.</p>`}
         <div class="pause-actions">
           <button class="btn btn-primary" data-m="resume">Continuar</button>
           ${limited ? "" : `<button class="btn btn-secondary" data-m="replay">Replay (últimos ${REPLAY_SECONDS} s)</button>`}
           <button class="btn btn-secondary" data-m="help">Controles</button>
           <button class="btn btn-secondary" data-m="restart">Reiniciar</button>
           <button class="btn btn-secondary" data-m="exit">Sair para o início</button>
         </div>
       </div>`,
      (el) => {
        el.querySelector('[data-m="replay"]')?.addEventListener("click", () => openReplay(pauseMenu));
        el.querySelector('[data-m="resume"]')!.addEventListener("click", resume);
        el.querySelector('[data-m="help"]')!.addEventListener("click", () => {
          const help = q("[data-help]");
          help.hidden = !help.hidden;
        });
        el.querySelector('[data-m="restart"]')!.addEventListener("click", () => actions.restart(options));
        el.querySelector('[data-m="exit"]')!.addEventListener("click", () => actions.exitToHome());
        if (!limited) return;
        const label = el.querySelector<HTMLElement>("[data-budget]")!;
        const bar = el.querySelector<HTMLElement>("[data-budget-bar]")!;
        let last = performance.now();
        const tick = () => {
          const now = performance.now();
          pauseLeft.red = Math.max(0, pauseLeft.red - (now - last) / 1000);
          last = now;
          label.textContent = `${pauseLeft.red.toFixed(1).replace(".", ",")} s`;
          bar.style.width = `${(pauseLeft.red / PAUSE_BUDGET_S) * 100}%`;
          if (pauseLeft.red <= 0) resume();
        };
        tick();
        stopPauseClock();
        pauseClock = window.setInterval(tick, 100);
      },
    );
  };

  const startPrompt = () => {
    showModal(
      `<h2>${escapeHtml(options.matchLabel)}</h2>
       <p>O robô <strong>${escapeHtml(options.teamNumber)}</strong> está na posição de largada, com 4 POLLEN pré-carregados (G304).
       O AUTO dura 30 s e roda o programa escolhido; depois de 8 s de transição, você assume no TELEOP (2:00).</p>
       ${options.bots && (options.bots.partner || options.bots.partnerPlayer || options.bots.opponents) ? `<p class="notice">Na arena: ${[options.bots.partnerPlayer && "parceiro pilotado pelo 2º jogador (I/J/K/L, H, Y, U ou 2º controle)", options.bots.partner && !options.bots.partnerPlayer && "1 parceiro bot", options.bots.opponents && `${options.bots.opponents} adversário${options.bots.opponents > 1 ? "s" : ""} bot`].filter(Boolean).join(" e ")}.</p>` : `<p class="notice">Treino solo: sem robôs-bot (ative na tela "Jogar").</p>`}
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
    matchOver = true;
    recordMatchPlayed();
    // a equipe do jogador é a aliança vermelha (treino solo)
    const record = recordFromScore(view.score.red, { team: options.teamNumber, eventName: options.eventName, robot: robot.label, autoProgram: options.autoProgram });
    const history = saveRecord(record);
    const best = previousBest(history, options.teamNumber, record.id);
    const ranking = rankTeams(history);
    const position = ranking.find((r) => r.team === options.teamNumber);
    const showResults = () => {
      const r = view.score.red;
      const b = view.score.blue;
      const headline = r.total > b.total ? "Vitória da aliança vermelha!" : r.total < b.total ? "Vitória da aliança azul" : "Empate";
      const earned = [r.swarm.achieved && "SWARM", r.pollinator1.achieved && "POLLINATOR 1", r.pollinator2.achieved && "POLLINATOR 2", r.result === "win" && "Vitória (3)", r.result === "tie" && "Empate (1)"].filter(Boolean);
      showModal(
        `<div class="result-hero">
           <div class="rh-alliance red"><span>Vermelha · ${escapeHtml(options.teamNumber)}</span><strong>${r.total}</strong></div>
           <div class="rh-center"><h2>${headline}</h2>${best === null || r.total > best ? `<span class="rh-record">${best === null ? "Primeira partida registrada" : `Novo recorde! (antes: ${best})`}</span>` : `<span class="rh-sub">Recorde da equipe: ${best}</span>`}</div>
           <div class="rh-alliance blue"><span>Azul</span><strong>${b.total}</strong></div>
         </div>
         <div class="rh-rp"><div class="ov-bonus">${bonusHtml(r)}</div><span><strong>${r.rankingPoints} RP</strong> ${earned.length ? escapeHtml(earned.join(" · ")) : "nenhum RP nesta partida"}</span></div>
         ${resultRows(view)}
         ${view.fouls.length ? `<h3>Faltas</h3><ul>${view.fouls.map((f) => `<li>${f.clock} — ${f.rule}: ${escapeHtml(f.text)} (${f.penalty === "major" ? "MAJOR" : "MINOR"}, ${f.alliance === "red" ? "vermelha" : "azul"})</li>`).join("")}</ul>` : ""}
         ${position ? `<p class="rh-rank">Ranking de qualificação deste aparelho: <strong>${position.rank}º de ${ranking.length}</strong> · Ranking Score ${position.rankingScore.toFixed(2).replace(".", ",")} em ${position.matches} partida(s).</p>` : ""}
         <div class="actions">
           <button class="btn btn-primary" data-m="again">Jogar de novo</button>
           <button class="btn btn-secondary" data-m="replay">Ver replay (${REPLAY_SECONDS} s)</button>
           <button class="btn btn-secondary" data-m="ranking">Ranking</button>
           <button class="btn btn-secondary" data-m="exit">Início</button>
         </div>`,
        (el) => {
          el.querySelector('[data-m="again"]')!.addEventListener("click", () => actions.restart(options));
          el.querySelector('[data-m="replay"]')!.addEventListener("click", () => openReplay(showResults));
          el.querySelector('[data-m="ranking"]')!.addEventListener("click", () => actions.openRanking());
          el.querySelector('[data-m="exit"]')!.addEventListener("click", () => actions.exitToHome());
        },
      );
    };
    showResults();
  };

  // Replay: barra de controle; ao sair, volta para a tela de onde veio (resultado ou pausa)
  const replayBar = q("[data-replay]");
  let afterReplay: (() => void) | null = null;
  const openReplay = (back: () => void) => {
    if (!game?.startReplay()) {
      showToast("Ainda não há o que reproduzir: jogue alguns segundos primeiro.");
      return;
    }
    closeModal();
    afterReplay = back;
    replayBar.hidden = false;
  };
  const closeReplay = () => {
    game?.stopReplay();
    replayBar.hidden = true;
    const back = afterReplay;
    afterReplay = null;
    back?.();
  };
  replayBar.querySelector('[data-rp="toggle"]')!.addEventListener("click", () => game?.replayControl({ toggle: true }));
  replayBar.querySelector('[data-rp="restart"]')!.addEventListener("click", () => game?.replayControl({ restart: true }));
  replayBar.querySelector('[data-rp="exit"]')!.addEventListener("click", closeReplay);
  const seek = replayBar.querySelector<HTMLInputElement>('[data-rp="seek"]')!;
  seek.addEventListener("input", () => game?.replayControl({ seek: Number(seek.value) / 1000 }));
  replayBar.querySelectorAll<HTMLButtonElement>("[data-rp-speed]").forEach((b) => b.addEventListener("click", () => game?.replayControl({ speed: Number(b.dataset.rpSpeed) })));

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
  let localToast: { text: string; until: number } | null = null;
  const showToast = (text: string) => {
    localToast = { text, until: performance.now() + 2500 };
    lastToasts = "";
  };
  const counters = { red: new ScoreCounter(q('[data-score="red"]')), blue: new ScoreCounter(q('[data-score="blue"]')) };
  const rpState = { red: "", blue: "" };
  const onView = (view: GameView) => {
    latest = view;
    const { red, blue } = view.score;
    for (const alliance of ["red", "blue"] as const) {
      const spans = q(`[data-teams="${alliance}"]`).children;
      for (let i = 0; i < 2; i++) spans[i].textContent = view.teams[alliance][i] ?? "—";
    }
    counters.red.set(red.total);
    counters.blue.set(blue.total);
    for (const [alliance, score] of [["red", red], ["blue", blue]] as const) {
      // ícone de RP acende com animação na hora em que é conquistado
      const key = [score.swarm.achieved, score.pollinator1.achieved, score.pollinator2.achieved].map(Number).join("");
      const el = q(`[data-bonus="${alliance}"]`);
      el.innerHTML = bonusHtml(score);
      if (rpState[alliance] && key !== rpState[alliance]) {
        const names = ["SWARM", "POLLINATOR 1", "POLLINATOR 2"];
        key.split("").forEach((v, i) => {
          if (v === "1" && rpState[alliance][i] === "0") {
            el.children[i]?.classList.add("just-earned");
            if (alliance === "red") showToast(`RANKING POINT conquistado: ${names[i]}`);
          }
        });
      }
      rpState[alliance] = key;
    }
    replayBar.hidden = !view.replay;
    if (view.replay) {
      const rp = view.replay;
      if (document.activeElement !== seek) seek.value = String(Math.round((rp.length ? rp.time / rp.length : 0) * 1000));
      q("[data-rp-time]").textContent = `${rp.time.toFixed(1).replace(".", ",")} / ${rp.length.toFixed(1).replace(".", ",")} s`;
      replayBar.querySelector('[data-rp="toggle"]')!.textContent = rp.playing ? "❚❚" : "▶";
      replayBar.querySelectorAll<HTMLButtonElement>("[data-rp-speed]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.rpSpeed) === rp.speed)));
    }
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

    const telemetryEl = q("[data-telemetry]");
    telemetryEl.hidden = !view.java;
    if (view.java) {
      const j = view.java;
      q("[data-telemetry-title]").textContent = `${j.role === "auto" ? "AUTO" : "TELEOP"} · ${j.label} · ${j.state}`;
      q("[data-telemetry-text]").textContent = j.error ? `Erro: ${j.error}` : j.telemetry.trim() || "(sem telemetria)";
      telemetryEl.classList.toggle("error", !!j.error);
    }
    const foulsEl = q("[data-fouls]");
    foulsEl.hidden = view.fouls.length === 0;
    foulsEl.innerHTML = `<h4>Faltas</h4>${view.fouls.slice(-3).map((f) => `<div>${f.clock} ${f.rule} — ${escapeHtml(f.text)}</div>`).join("")}`;

    const overlayRect = q(".ov-main").getBoundingClientRect();
    const stageRect = q(".stage-host").getBoundingClientRect();
    const hive = view.hiveRect
      ? { left: view.hiveRect.left + stageRect.left, right: view.hiveRect.right + stageRect.left, top: view.hiveRect.top + stageRect.top, bottom: view.hiveRect.bottom + stageRect.top }
      : null;
    overlayEl.classList.toggle("ov-dim", hud.mode !== "hidden" && !!hive && rectsOverlap(hive, overlayRect));

    if (localToast && localToast.until < performance.now()) localToast = null;
    const messages = [...view.messages.slice(-3), ...(localToast ? [localToast.text] : [])];
    const toasts = messages.join("|");
    if (toasts !== lastToasts) {
      lastToasts = toasts;
      toastArea.innerHTML = messages.map((m) => `<div class="toast">${escapeHtml(m)}</div>`).join("");
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

  const soundBtn = q<HTMLButtonElement>('[data-act="sound"]');
  const showSound = (muted: boolean) => {
    soundBtn.textContent = muted ? "Sem som (M)" : "Som (M)";
    soundBtn.setAttribute("aria-pressed", String(muted));
  };
  showSound(game.sound.muted);
  soundBtn.addEventListener("click", () => showSound(game!.toggleMute()));
  const onKey = (e: KeyboardEvent) => {
    if (e.code === "KeyM" && game) showSound(game.toggleMute());
    if (e.code === "KeyR" && !modal.innerHTML) actions.restart(options);
  };
  window.addEventListener("keydown", onKey);

  showPauseBudget();
  if (options.mode === "match") startPrompt();

  return () => {
    stopPauseClock();
    counters.red.dispose();
    counters.blue.dispose();
    window.removeEventListener("keydown", onKey);
    game?.dispose();
    game = null;
  };
}
