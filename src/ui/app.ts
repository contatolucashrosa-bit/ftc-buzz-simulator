// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Navegação entre telas. Tudo roda no navegador, sem servidor.
import { APP, DISCLAIMER, loadPrefs, loadStats, savePrefs, type Preferences } from "../config/app";
import { AUTO_PROGRAMS, type AutoProgramId } from "../game/autonomous";
import type { GameMode, GameOptions } from "../game/game";
import type { Quality } from "../render/stage";
import { escapeHtml } from "./dom";
import { ICON_BRAND } from "./icons";
import { LAUNCH_INTERVAL_LIMITS, clampLaunchInterval as clampInterval } from "../config/robotDefaults";
import { ROBOT_PRESETS, ROBOT_PRESET_IDS, robotPreset } from "../config/robotPresets";
import { CAD_PREFIX, listRobots } from "../workshop/robotStore";
import { bindRanking, rankingHtml } from "./ranking";
import { getProject, listProjects, opModeRef, parseOpModeRef, type HardwareUse } from "../java/project";
import type { JavaOpModeRun, JavaSetup } from "../game/game";
import { bindTeamRobots, teamRobotsHtml } from "./teamRobots";
import { BOT_LEVELS, type BotLevel } from "../game/bot";

type Route = "home" | "setup" | "workshop" | "leaderboard" | "teamRobots" | "about";

const NAV: Array<[Route, string]> = [
  ["home", "Início"],
  ["setup", "Jogar"],
  ["workshop", "Oficina"],
  ["leaderboard", "Placares"],
  ["teamRobots", "Robôs da equipe"],
  ["about", "Sobre"],
];

const QUALITY_LABELS: Record<Quality, string> = {
  low: "Baixa — Chromebook, tablet e computadores escolares",
  medium: "Média — notebook comum",
  high: "Alta — sombras e mais detalhes",
};

/**
 * Carrega um módulo sob demanda. Se o app foi atualizado com a aba aberta, os arquivos antigos (com outro
 * hash no nome) somem e o import falha; nesse caso a página recarrega uma vez para pegar a versão nova.
 */
async function importFresh<T>(load: () => Promise<T>): Promise<T> {
  const KEY = "buzz-simulator:reloaded-for-update";
  try {
    const mod = await load();
    sessionStorage.removeItem(KEY);
    return mod;
  } catch (error) {
    const stale = /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(String(error));
    if (stale && !sessionStorage.getItem(KEY)) {
      sessionStorage.setItem(KEY, "1");
      location.reload();
      // a página vai recarregar; não segue com o erro
      return new Promise<T>(() => {});
    }
    throw error;
  }
}

/** Programa do AUTO: um exemplo ou um OpMode Java ("java:<projeto>|<classe>"). */
function readAutoChoice(value: string | undefined, fallback: AutoProgramId): Pick<Preferences, "autoProgram" | "javaAuto"> {
  if (value?.startsWith("java:")) return { autoProgram: fallback, javaAuto: value.slice(5) };
  return { autoProgram: (value as AutoProgramId) ?? "leavePark", javaAuto: "" };
}

/** Robô escolhido na tela "Jogar": um modelo do simulador ou um CAD importado (com os mecanismos guardados). */
function readRobotChoice(input: HTMLInputElement | null): Pick<Preferences, "robotPreset" | "robotModelId"> {
  const value = input?.value ?? "generic";
  if (value.startsWith(CAD_PREFIX)) return { robotPreset: robotPreset(input?.dataset.preset).id, robotModelId: value.slice(CAD_PREFIX.length) };
  return { robotPreset: robotPreset(value).id, robotModelId: "" };
}

export class App {
  private cleanup: (() => void) | null = null;
  private prefs: Preferences = loadPrefs();

  constructor(private readonly root: HTMLElement) {}

