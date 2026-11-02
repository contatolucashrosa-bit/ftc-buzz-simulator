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

export class App {
  private cleanup: (() => void) | null = null;
  private prefs: Preferences = loadPrefs();

  constructor(private readonly root: HTMLElement) {}

  start(): void {
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
      workshop: () =>
        this.comingSoonHtml(
          "Oficina",
          "Aqui cada equipe vai importar o CAD do próprio robô em STEP (exportado do Onshape, SolidWorks, Fusion 360 ou Inventor), marcar rodas, braços e lançador, passar pela inspeção automática (R102, R105, R503) e importar o projeto Java do Android Studio.",
          "M6 (montagem e inspeção), M5 (Java no navegador) e M11 (STEP avançado)",
        ),
      leaderboard: () =>
        this.comingSoonHtml(
          "Placares",
          "Recordes por modo (AUTO, TELEOP e partida completa) guardados neste aparelho, com replays e exportação de arquivo para montar o ranking da turma. Nada é enviado para a internet.",
          "M8",
        ),
      teamRobots: () =>
        this.comingSoonHtml(
          "Robôs da equipe",
          "Vitrine com o robô da WestSharks #24823 e espaço para outras equipes brasileiras compartilharem os seus, por arquivo .buzzrobot.zip, com autorização e crédito.",
          "M10",
        ),
      about: () => this.aboutHtml(),
    };
    this.root.innerHTML = `${this.navHtml(route)}<main class="page" id="main">${pages[route]()}</main>${this.footerHtml()}`;
    this.bindNav();
    if (route === "setup") this.bindSetup();
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
        <div class="card"><h3>Oficina <span class="badge">em construção</span></h3><p>Importe o CAD do seu robô em STEP e o código Java do Android Studio.</p><button class="btn btn-secondary btn-small" data-go="workshop">Ver plano</button></div>
        <div class="card"><h3>Placares <span class="badge">em construção</span></h3><p>Recordes locais por modo, replays e ranking da turma por arquivo.</p><button class="btn btn-secondary btn-small" data-go="leaderboard">Ver plano</button></div>
      </section>
      <p class="notice">${DISCLAIMER}</p>`;
  }

  private setupHtml(): string {
    const p = this.prefs;
    const autoChoices = (Object.keys(AUTO_PROGRAMS) as AutoProgramId[])
      .map(
        (id) => `<label class="choice"><input type="radio" name="auto" value="${id}" ${p.autoProgram === id ? "checked" : ""}>
        <span>${AUTO_PROGRAMS[id].label}<small>${AUTO_PROGRAMS[id].description}</small></span></label>`,
      )
      .join("");
    const robotChoices = ROBOT_PRESET_IDS.map((id) => {
      const r = ROBOT_PRESETS[id];
      return `<label class="choice"><input type="radio" name="robot" value="${id}" ${p.robotPreset === id ? "checked" : ""}>
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
          <small>Variantes inspiradas nos starter bots públicos do BIOBUZZ. Os starter bots não pontuam na FLOWER: só tiram POLLEN dela.</small>
        </fieldset>
        <fieldset class="field choices">
          <legend>Programa do AUTO</legend>
          ${autoChoices}
          <small>Programas de exemplo. A importação do seu código Java do Android Studio chega no marco M5.</small>
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
        autoProgram: (form.querySelector<HTMLInputElement>('input[name="auto"]:checked')?.value as AutoProgramId) ?? "leavePark",
        quality: form.querySelector<HTMLSelectElement>("#quality")!.value as Quality,
        launchIntervalS: clampInterval(Number(form.querySelector<HTMLInputElement>("#interval")!.value.replace(",", "."))),
        robotPreset: robotPreset(form.querySelector<HTMLInputElement>('input[name="robot"]:checked')?.value).id,
      };
      savePrefs(this.prefs);
    };
    // ao trocar de robô, o tempo entre lançamentos volta ao padrão daquele mecanismo
    form.querySelectorAll<HTMLInputElement>('input[name="robot"]').forEach((input) =>
      input.addEventListener("change", () => {
        form.querySelector<HTMLInputElement>("#interval")!.value = String(robotPreset(input.value).launchIntervalS);
      }),
    );
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

  private comingSoonHtml(title: string, text: string, milestone: string): string {
    return `
      <h1>${title} <span class="badge">em construção</span></h1>
      <p class="lead">${text}</p>
      <p class="notice">Previsto no roadmap: marco ${milestone}. Veja o plano completo em <code>docs/phase-1-analysis.md</code>.</p>
      <button class="btn btn-primary" data-play="practice">Enquanto isso, treinar</button>`;
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
    };
    history.replaceState(null, "", "#play");
    this.root.innerHTML = "";
    const restart = (opts: GameOptions) => {
      this.teardown();
      void this.mountGame(opts, restart);
    };
    await this.mountGame(options, restart);
  }

  private async mountGame(options: GameOptions, restart: (o: GameOptions) => void): Promise<void> {
    this.root.innerHTML = "";
    try {
      // Carregamento sob demanda: a página inicial abre rápido; Three.js e Rapier só vêm ao entrar na arena.
      this.root.innerHTML = `<main class="page"><p class="lead">Carregando a arena…</p></main>`;
      const { mountGameScreen } = await import("./gameScreen");
      this.root.innerHTML = "";
      this.cleanup = await mountGameScreen(this.root, options, { exitToHome: () => this.go("home"), restart });
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
