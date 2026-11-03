// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Robôs da equipe: troca de robôs da Oficina entre computadores por arquivo .buzzrobot.zip, com crédito.
import { ROBOT_PRESETS } from "../config/robotPresets";
import { getRobot, listRobots, saveRobot, type StoredRobotMeta } from "../workshop/robotStore";
import { packageFileName, packRobot, PACKAGE_EXTENSION, RobotPackageError, unpackRobot } from "../workshop/robotPackage";
import { escapeHtml } from "./dom";

const num = (v: number) => v.toFixed(1).replace(".", ",");

export function teamRobotsHtml(teamNumber: string): string {
  return `
    <h1>Robôs da equipe</h1>
    <p class="lead">Leve um robô montado na Oficina para outro computador, ou receba o de outra equipe. O pacote <code>${PACKAGE_EXTENSION}</code> tem o modelo 3D, as medidas, os mecanismos e o crédito de quem fez. Nada é enviado para a internet: o arquivo vai por pen drive, e-mail ou drive da escola.</p>
    <fieldset class="field choices team-credits">
      <legend>Crédito nos pacotes que você exportar</legend>
      <div class="field-row">
        <label for="tr-team">Equipe</label>
        <input id="tr-team" type="text" maxlength="80" value="${escapeHtml(teamNumber ? `#${teamNumber}` : "")}">
        <label for="tr-author">Autor do CAD</label>
        <input id="tr-author" type="text" maxlength="80" placeholder="nome ou subequipe">
      </div>
      <small>Só compartilhe o CAD de outra equipe com a autorização dela.</small>
    </fieldset>
    <div class="actions">
      <label class="btn btn-secondary btn-small">Importar ${PACKAGE_EXTENSION}<input type="file" accept=".zip,application/zip" data-tr="import" hidden multiple></label>
      <button class="btn btn-secondary btn-small" data-go="workshop">Abrir a Oficina</button>
      <span class="hint" data-tr-status role="status"></span>
    </div>
    <div data-tr-list></div>
    <h2>Vitrine</h2>
    <p class="notice">A vitrine com o robô da WestSharksFTC #24823 e de outras equipes brasileiras entra aqui quando cada equipe autorizar a publicação do próprio CAD. Até lá, troque robôs pelos pacotes acima.</p>`;
}

function listHtml(robots: StoredRobotMeta[]): string {
  if (!robots.length) return `<p class="notice">Nenhum robô neste computador. Importe um CAD na Oficina ou um pacote ${PACKAGE_EXTENSION} acima.</p>`;
  return `<div class="table-wrap"><table class="result-table">
    <thead><tr><th>Robô</th><th>Mecanismos</th><th>Medidas (pol)</th><th>Crédito</th><th></th></tr></thead>
    <tbody>${robots
      .map((r) => {
        const credit = r.credits && (r.credits.team || r.credits.author) ? [r.credits.team, r.credits.author].filter(Boolean).map(escapeHtml).join(" · ") : "—";
        return `<tr>
          <td><strong>${escapeHtml(r.name)}</strong><br><small>${escapeHtml(r.sourceFile)}</small></td>
          <td>${escapeHtml(ROBOT_PRESETS[r.preset]?.label ?? r.preset)}</td>
          <td>${num(r.sizeIn.length)} × ${num(r.sizeIn.width)} × ${num(r.sizeIn.height)}</td>
          <td>${credit}</td>
          <td><button class="btn btn-secondary btn-small" data-tr-export="${escapeHtml(r.id)}">Exportar</button></td>
        </tr>`;
      })
      .join("")}</tbody>
  </table></div>`;
}

export function bindTeamRobots(root: HTMLElement): void {
  const list = root.querySelector<HTMLElement>("[data-tr-list]")!;
  const status = root.querySelector<HTMLElement>("[data-tr-status]")!;
  const refresh = async () => {
    list.innerHTML = listHtml(await listRobots());
  };
  void refresh();

  list.addEventListener("click", async (event) => {
    const id = (event.target as HTMLElement).closest<HTMLElement>("[data-tr-export]")?.dataset.trExport;
    if (!id) return;
    const robot = await getRobot(id);
    if (!robot) return;
    const credits = {
      team: root.querySelector<HTMLInputElement>("#tr-team")!.value.trim() || robot.credits?.team || "",
      author: root.querySelector<HTMLInputElement>("#tr-author")!.value.trim() || robot.credits?.author || "",
    };
    const zip = packRobot(robot, credits);
    const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = packageFileName(robot.name);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = `"${robot.name}" exportado (${(zip.byteLength / 1024 / 1024).toFixed(1).replace(".", ",")} MB).`;
  });

  const input = root.querySelector<HTMLInputElement>('[data-tr="import"]')!;
  input.addEventListener("change", async () => {
    const files = [...(input.files ?? [])];
    const done: string[] = [];
    const errors: string[] = [];
    for (const file of files) {
      try {
        const robot = unpackRobot(new Uint8Array(await file.arrayBuffer()), crypto.randomUUID());
        await saveRobot(robot);
        done.push(robot.name);
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof RobotPackageError ? error.message : "não foi possível ler o arquivo."}`);
      }
    }
    input.value = "";
    status.textContent = [done.length ? `Importado: ${done.join(", ")}. Ele já aparece em Jogar → Robô.` : "", ...errors].filter(Boolean).join(" ");
    await refresh();
  });
}
