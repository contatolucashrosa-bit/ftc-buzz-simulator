// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Oficina, parte Java: importar o TeamCode (pasta ou .zip do Android Studio), ver os OpModes, ligar os nomes
// de hardware do código aos dispositivos do robô simulado e testar a compilação.
import { unzipSync, strFromU8 } from "fflate";
import { SIM_DEVICES, buildProject, deleteProject, listProjects, saveProject, type JavaProject } from "../java/project";
import { compileOpMode } from "../java/javaRuntime";
import { escapeHtml } from "./dom";

const LIB_LABEL: Record<string, string> = { sdk: "SDK FTC", pedro: "Pedro Pathing", rrCore: "RoadRunner", dash: "FTC Dashboard", kotlin: "Kotlin (biblioteca)" };

export function javaSectionHtml(): string {
  return `
    <section class="java-section">
      <h2>Código Java (TeamCode)</h2>
      <p>Importe o projeto do Android Studio sem mudar nada: a pasta inteira (ou só a <code>TeamCode</code>) ou um <code>.zip</code>.
      Depois, escolha os OpModes na tela "Jogar". Pedro Pathing e RoadRunner funcionam; Kotlin no código da equipe e visão (câmeras) ainda não.</p>
      <div class="actions">
        <label class="btn btn-secondary btn-small">Importar pasta<input type="file" data-java-dir webkitdirectory multiple hidden></label>
        <label class="btn btn-secondary btn-small">Importar .zip<input type="file" data-java-zip accept=".zip" hidden></label>
        <button type="button" class="btn btn-secondary btn-small" data-java-example>Carregar exemplos</button>
        <span class="hint" data-java-status></span>
      </div>
      <div data-java-list class="java-list"></div>
    </section>`;
}