  start(): void {
    // Só em desenvolvimento: ?autoplay&quality=high&cam=driver abre direto no treino (capturas de tela sem clique)
    const query = new URLSearchParams(location.search);
    if (import.meta.env.DEV && query.has("autoplay")) {
      const quality = query.get("quality");
      if (quality === "low" || quality === "medium" || quality === "high") this.prefs = { ...this.prefs, quality };
      void this.play("practice").then(() => {
        const cam = query.get("cam");
        const debug = (window as unknown as { __buzz?: { camera(mode: string): void } }).__buzz;
        if (cam && debug) debug.camera(cam);
      });
      return;
    }
    const fromHash = location.hash.replace("#", "") as Route;
    this.go(NAV.some(([r]) => r === fromHash) ? fromHash : "home");
    window.addEventListener("hashchange", () => {
      const r = location.hash.replace("#", "") as Route;
      if (NAV.some(([n]) => n === r)) this.go(r, false);
    });
  }

  private teardown(): void {
    this.cleanup?.();
    this.cleanup = null;
  }

  go(route: Route, pushHash = true): void {
    this.teardown();
    if (pushHash && location.hash !== `#${route}`) history.replaceState(null, "", `#${route}`);
    const pages: Record<Route, () => string> = {
      home: () => this.homeHtml(),
      setup: () => this.setupHtml(),
      workshop: () => `<div data-workshop><p class="lead">Carregando a Oficina…</p></div>`,
      leaderboard: () => rankingHtml(),
      teamRobots: () => teamRobotsHtml(this.prefs.teamNumber),
      about: () => this.aboutHtml(),
    };
    this.root.innerHTML = `${this.navHtml(route)}<main class="page" id="main">${pages[route]()}</main>${this.footerHtml()}`;
    this.bindNav();
    if (route === "setup") this.bindSetup();
    if (route === "workshop") this.mountWorkshop();
    if (route === "leaderboard") bindRanking(this.root);
    if (route === "teamRobots") bindTeamRobots(this.root);
    this.root.querySelectorAll<HTMLElement>("[data-go]").forEach((el) =>
      el.addEventListener("click", () => this.go(el.dataset.go as Route)),
    );
    this.root.querySelectorAll<HTMLElement>("[data-play]").forEach((el) =>
      el.addEventListener("click", () => this.play(el.dataset.play as GameMode)),
    );
    window.scrollTo(0, 0);
  }

  private navHtml(active: Route): string {
    return `
      <header class="topnav">
        <a class="brand" href="#home" data-go="home">${ICON_BRAND}<span>${APP.name}</span></a>
        <nav aria-label="Principal">
          ${NAV.map(([r, label]) => `<button data-go="${r}" ${r === active ? 'aria-current="page"' : ""}>${label}</button>`).join("")}
        </nav>
      </header>`;
  }

  private bindNav(): void {
    this.root.querySelector(".brand")?.addEventListener("click", (e) => e.preventDefault());
  }

  private footerHtml(): string {
    return `
      <footer class="site-footer">
        <div class="inner">
          <span>Criado por <a href="${APP.authorUrl}" target="_blank" rel="noopener">${APP.author}</a>, em parceria com <a href="${APP.partnerUrl}" target="_blank" rel="noopener">${APP.partner}</a>.</span>
          <span>Licença ${APP.license} · v${APP.version} · Projeto independente, não afiliado à <em>FIRST</em>®.</span>
        </div>
      </footer>`;
  }

