// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Sons do jogo, sintetizados com a Web Audio API: batidas das bolas, lançamento, TIP da HIVE com torcida,
// pontos e as buzinas da partida. Os avisos de partida usam os sons do FTC Live quando estão neste aparelho.

const PREFS_KEY = "buzz-simulator:sound";
const MAX_IMPACTS_PER_SECOND = 14;

export type Buzzer = "start" | "teleop" | "endgame" | "end";

/** Momentos da partida que têm som próprio nos eventos (os mesmos avisos do sistema de placar oficial). */
export type MatchCue = "matchStart" | "autoEnd" | "controllers" | "countdown" | "teleopStart" | "midMatch" | "endgameWarning" | "matchEnd" | "results";

// Sons de partida do FTC Live, copiados da instalação local por scripts/ftclive-sounds.mjs (ficam fora do git).
// Sem os arquivos, cada momento cai na buzina sintetizada correspondente (ou em silêncio, nos avisos de voz).
const CUE_FILES: Record<MatchCue, string> = {
  matchStart: "charge",
  autoEnd: "endauto",
  controllers: "controllers",
  countdown: "3-2-1",
  teleopStart: "firebell",
  midMatch: "windchimes",
  endgameWarning: "whistle",
  matchEnd: "endmatch",
  results: "results",
};
const CUE_FALLBACK: Partial<Record<MatchCue, Buzzer>> = { matchStart: "start", autoEnd: "end", teleopStart: "teleop", midMatch: "endgame", endgameWarning: "endgame", matchEnd: "end" };

export class SoundBoard {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly samples = new Map<MatchCue, AudioBuffer>();
  private impactBudget = MAX_IMPACTS_PER_SECOND;
  private lastBudgetAt = 0;
  muted: boolean;
  private readonly unlock = () => this.ensure();

  constructor() {
    let muted = false;
    try {
      muted = localStorage.getItem(PREFS_KEY) === "muted";
    } catch {
      // sem armazenamento: começa com som
    }
    this.muted = muted;
    // o navegador só libera áudio depois de um gesto do usuário
    window.addEventListener("pointerdown", this.unlock);
    window.addEventListener("keydown", this.unlock);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.7;
    try {
      localStorage.setItem(PREFS_KEY, this.muted ? "muted" : "on");
    } catch {
      // idem
    }
    return this.muted;
  }

  dispose(): void {
    window.removeEventListener("pointerdown", this.unlock);
    window.removeEventListener("keydown", this.unlock);
    void this.ctx?.close();
    this.ctx = null;
  }

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      this.master.connect(this.ctx.destination);
      this.loadSamples(this.ctx);
      // 1 s de ruído branco, reaproveitado por todos os sons de impacto e torcida
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Carrega os sons de partida, se existirem neste aparelho. */
  private loadSamples(ctx: AudioContext): void {
    for (const [cue, file] of Object.entries(CUE_FILES) as Array<[MatchCue, string]>) {
      fetch(`${import.meta.env.BASE_URL}sounds/ftclive/${file}.flac`)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((data) => {
          // "fLaC" no início: sem o arquivo, o servidor pode devolver a página do app no lugar
          if (!data || new TextDecoder().decode(data.slice(0, 4)) !== "fLaC") return;
          return ctx.decodeAudioData(data).then((buffer) => void this.samples.set(cue, buffer));
        })
        .catch(() => {
          // sem o arquivo ou sem suporte a FLAC: fica a buzina sintetizada
        });
    }
  }

  /** Som de um momento da partida; `delay` em segundos. */
  cue(kind: MatchCue, delay = 0): void {
    const ctx = this.ready();
    if (!ctx) return;
    const sample = this.samples.get(kind);
    if (sample) {
      const source = ctx.createBufferSource();
      source.buffer = sample;
      source.connect(this.master!);
      source.start(ctx.currentTime + delay);
      return;
    }
    const fallback = CUE_FALLBACK[kind];
    if (fallback && delay === 0) this.buzzer(fallback);
  }

  private ready(): AudioContext | null {
    if (this.muted || !this.ctx || this.ctx.state !== "running") return null;
    return this.ctx;
  }

