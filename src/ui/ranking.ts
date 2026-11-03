// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Placares: ranking de qualificação local e histórico de partidas, com troca por arquivo entre computadores.
import { clearHistory, exportHistory, importHistory, loadHistory, rankTeams, type MatchRecord } from "../match/history";
import { escapeHtml } from "./dom";

const RESULT_LABEL: Record<MatchRecord["result"], string> = { win: "V", loss: "D", tie: "E" };
const num = (v: number, digits = 2) => v.toFixed(digits).replace(".", ",");

export function rankingHtml(): string {
  return `
    <h1>Placares</h1>
    <p class="lead">Ranking de qualificação das partidas jogadas neste aparelho. Para montar o ranking da turma, cada computador exporta o arquivo e um deles importa todos.</p>
    <div class="actions ranking-actions">
      <button class="btn btn-secondary btn-small" data-rk="export">Exportar arquivo</button>
      <label class="btn btn-secondary btn-small">Importar arquivo<input type="file" accept=".json,application/json" data-rk="import" hidden></label>
      <button class="btn btn-secondary btn-small" data-rk="clear">Apagar histórico</button>
      <span class="hint" data-rk-status></span>
    </div>
    <div data-rk-body></div>`;
}

function bodyHtml(records: MatchRecord[]): string {
  if (!records.length) return `<p class="notice">Nenhuma partida completa registrada ainda. Jogue uma partida (Jogar → Começar partida) e ela aparece aqui.</p>`;
  const rows = rankTeams(records);
  const recent = [...records].sort((a, b) => b.playedAt - a.playedAt).slice(0, 20);
  return `
    <h2>Ranking de qualificação</h2>
    <div class="table-wrap"><table class="result-table ranking-table">
      <thead><tr><th>#</th><th>Equipe</th><th>Partidas</th><th title="Ranking Score: média de RANKING POINTS por partida">RS</th><th>Média</th><th>Recorde</th><th>V-D-E</th></tr></thead>
      <tbody>${rows
        .map(
          (r) => `<tr><td>${r.rank}</td><td><strong>${escapeHtml(r.team)}</strong></td><td>${r.matches}</td><td>${num(r.rankingScore)}</td><td>${num(r.averagePoints, 1)}</td><td>${r.highScore}</td><td>${r.wins}-${r.losses}-${r.ties}</td></tr>`,
        )
        .join("")}</tbody>
    </table></div>
    <p class="hint">Ordem: Ranking Score (média de RP), depois média de pontos e maior pontuação. Simplificação dos desempates do manual para o treino solo.</p>
    <h2>Últimas partidas</h2>
    <div class="table-wrap"><table class="result-table">
      <thead><tr><th>Data</th><th>Equipe</th><th>Robô</th><th>Pontos</th><th>AUTO</th><th>TELEOP</th><th>TIPs</th><th>RP</th><th></th></tr></thead>
      <tbody>${recent
        .map(
          (r) => `<tr><td>${new Date(r.playedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td><td>${escapeHtml(r.team)}</td><td>${escapeHtml(r.robot)}</td><td><strong>${r.total}</strong></td><td>${r.autoPoints}</td><td>${r.teleopPoints}</td><td>${r.hiveTips}</td><td>${r.rankingPoints}</td><td>${RESULT_LABEL[r.result]}</td></tr>`,
        )
        .join("")}</tbody>
    </table></div>`;
}

export function bindRanking(root: HTMLElement): void {
  const body = root.querySelector<HTMLElement>("[data-rk-body]")!;
  const status = root.querySelector<HTMLElement>("[data-rk-status]")!;
  const render = (records = loadHistory()) => (body.innerHTML = bodyHtml(records));
  render();

  root.querySelector('[data-rk="export"]')!.addEventListener("click", () => {
    const records = loadHistory();
    if (!records.length) {
      status.textContent = "Não há partidas para exportar.";
      return;
    }
    const url = URL.createObjectURL(new Blob([exportHistory(records)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `buzz-simulator-partidas-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = `${records.length} partida(s) exportada(s).`;
  });

  const input = root.querySelector<HTMLInputElement>('[data-rk="import"]')!;
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const { added, records } = importHistory(await file.text());
      render(records);
      status.textContent = added ? `${added} partida(s) importada(s).` : "Nenhuma partida nova nesse arquivo.";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
    }
    input.value = "";
  });

  root.querySelector('[data-rk="clear"]')!.addEventListener("click", () => {
    if (!confirm("Apagar todas as partidas deste aparelho? Exporte antes se quiser guardar.")) return;
    clearHistory();
    render([]);
    status.textContent = "Histórico apagado.";
  });
}