  private homeHtml(): string {
    const stats = loadStats();
    return `
      <section class="hero">
        <span class="badge">Temporada 2026-2027 · BIOBUZZ™ presented by RTX</span>
        <h1>Buzz <span>Simulator</span></h1>
        <p class="lead">${APP.tagline} Treine o AUTO e o TELEOP do BIOBUZZ™ com as regras do manual oficial, sem precisar do robô físico.</p>
        <div class="actions">
          <button class="btn btn-primary" data-go="setup">Jogar no navegador</button>
          <button class="btn btn-secondary" data-play="practice">Treino livre agora</button>
        </div>
        <ul class="platforms" aria-label="Plataformas">
          <li>Windows</li><li>macOS</li><li>Linux</li><li>Chromebook</li><li>Tablet</li>
        </ul>
        <p class="notice" style="margin-top:16px">Funciona direto no navegador, <strong>sem instalação, sem conta e sem servidor</strong>. Tudo fica neste aparelho.
        ${stats.matchesPlayed > 0 ? `Partidas jogadas neste aparelho: <strong>${stats.matchesPlayed}</strong>.` : ""}</p>
      </section>
      <section class="cards" aria-label="Modos">
        <div class="card"><h3>Treino livre <span class="badge badge-ok">pronto</span></h3><p>Sem relógio: dirija, colete POLLEN, vire a HIVE e encha as FLOWERS no seu ritmo.</p><button class="btn btn-secondary btn-small" data-play="practice">Treinar</button></div>
        <div class="card"><h3>Partida completa <span class="badge badge-ok">pronto</span></h3><p>AUTO de 30 s, transição de 8 s e TELEOP de 2:00, com placar, RANKING POINTS e faltas automáticas.</p><button class="btn btn-secondary btn-small" data-go="setup">Configurar</button></div>
        <div class="card"><h3>Oficina <span class="badge badge-ok">CAD pronto</span></h3><p>Importe o CAD do seu robô (GLB, STL ou STEP) e jogue com ele. Código Java do Android Studio em seguida.</p><button class="btn btn-secondary btn-small" data-go="workshop">Abrir Oficina</button></div>
        <div class="card"><h3>Placares <span class="badge badge-ok">pronto</span></h3><p>Ranking de qualificação deste aparelho, histórico de partidas e ranking da turma por arquivo.</p><button class="btn btn-secondary btn-small" data-go="leaderboard">Ver ranking</button></div>
      </section>
      <p class="notice">${DISCLAIMER}</p>`;
  }