  private envelope(ctx: AudioContext, peak: number, attack: number, decay: number, start = ctx.currentTime): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
    return g;
  }

  private panner(ctx: AudioContext, pan: number): StereoPannerNode {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    return p;
  }

  private noiseBurst(ctx: AudioContext, filterType: BiquadFilterType, freq: number, q: number, gain: GainNode, offset = 0): void {
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    src.connect(filter).connect(gain);
    src.start(ctx.currentTime + offset, Math.random() * 0.5);
    src.stop(ctx.currentTime + offset + 2);
  }

  private tone(ctx: AudioContext, type: OscillatorType, from: number, to: number, start: number, duration: number, peak: number, out: AudioNode): void {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
    const g = this.envelope(ctx, peak, 0.005, duration, start);
    osc.connect(g).connect(out);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  /** Bola de plástico furada batendo: "toc" curto; NECTAR é maior e mais grave. */
  impact(kind: "pollen" | "nectar", strength: number, pan = 0): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = performance.now();
    this.impactBudget = Math.min(MAX_IMPACTS_PER_SECOND, this.impactBudget + ((now - this.lastBudgetAt) / 1000) * MAX_IMPACTS_PER_SECOND);
    this.lastBudgetAt = now;
    if (this.impactBudget < 1) return;
    this.impactBudget--;
    const out = this.panner(ctx, pan);
    out.connect(this.master!);
    const s = Math.min(1, strength);
    const g = this.envelope(ctx, 0.35 * s, 0.002, kind === "pollen" ? 0.06 : 0.09);
    g.connect(out);
    this.noiseBurst(ctx, "bandpass", (kind === "pollen" ? 1400 : 850) * (0.9 + Math.random() * 0.2), 2.5, g);
    this.tone(ctx, "sine", kind === "pollen" ? 420 : 240, kind === "pollen" ? 260 : 140, ctx.currentTime, 0.06, 0.25 * s, out);
  }

  /** Volante do lançador soltando a bola. */
  launch(pan = 0): void {
    const ctx = this.ready();
    if (!ctx) return;
    const out = this.panner(ctx, pan);
    out.connect(this.master!);
    this.tone(ctx, "triangle", 320, 110, ctx.currentTime, 0.14, 0.3, out);
    const g = this.envelope(ctx, 0.18, 0.01, 0.18);
    g.connect(out);
    this.noiseBurst(ctx, "highpass", 1800, 0.7, g);
  }

  /** HIVE virando: batida grave no amortecedor e a torcida comemorando. */
  tip(): void {
    const ctx = this.ready();
    if (!ctx) return;
    this.tone(ctx, "sine", 110, 55, ctx.currentTime, 0.35, 0.6, this.master!);
    this.cheer(1.4);
  }

  cheer(seconds = 1.2): void {
    const ctx = this.ready();
    if (!ctx) return;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    g.connect(this.master!);
    // várias faixas de ruído = muitas vozes ao mesmo tempo
    for (const f of [500, 900, 1500, 2600]) this.noiseBurst(ctx, "bandpass", f, 1.2, g);
  }

  /** Pontos no placar. */
  score(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(ctx, "sine", 880, 880, t, 0.09, 0.12, this.master!);
    this.tone(ctx, "sine", 1320, 1320, t + 0.07, 0.12, 0.12, this.master!);
  }

  buzzer(kind: Buzzer): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime;
    const out = this.master!;
    if (kind === "start") {
      [523, 659, 784].forEach((f, i) => this.tone(ctx, "square", f, f, t + i * 0.16, 0.13, 0.12, out));
      this.cheer(1.6);
    } else if (kind === "teleop") {
      [659, 880].forEach((f, i) => this.tone(ctx, "square", f, f, t + i * 0.18, 0.15, 0.12, out));
    } else if (kind === "endgame") {
      [988, 988, 988].forEach((f, i) => this.tone(ctx, "triangle", f, f, t + i * 0.22, 0.12, 0.16, out));
    } else {
      this.tone(ctx, "sawtooth", 120, 100, t, 1.3, 0.22, out);
      this.cheer(2.2);
    }
  }
}
