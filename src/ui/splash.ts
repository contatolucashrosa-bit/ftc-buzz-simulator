// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Abertura do app: um cartão em blocos sobre um fundo de curvas de nível, no espírito das telas de espera das
// transmissões da temporada. Tudo desenhado aqui: os favos, as curvas e o letreiro são próprios, e os nomes da
// FIRST aparecem só como texto (os logotipos oficiais exigem autorização).
import { APP } from "../config/app";

const SEEN_KEY = "buzz-simulator:splash";
const SHOW_MS = 2600;

/** Favos próprios: 6 hexágonos em colmeia, alguns "cheios". */
function honeycomb(): string {
  const r = 15;
  const hex = (cx: number, cy: number, fill: string) => {
    const points = Array.from({ length: 6 }, (_, i) => `${(cx + r * Math.cos((i * Math.PI) / 3)).toFixed(1)},${(cy + r * Math.sin((i * Math.PI) / 3)).toFixed(1)}`).join(" ");
    return `<polygon points="${points}" fill="${fill}" stroke="#151515" stroke-width="3.5" stroke-linejoin="round"/>`;
  };
  const dx = r * 1.5;
  const dy = r * Math.sqrt(3);
  const cells: Array<[number, number, string]> = [
    [0, -dy, "#f5e400"],
    [-dx, -dy / 2, "#f0ec8f"],
    [dx, -dy / 2, "#c49a1c"],
    [0, 0, "#f5e400"],
    [-dx, dy / 2, "#f5e400"],
    [dx, dy / 2, "#c49a1c"],
    [0, dy, "#f0ec8f"],
  ];
  return `<svg viewBox="-48 -48 96 96" aria-hidden="true">${cells.map(([x, y, fill]) => hex(x, y, fill)).join("")}</svg>`;
}

/** Curvas de nível geradas (anéis irregulares em torno de alguns "morros"), para o fundo. */
function contours(): string {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const paths: string[] = [];
  for (const [cx, cy, rings] of [[620, 610, 7], [150, 180, 5], [1080, 150, 4], [1010, 520, 3]] as const) {
    const wobble = Array.from({ length: 5 }, () => [random() * 0.22, random() * Math.PI * 2]);
    for (let ring = 1; ring <= rings; ring++) {
      const radius = ring * 46;
      const points: string[] = [];
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        const k = 1 + wobble.reduce((sum, [amp, phase], n) => sum + amp * Math.sin(a * (n + 1) + phase), 0) * (0.5 + ring / rings / 2);
        points.push(`${(cx + Math.cos(a) * radius * k * 1.25).toFixed(0)},${(cy + Math.sin(a) * radius * k * 0.8).toFixed(0)}`);
      }
      paths.push(`<polyline points="${points.join(" ")}"/>`);
    }
  }
  return `<svg class="splash-contours" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="#2f6170" stroke-width="2.5">${paths.join("")}</g></svg>`;
}

/** Mostra a abertura uma vez por sessão; some sozinha ou com um clique ou tecla. */
export function showSplash(): void {
  try {
    if (sessionStorage.getItem(SEEN_KEY)) return;
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // sem armazenamento: mostra a cada carregamento
  }
  const el = document.createElement("div");
  el.className = "splash";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", `${APP.name}: simulador da temporada BIOBUZZ`);
  el.innerHTML = `
    ${contours()}
    <div class="splash-card">
      <div class="splash-mark">${honeycomb()}</div>
      <div class="splash-context"><span>Simulador de<br><strong><em>FIRST</em>® Tech Challenge</strong></span><i></i><span>Temporada<br><strong><em>FIRST</em>® CANOPY</strong></span></div>
      <div class="splash-title">${APP.name.replace(" ", "<br>")}</div>
      <div class="splash-credit">Criado por <strong>Lucas Hochmann Rosa</strong> · em parceria com <strong>WestSharksFTC #24823</strong></div>
    </div>
    <p class="splash-hint">Projeto independente, sem vínculo com a <em>FIRST</em>®. Clique ou aperte uma tecla para continuar.</p>`;
  document.body.appendChild(el);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    window.removeEventListener("keydown", close);
    el.classList.add("leaving");
    setTimeout(() => el.remove(), 450);
  };
  el.addEventListener("click", close);
  window.addEventListener("keydown", close);
  setTimeout(close, SHOW_MS);
}