  private setupHtml(): string {
    const p = this.prefs;
    const autoChoices = (Object.keys(AUTO_PROGRAMS) as AutoProgramId[])
      .map(
        (id) => `<label class="choice"><input type="radio" name="auto" value="${id}" ${!p.javaAuto && p.autoProgram === id ? "checked" : ""}>
        <span>${AUTO_PROGRAMS[id].label}<small>${AUTO_PROGRAMS[id].description}</small></span></label>`,
      )
      .join("");
    const robotChoices = ROBOT_PRESET_IDS.map((id) => {
      const r = ROBOT_PRESETS[id];
      return `<label class="choice"><input type="radio" name="robot" value="${id}" ${!p.robotModelId && p.robotPreset === id ? "checked" : ""}>
        <span>${r.label}<small>${r.description}</small></span></label>`;
    }).join("");
    const qualityOptions = (Object.keys(QUALITY_LABELS) as Quality[])
      .map((q) => `<option value="${q}" ${p.quality === q ? "selected" : ""}>${QUALITY_LABELS[q]}</option>`)
      .join("");
    return `
      <h1>Configurar partida</h1>
      <form class="form" data-setup>
        <div class="field">
          <label for="team">Número da equipe</label>
          <input id="team" type="text" inputmode="numeric" maxlength="6" value="${escapeHtml(p.teamNumber)}">
          <small>Aparece no ROBOT SIGN e no placar.</small>
        </div>
        <div class="field">
          <label for="event">Nome do evento (barra superior do placar)</label>
          <input id="event" type="text" maxlength="40" value="${escapeHtml(p.eventName)}">
        </div>
        <fieldset class="field choices">
          <legend>Robô</legend>
          ${robotChoices}
          <div data-imported-robots></div>
          <small>Variantes inspiradas nos starter bots públicos do BIOBUZZ. Os starter bots não pontuam na FLOWER: só tiram POLLEN dela.</small>
        </fieldset>
        <fieldset class="field choices">
          <legend>Robôs na partida</legend>
          <label class="choice"><input type="radio" name="partner" value="bot" ${p.botPartner && !p.partnerPlayer ? "checked" : ""}><span>Parceiro bot na aliança vermelha<small>Coleta POLLEN, lança na sua HIVE e estaciona no fim.</small></span></label>
          <label class="choice"><input type="radio" name="partner" value="player" ${p.partnerPlayer ? "checked" : ""}><span>2º jogador no mesmo computador<small>Teclado: I/K anda, J/L gira, H coleta, Y lança (mira automática), U usa a FLOWER. Ou o 2º controle conectado. No AUTO, o parceiro roda o programa do bot.</small></span></label>
          <label class="choice"><input type="radio" name="partner" value="none" ${!p.botPartner && !p.partnerPlayer ? "checked" : ""}><span>Sem parceiro</span></label>
          <div class="field-row">
            <label for="bot-opponents">Adversários azuis</label>
            <select id="bot-opponents">${[0, 1, 2].map((n) => `<option value="${n}" ${p.botOpponents === n ? "selected" : ""}>${n === 0 ? "nenhum" : `${n} bot${n > 1 ? "s" : ""}`}</option>`).join("")}</select>
            <label for="bot-level">Nível</label>
            <select id="bot-level">${(Object.keys(BOT_LEVELS) as BotLevel[]).map((l) => `<option value="${l}" ${p.botLevel === l ? "selected" : ""}>${BOT_LEVELS[l].label}</option>`).join("")}</select>
          </div>
          <small>Os bots usam os starter bots (goBILDA, REV DUO e AndyMark). O HUMAN PLAYER azul também é do simulador.</small>
        </fieldset>
        <fieldset class="field choices">
          <legend>Programa do AUTO</legend>
          ${autoChoices}
          <div data-java-auto></div>
          <small>Programas de exemplo ou um OpMode @Autonomous do seu projeto Java (importe na Oficina).</small>
        </fieldset>
        <fieldset class="field choices">
          <legend>TELEOP</legend>
          <label class="choice"><input type="radio" name="teleop" value="" ${!p.javaTeleop ? "checked" : ""}><span>Pilotar com teclado ou controle<small>Os comandos do simulador (W A S D, Espaço, F, G…).</small></span></label>
          <div data-java-teleop></div>
          <small>Com um OpMode @TeleOp, o seu código lê o gamepad e comanda o robô, como no Driver Station.</small>
        </fieldset>
        <div class="field">
          <label for="interval">Tempo entre lançamentos (s)</label>
          <input id="interval" type="number" inputmode="decimal" min="${LAUNCH_INTERVAL_LIMITS.min}" max="${LAUNCH_INTERVAL_LIMITS.max}" step="0.05" value="${p.launchIntervalS}">
          <small>Um toque em "lançar" dispara todo o depósito, um elemento após o outro. Este é o tempo que o lançador do seu robô leva para recuperar a velocidade entre duas bolas (cada robô tem seu padrão). Lançadores com volante mais pesado ou mais motores recuperam mais rápido.</small>
        </div>
        <div class="field">
          <label for="quality">Qualidade gráfica</label>
          <select id="quality">${qualityOptions}</select>
          <small>Se o jogo ficar lento, escolha "Baixa".</small>
        </div>
        <div class="actions" style="display:flex;gap:12px;flex-wrap:wrap">
          <button class="btn btn-primary" type="submit" data-mode="match">Começar partida</button>
          <button class="btn btn-secondary" type="button" data-mode="practice">Treino livre</button>
        </div>
      </form>`;
  }