export function bindJavaSection(host: HTMLElement): void {
  const status = host.querySelector<HTMLElement>("[data-java-status]")!;
  const list = host.querySelector<HTMLElement>("[data-java-list]")!;

  const importEntries = async (name: string, entries: Array<{ path: string; text: string }>) => {
    const project = buildProject(name, entries);
    if (!Object.keys(project.files).length) {
      status.textContent = "Nenhum arquivo .java encontrado.";
      return;
    }
    await saveProject(project);
    status.textContent = `${Object.keys(project.files).length} arquivo(s) e ${project.opModes.length} OpMode(s) importados de "${name}".`;
    void render();
  };

  host.querySelector("[data-java-example]")!.addEventListener("click", async () => {
    // exemplos do próprio simulador (pasta examples/TeamCode), carregados só quando pedidos
    const sources = import.meta.glob("../../examples/TeamCode/**/*.java", { query: "?raw", import: "default" });
    const entries = await Promise.all(Object.entries(sources).map(async ([path, load]) => ({ path: path.replace(/^.*examples\//, ""), text: (await load()) as string })));
    await importEntries("Exemplos do Buzz Simulator", entries);
  });

  host.querySelector<HTMLInputElement>("[data-java-dir]")!.addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const files = [...(input.files ?? [])].filter((f) => f.name.endsWith(".java"));
    if (!files.length) {
      status.textContent = "Essa pasta não tem arquivos .java.";
      return;
    }
    status.textContent = "Lendo a pasta…";
    const entries = await Promise.all(files.map(async (f) => ({ path: f.webkitRelativePath || f.name, text: await f.text() })));
    const root = (files[0].webkitRelativePath || "Projeto").split("/")[0];
    await importEntries(root, entries);
    input.value = "";
  });

  host.querySelector<HTMLInputElement>("[data-java-zip]")!.addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    status.textContent = "Abrindo o .zip…";
    try {
      const zip = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: (f) => f.name.endsWith(".java") });
      await importEntries(file.name.replace(/\.zip$/i, ""), Object.entries(zip).map(([path, bytes]) => ({ path, text: strFromU8(bytes) })));
    } catch (error) {
      status.textContent = `Não foi possível abrir o .zip: ${String(error)}`;
    }
    input.value = "";
  });

  const projectHtml = (p: JavaProject) => {
    const ops = p.opModes.filter((o) => !o.disabled);
    const libs = [...new Set(p.libs.map((l) => LIB_LABEL[l]).filter(Boolean))].join(", ");
    return `
      <div class="card java-card" data-project="${p.id}">
        <h3>${escapeHtml(p.name)}</h3>
        <p>${Object.keys(p.files).length} arquivo(s) · ${libs} · importado em ${new Date(p.importedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
        <h4>OpModes</h4>
        ${
          ops.length
            ? `<ul class="java-ops">${ops
                .map(
                  (o) => `<li><span class="badge">${o.type === "teleop" ? "TeleOp" : "Autonomous"}</span> <strong>${escapeHtml(o.name)}</strong> <small>${escapeHtml(o.className)}</small>
                  <button type="button" class="btn btn-secondary btn-small" data-compile="${escapeHtml(o.className)}">Testar compilação</button><div class="java-result" data-result="${escapeHtml(o.className)}"></div></li>`,
                )
                .join("")}</ul>`
            : `<p class="hint">Nenhum OpMode com @TeleOp ou @Autonomous (sem @Disabled).</p>`
        }
        <h4>Hardware do código → robô simulado</h4>
        ${
          p.hardware.length
            ? `<table class="result-table java-map"><thead><tr><th>Nome no código</th><th>Tipo</th><th>Dispositivo simulado</th></tr></thead><tbody>${p.hardware
                .map((h) => {
                  const options = SIM_DEVICES.filter((d) => d.kind === h.kind || (h.kind === "crservo" && d.kind === "servo"))
                    .map((d) => `<option value="${d.id}" ${p.deviceMap[h.name] === d.id ? "selected" : ""}>${d.label}</option>`)
                    .join("");
                  return `<tr><td><code>${escapeHtml(h.name)}</code></td><td>${h.kind}</td><td><select data-map="${escapeHtml(h.name)}"><option value="">nenhum (aceita comandos, lê zero)</option>${options}</select></td></tr>`;
                })
                .join("")}</tbody></table>`
            : `<p class="hint">Nenhuma chamada a hardwareMap encontrada.</p>`
        }
        <p class="hint">Rodas esquerdas montadas espelhadas, como num chassi real: use <code>setDirection(REVERSE)</code> nelas.</p>
        <button type="button" class="btn btn-secondary btn-small" data-delete-project>Remover projeto</button>
      </div>`;
  };

  const render = async () => {
    const projects = await listProjects();
    list.innerHTML = projects.length ? projects.map(projectHtml).join("") : `<p class="hint">Nenhum projeto Java importado ainda.</p>`;
    for (const p of projects) {
      const card = list.querySelector<HTMLElement>(`[data-project="${p.id}"]`)!;
      card.querySelectorAll<HTMLSelectElement>("[data-map]").forEach((sel) =>
        sel.addEventListener("change", async () => {
          if (sel.value) p.deviceMap[sel.dataset.map!] = sel.value;
          else delete p.deviceMap[sel.dataset.map!];
          await saveProject(p);
        }),
      );
      card.querySelectorAll<HTMLButtonElement>("[data-compile]").forEach((btn) =>
        btn.addEventListener("click", async () => {
          const op = p.opModes.find((o) => o.className === btn.dataset.compile)!;
          const out = card.querySelector<HTMLElement>(`[data-result="${CSS.escape(op.className)}"]`)!;
          btn.disabled = true;
          out.className = "java-result";
          const t0 = performance.now();
          const result = await compileOpMode(p, op, (text) => (out.textContent = text));
          btn.disabled = false;
          if (result.ok) {
            out.classList.add("ok");
            out.textContent = result.cached ? "Compila (resultado guardado neste aparelho)." : `Compila em ${((performance.now() - t0) / 1000).toFixed(1).replace(".", ",")} s.`;
          } else {
            out.classList.add("error");
            out.innerHTML = `<strong>Não compilou:</strong><ul>${result.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>`;
          }
        }),
      );
      card.querySelector("[data-delete-project]")!.addEventListener("click", async () => {
        if (!confirm(`Remover o projeto "${p.name}" deste aparelho?`)) return;
        await deleteProject(p.id);
        void render();
      });
    }
  };
  void render();
}
