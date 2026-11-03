// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Oficina: importar o CAD do robô, orientar, conferir o tamanho (R102) e guardar neste aparelho.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ROBOT_PRESETS, ROBOT_PRESET_IDS, type RobotPresetId } from "../config/robotPresets";
import { BROWSER_STEP_LIMIT_MB, bakeToGlb, guessScale, guessUp, isSupportedCad, normalize, readCadFile, sizeInches, type ImportSettings, type ImportedCad } from "../workshop/cadImport";
import { deleteRobot, listRobots, saveRobot } from "../workshop/robotStore";
import { escapeHtml } from "./dom";
import { bindJavaSection, javaSectionHtml } from "./javaWorkshop";

const START_LIMIT_IN = 18; // R102: cabe num cubo de 18 pol na largada
const INCH = 0.0254;
const UNITS: Array<[number, string]> = [
  [1, "metros"],
  [0.001, "milímetros"],
  [INCH, "polegadas"],
  [0.01, "centímetros"],
];

export async function mountWorkshop(host: HTMLElement): Promise<() => void> {
  host.innerHTML = `
    <h1>Oficina</h1>
    <p class="lead">Importe o CAD e o código Java do seu robô e jogue com eles. Tudo fica guardado só neste aparelho.</p>
    <div class="workshop">
      <section class="panel ws-viewer">
        <div class="ws-canvas" data-canvas>
          <label class="ws-drop" data-drop>
            <input type="file" accept=".glb,.stl,.step,.stp" data-file hidden>
            <strong>Escolher arquivo</strong>
            <span>ou arraste aqui · GLB, STL ou STEP (até ${BROWSER_STEP_LIMIT_MB} MB)</span>
          </label>
        </div>
        <p class="hint" data-status>A seta branca no piso marca a frente do robô. O quadrado azul tem 18 × 18 pol (R102).</p>
      </section>
      <form class="panel form ws-form" data-form>
        <div class="field"><label for="ws-name">Nome</label><input id="ws-name" type="text" maxlength="40" value="Meu robô"></div>
        <div class="field"><label for="ws-unit">Unidade do arquivo</label><select id="ws-unit">${UNITS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select><small>Detectada pelo tamanho; troque se o robô ficar gigante ou minúsculo.</small></div>
        <div class="field"><label for="ws-up">Eixo para cima no arquivo</label><select id="ws-up"><option value="z">Z (STEP, STL, Onshape, SolidWorks)</option><option value="y">Y (GLB, Blender)</option><option value="x">X</option></select></div>
        <div class="field"><span class="label">Frente do robô</span><button type="button" class="btn btn-secondary btn-small" data-rotate>Girar 90°</button> <button type="button" class="btn btn-secondary btn-small" data-top>Ver de cima</button><small>Gire até a seta apontar para o intake. A vista de cima ajuda a conferir.</small></div>
        <div class="field"><label for="ws-preset">Mecanismos (física)</label><select id="ws-preset">${ROBOT_PRESET_IDS.map((id) => `<option value="${id}">${ROBOT_PRESETS[id].label}</option>`).join("")}</select><small>Tração, intake, lançador e retirada na FLOWER que o jogo vai simular com o seu modelo.</small></div>
        <dl class="kv" data-size></dl>
        <button class="btn btn-primary" type="submit" data-save disabled>Guardar robô</button>
      </form>
    </div>
    <section>
      <h2>Robôs importados</h2>
      <div data-list class="ws-list"></div>
    </section>
    ${javaSectionHtml()}
    <section class="notice">
      <strong>STEP grande (montagens de 100 MB ou mais)?</strong> O navegador tem limite de memória para ler STEP.
      Converta antes no computador, com o Node instalado: <code>npm run cad:convert -- robo.step robo.glb</code>,
      e importe o GLB gerado. Também dá para exportar GLB ou STL direto do Onshape, Fusion 360 ou SolidWorks.
    </section>`;

  const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
  const status = q("[data-status]");
  const canvasHost = q("[data-canvas]");
  const fileInput = q<HTMLInputElement>("[data-file]");
  const unit = q<HTMLSelectElement>("#ws-unit");
  const up = q<HTMLSelectElement>("#ws-up");
  const preset = q<HTMLSelectElement>("#ws-preset");
  const nameInput = q<HTMLInputElement>("#ws-name");
  const saveButton = q<HTMLButtonElement>("[data-save]");

  // Pré-visualização
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = "ws-gl";
  canvasHost.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b1e24);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404650, 2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(1, 2, 1.5);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 20);
  camera.position.set(0.75, 0.55, 0.75);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.target.set(0, 0.15, 0);
  const grid = new THREE.GridHelper(1.2, 12, 0x3a3f48, 0x2a2e35);
  scene.add(grid);
  const half = (START_LIMIT_IN * INCH) / 2;
  const limit = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-half, 0.002, -half), new THREE.Vector3(half, 0.002, -half), new THREE.Vector3(half, 0.002, half), new THREE.Vector3(-half, 0.002, half)]),
    new THREE.LineBasicMaterial({ color: 0x0079ff }),
  );
  scene.add(limit);
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0.003, 0), 0.32, 0xffffff, 0.06, 0.04);
  scene.add(arrow);

  let cad: ImportedCad | null = null;
  let fileName = "";
  let yawQuarter = 0;
  let model: THREE.Group | null = null;
  let raf = 0;

  const resize = () => {
    const w = canvasHost.clientWidth || 1;
    const h = canvasHost.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvasHost);
  const loop = () => {
    orbit.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  loop();

  const settings = (): ImportSettings => ({ scale: Number(unit.value), up: up.value as ImportSettings["up"], yawQuarter });

  const refresh = () => {
    if (!cad) return;
    if (model) scene.remove(model);
    model = normalize(cad.raw, settings());
    scene.add(model);
    const s = sizeInches(model);
    const fits = s.length <= START_LIMIT_IN + 0.05 && s.width <= START_LIMIT_IN + 0.05 && s.height <= START_LIMIT_IN + 0.05;
    q("[data-size]").innerHTML = `
      <dt>Comprimento (frente)</dt><dd>${s.length.toFixed(1)} pol</dd>
      <dt>Largura</dt><dd>${s.width.toFixed(1)} pol</dd>
      <dt>Altura</dt><dd>${s.height.toFixed(1)} pol</dd>
      <dt>Triângulos</dt><dd>${cad.triangles.toLocaleString("pt-BR")}</dd>
      <dt>R102 (18 × 18 × 18 pol)</dt><dd class="${fits ? "ok" : "warn"}">${fits ? "cabe" : "passa do limite: confira a unidade ou se o CAD está expandido"}</dd>`;
    saveButton.disabled = false;
  };

  const load = async (file: File) => {
    if (!isSupportedCad(file.name)) {
      status.textContent = "Formato não suportado. Use GLB, STL ou STEP.";
      return;
    }
    status.textContent = `Lendo ${file.name}…`;
    saveButton.disabled = true;
    try {
      cad = await readCadFile(file, (text) => (status.textContent = text));
      fileName = file.name;
      yawQuarter = 0;
      unit.value = String(guessScale(cad.raw));
      up.value = cad.up ?? guessUp(file.name);
      nameInput.value = file.name.replace(/\.[^.]+$/, "").slice(0, 40);
      refresh();
      q("[data-drop]").classList.add("loaded");
      status.textContent = `${file.name} carregado. ${cad.note} Ajuste unidade, eixo e frente, escolha os mecanismos e guarde.`;
    } catch (error) {
      cad = null;
      status.textContent = error instanceof Error ? error.message : String(error);
    }
  };

  fileInput.addEventListener("change", () => fileInput.files?.[0] && load(fileInput.files[0]));
  canvasHost.addEventListener("dragover", (e) => e.preventDefault());
  canvasHost.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) void load(file);
  });
  unit.addEventListener("change", refresh);
  up.addEventListener("change", refresh);
  let topView = false;
  q("[data-top]").addEventListener("click", () => {
    topView = !topView;
    camera.position.set(topView ? 0.001 : 0.75, topView ? 1.3 : 0.55, topView ? 0 : 0.75);
    orbit.target.set(0, topView ? 0 : 0.15, 0);
    q("[data-top]").textContent = topView ? "Ver em 3D" : "Ver de cima";
  });
  q("[data-rotate]").addEventListener("click", () => {
    yawQuarter = (yawQuarter + 1) % 4;
    refresh();
  });

  const renderList = async () => {
    const robots = await listRobots();
    q("[data-list]").innerHTML = robots.length
      ? robots
          .map(
            (r) => `<div class="card ws-item"><h3>${escapeHtml(r.name)}</h3>
            <p>${r.sizeIn.length.toFixed(1)} × ${r.sizeIn.width.toFixed(1)} × ${r.sizeIn.height.toFixed(1)} pol · ${escapeHtml(ROBOT_PRESETS[r.preset]?.label ?? r.preset)}<br><small>${escapeHtml(r.sourceFile)} · ${r.triangles.toLocaleString("pt-BR")} triângulos</small></p>
            <button class="btn btn-secondary btn-small" data-delete="${r.id}">Remover</button></div>`,
          )
          .join("")
      : `<p class="hint">Nenhum robô importado ainda. Depois de guardar, ele aparece na tela "Jogar".</p>`;
    host.querySelectorAll<HTMLButtonElement>("[data-delete]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Remover este robô deste aparelho?")) return;
        await deleteRobot(b.dataset.delete!);
        void renderList();
      }),
    );
  };
  void renderList();

  q<HTMLFormElement>("[data-form]").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!cad || !model) return;
    saveButton.disabled = true;
    status.textContent = "Preparando o modelo…";
    try {
      const { glb, triangles } = await bakeToGlb(model);
      await saveRobot({
        id: crypto.randomUUID(),
        name: nameInput.value.trim() || "Meu robô",
        preset: preset.value as RobotPresetId,
        sizeIn: sizeInches(model),
        sourceFile: fileName,
        triangles,
        createdAt: Date.now(),
        glb,
      });
      status.textContent = `Robô guardado (${(glb.byteLength / 1e6).toFixed(1)} MB). Escolha-o na tela "Jogar".`;
      void renderList();
    } catch (error) {
      status.textContent = `Não foi possível guardar: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      saveButton.disabled = false;
    }
  });

  bindJavaSection(host);

  return () => {
    cancelAnimationFrame(raf);
    observer.disconnect();
    orbit.dispose();
    renderer.dispose();
  };
}