  private bindSetup(): void {
    const form = this.root.querySelector<HTMLFormElement>("[data-setup]")!;
    const read = () => {
      const team = (form.querySelector<HTMLInputElement>("#team")!.value.replace(/\D/g, "") || "24823").slice(0, 6);
      this.prefs = {
        teamNumber: team,
        eventName: form.querySelector<HTMLInputElement>("#event")!.value.trim() || "Treino da equipe",
        ...readAutoChoice(form.querySelector<HTMLInputElement>('input[name="auto"]:checked')?.value, this.prefs.autoProgram),
        javaTeleop: form.querySelector<HTMLInputElement>('input[name="teleop"]:checked')?.value ?? "",
        botPartner: form.querySelector<HTMLInputElement>('input[name="partner"]:checked')?.value === "bot",
        partnerPlayer: form.querySelector<HTMLInputElement>('input[name="partner"]:checked')?.value === "player",
        botOpponents: Number(form.querySelector<HTMLSelectElement>("#bot-opponents")!.value) as 0 | 1 | 2,
        botLevel: form.querySelector<HTMLSelectElement>("#bot-level")!.value as BotLevel,
        quality: form.querySelector<HTMLSelectElement>("#quality")!.value as Quality,
        launchIntervalS: clampInterval(Number(form.querySelector<HTMLInputElement>("#interval")!.value.replace(",", "."))),
        ...readRobotChoice(form.querySelector<HTMLInputElement>('input[name="robot"]:checked')),
      };
      savePrefs(this.prefs);
    };
    // ao trocar de robô, o tempo entre lançamentos volta ao padrão daquele mecanismo
    const bindRobotChange = () =>
      form.querySelectorAll<HTMLInputElement>('input[name="robot"]').forEach((input) =>
        input.addEventListener("change", () => {
          form.querySelector<HTMLInputElement>("#interval")!.value = String(robotPreset(readRobotChoice(input).robotPreset).launchIntervalS);
        }),
      );
    // OpModes Java dos projetos importados na Oficina
    void listProjects().then((projects) => {
      const choice = (name: string, type: "autonomous" | "teleop", current: string) =>
        projects
          .flatMap((proj) =>
            proj.opModes
              .filter((o) => o.type === type && !o.disabled)
              .map((o) => {
                const ref = opModeRef(proj.id, o.className);
                return `<label class="choice"><input type="radio" name="${name}" value="${name === "auto" ? "java:" : ""}${escapeHtml(ref)}" ${current === ref ? "checked" : ""}>
                <span>${escapeHtml(o.name)} <span class="badge badge-ok">Java</span><small>${escapeHtml(proj.name)} · ${escapeHtml(o.className)}</small></span></label>`;
              }),
          )
          .join("");
      const auto = form.querySelector("[data-java-auto]");
      const teleop = form.querySelector("[data-java-teleop]");
      if (auto) auto.innerHTML = choice("auto", "autonomous", this.prefs.javaAuto);
      if (teleop) teleop.innerHTML = choice("teleop", "teleop", this.prefs.javaTeleop);
    });
    // robôs importados na Oficina (IndexedDB) entram depois, sem atrasar a tela
    void listRobots().then((robots) => {
      const slot = form.querySelector("[data-imported-robots]");
      if (!slot || !robots.length) return bindRobotChange();
      slot.innerHTML = robots
        .map(
          (r) => `<label class="choice"><input type="radio" name="robot" value="${CAD_PREFIX}${r.id}" data-preset="${r.preset}" ${this.prefs.robotModelId === r.id ? "checked" : ""}>
          <span>${escapeHtml(r.name)} <span class="badge badge-ok">CAD importado</span><small>${r.sizeIn.length.toFixed(1)} × ${r.sizeIn.width.toFixed(1)} pol · mecanismos: ${escapeHtml(ROBOT_PRESETS[r.preset]?.label ?? r.preset)}</small></span></label>`,
        )
        .join("");
      bindRobotChange();
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      read();
      this.play("match");
    });
    form.querySelector('[data-mode="practice"]')!.addEventListener("click", () => {
      read();
      this.play("practice");
    });
  }

  private async mountWorkshop(): Promise<void> {
    const host = this.root.querySelector<HTMLElement>("[data-workshop]");
    if (!host) return;
    // Three.js só é carregado ao abrir a Oficina
    const { mountWorkshop } = await importFresh(() => import("./workshop"));
    if (!host.isConnected) return;
    this.cleanup = await mountWorkshop(host);
  }

  private aboutHtml(): string {
    return `
      <h1>Sobre</h1>
      <h2>Missão</h2>
      <p>Permitir que estudantes brasileiros pratiquem CAD e programação de robôs do <em>FIRST</em>® Tech Challenge em um só lugar, sem precisar do robô físico, de instalação ou de internet depois do primeiro acesso.</p>
      <h2>Créditos</h2>
      <p>Criado por <a href="${APP.authorUrl}" target="_blank" rel="noopener">${APP.author}</a>, em parceria com <a href="${APP.partnerUrl}" target="_blank" rel="noopener">${APP.partner}</a> (SESI SENAI Chapecó).</p>
      <h2>Regras</h2>
      <p>Fonte da verdade: <em>2026-2027 FIRST® Tech Challenge Competition Manual — BIOBUZZ™ presented by RTX</em>, versão ${APP.manualVersion}. Medidas que o manual não informa (como o peso que vira a HIVE) estão marcadas como suposição no arquivo de regras e serão calibradas com o CAD oficial.</p>
      <h2>Independência de plataforma</h2>
      <p>Roda em qualquer navegador moderno com WebGL 2 — Windows, macOS, Linux, Chromebook e tablets — sem instalar nada.</p>
      <h2>Licença</h2>
      <p>Código sob licença MIT. Cores da paleta oficial <em>FIRST</em> (FIRST Brand Guidelines; FIRST CANOPY™ Brand Guide). Nenhum logotipo ou asset protegido é usado: os modelos 3D e ícones foram recriados para este projeto.</p>
      <h2>Aviso legal</h2>
      <p class="notice">${DISCLAIMER}</p>
      <h2>Contato e comunidade</h2>
      <p>Autor: <a href="${APP.authorUrl}" target="_blank" rel="noopener">${APP.authorUrl.replace("https://", "")}</a> · Equipe: <a href="${APP.partnerUrl}" target="_blank" rel="noopener">westsharksftc.com</a></p>`;
  }

  private async play(mode: GameMode): Promise<void> {
    this.teardown();
    const options: GameOptions = {
      mode,
      quality: this.prefs.quality,
      autoProgram: this.prefs.autoProgram,
      teamNumber: this.prefs.teamNumber,
      eventName: this.prefs.eventName,
      matchLabel: mode === "practice" ? "Treino livre" : "Partida de treino",
      launchIntervalS: clampInterval(this.prefs.launchIntervalS),
      robotPreset: this.prefs.robotPreset,
      robotModelId: this.prefs.robotModelId || undefined,
      bots: { partner: this.prefs.botPartner, partnerPlayer: this.prefs.partnerPlayer, opponents: this.prefs.botOpponents, level: this.prefs.botLevel },
    };
    history.replaceState(null, "", "#play");
    this.root.innerHTML = "";
    if (this.prefs.javaAuto || this.prefs.javaTeleop) {
      const java = await this.prepareJava(mode);
      if (java === "cancel") return;
      if (java) options.java = java;
    }
    const restart = (opts: GameOptions) => {
      this.teardown();
      void this.mountGame(opts, restart);
    };
    await this.mountGame(options, restart);
  }

  /**
   * Compila os OpModes escolhidos antes de abrir a arena (com cache, então da segunda vez é imediato).
   * Devolve "cancel" se a equipe voltou, null para jogar sem o código.
   */
  private async prepareJava(mode: GameMode): Promise<JavaSetup | null | "cancel"> {
    const page = (html: string) => (this.root.innerHTML = `<main class="page">${html}</main>`);
    page(`<h1>Preparando o código Java</h1><p class="lead" data-progress>Abrindo o projeto…</p>`);
    const progress = (text: string) => {
      const el = this.root.querySelector("[data-progress]");
      if (el) el.textContent = text;
    };
    const { compileOpMode } = await importFresh(() => import("../java/javaRuntime"));
    const setup: JavaSetup = { deviceMap: {}, hardware: [] };
    const errors: string[] = [];
    const roles: Array<["auto" | "teleop", string]> = [];
    if (this.prefs.javaAuto && mode === "match") roles.push(["auto", this.prefs.javaAuto]);
    if (this.prefs.javaTeleop) roles.push(["teleop", this.prefs.javaTeleop]);
    const hardware = new Map<string, HardwareUse>();
    for (const [role, ref] of roles) {
      const parsed = parseOpModeRef(ref);
      const project = parsed ? await getProject(parsed.projectId) : undefined;
      const op = project?.opModes.find((o) => o.className === parsed?.className);
      if (!project || !op) {
        errors.push(`O OpMode escolhido para o ${role === "auto" ? "AUTO" : "TELEOP"} não existe mais (projeto removido?).`);
        continue;
      }
      progress(`${op.name}: preparando…`);
      const result = await compileOpMode(project, op, (text) => progress(`${op.name}: ${text}`));
      if (!result.ok) {
        errors.push(`${op.name}:`, ...result.errors.map((e) => `  ${e}`));
        continue;
      }
      const run: JavaOpModeRun = { label: op.name, js: result.js };
      setup[role] = run;
      Object.assign(setup.deviceMap, project.deviceMap);
      project.hardware.forEach((h) => hardware.set(h.name, h));
    }
    setup.hardware = [...hardware.values()];
    if (!errors.length) return setup.auto || setup.teleop ? setup : null;
    return new Promise((resolve) => {
      page(`<h1>O código Java não compilou</h1>
        <pre class="notice java-errors">${escapeHtml(errors.join("\n"))}</pre>
        <div class="actions" style="display:flex;gap:12px;flex-wrap:wrap">
          <button class="btn btn-primary" data-j="without">Jogar sem o código</button>
          <button class="btn btn-secondary" data-j="workshop">Abrir a Oficina</button>
          <button class="btn btn-secondary" data-j="back">Voltar</button>
        </div>`);
      this.root.querySelector('[data-j="without"]')!.addEventListener("click", () => resolve(setup.auto || setup.teleop ? setup : null));
      this.root.querySelector('[data-j="workshop"]')!.addEventListener("click", () => {
        resolve("cancel");
        this.go("workshop");
      });
      this.root.querySelector('[data-j="back"]')!.addEventListener("click", () => {
        resolve("cancel");
        this.go("setup");
      });
    });
  }

  private async mountGame(options: GameOptions, restart: (o: GameOptions) => void): Promise<void> {
    this.root.innerHTML = "";
    try {
      // Carregamento sob demanda: a página inicial abre rápido; Three.js e Rapier só vêm ao entrar na arena.
      this.root.innerHTML = `<main class="page"><p class="lead">Carregando a arena…</p></main>`;
      const { mountGameScreen } = await importFresh(() => import("./gameScreen"));
      this.root.innerHTML = "";
      this.cleanup = await mountGameScreen(this.root, options, { exitToHome: () => this.go("home"), openRanking: () => this.go("leaderboard"), restart });
    } catch (error) {
      console.error(error);
      this.root.innerHTML = `<main class="page"><h1>Não foi possível abrir a arena</h1>
        <p>O navegador precisa de WebGL 2 e WebAssembly. Tente atualizar o navegador ou escolher a qualidade "Baixa".</p>
        <pre class="notice">${escapeHtml(String(error))}</pre>
        <button class="btn btn-primary" data-go="home">Voltar</button></main>`;
      this.root.querySelector("[data-go]")?.addEventListener("click", () => this.go("home"));
    }
  }
}
