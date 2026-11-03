// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Palco 3D: renderizador, luzes, câmeras e presets de qualidade para computadores escolares modestos.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { toWorld } from "../sim/geometry";

export type Quality = "low" | "medium" | "high";
export type CameraMode = "audience" | "driver" | "follow" | "top" | "free";

export const CAMERA_LABELS: Record<CameraMode, string> = {
  audience: "Plateia",
  driver: "Piloto",
  follow: "Seguir robô",
  top: "Vista de cima",
  free: "Livre (arraste)",
};

/** Campo de visão por câmera: a do piloto é mais aberta para caber a HIVE (65,6 pol de altura) e o campo perto. */
const CAMERA_FOV: Record<CameraMode, number> = { audience: 40, driver: 62, follow: 60, top: 50, free: 50 };

/** Órbita da câmera "Seguir robô": guinada relativa às costas do robô, inclinação e distância. */
export interface FollowOrbit {
  yaw: number;
  pitch: number;
  distance: number;
}

const DEFAULT_ORBIT: FollowOrbit = { yaw: 0, pitch: 0.5, distance: 1.45 };
const PITCH_LIMITS = [0.08, 1.45] as const;
const DISTANCE_LIMITS = [0.6, 4.5] as const;

/**
 * Presets de qualidade. `shadowSize`: resolução do mapa de sombras (0 = sem sombras);
 * `reflections`: mapa de ambiente para metais e plásticos; `ambientOcclusion`: GTAO no pós-processamento.
 */
export const QUALITY_SETTINGS: Record<Quality, { pixelRatio: number; antialias: boolean; shadows: boolean; shadowSize: number; reflections: boolean; ambientOcclusion: boolean; sphereSegments: number; physicsHz: number }> = {
  low: { pixelRatio: 0.75, antialias: false, shadows: false, shadowSize: 0, reflections: false, ambientOcclusion: false, sphereSegments: 10, physicsHz: 60 },
  medium: { pixelRatio: 1, antialias: true, shadows: true, shadowSize: 1024, reflections: true, ambientOcclusion: false, sphereSegments: 14, physicsHz: 120 },
  high: { pixelRatio: 1.5, antialias: true, shadows: true, shadowSize: 2048, reflections: true, ambientOcclusion: true, sphereSegments: 20, physicsHz: 120 },
};

export class Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.05, 60);
  readonly renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private gtao: GTAOPass | null = null;
  mode: CameraMode = "audience";
  readonly followOrbit: FollowOrbit = { ...DEFAULT_ORBIT };
  private readonly orbit: OrbitControls;
  private readonly resizeObserver: ResizeObserver;
  private readonly cleanup: Array<() => void> = [];

  constructor(
    readonly container: HTMLElement,
    readonly quality: Quality,
    private readonly driverSide: "red" | "blue" = "red",
  ) {
    const q = QUALITY_SETTINGS[quality];
    this.renderer = new THREE.WebGLRenderer({ antialias: q.antialias, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.renderer.shadowMap.enabled = q.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // ACES dá o contraste "de filme" das transmissões: brancos que não estouram e cores mais densas
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.domElement.className = "stage-canvas";
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x14161b);
    // Iluminação de ginásio: luz principal quente e alta (com sombra), contraluz fria e céu suave
    this.scene.add(new THREE.HemisphereLight(0xe4ecff, 0x4a4238, q.reflections ? 0.7 : 2.2));
    const key = new THREE.DirectionalLight(0xfff0dc, q.reflections ? 2.6 : 2.2);
    key.position.set(-2.2, 7, 3.2);
    key.castShadow = q.shadows;
    if (q.shadows) {
      key.shadow.mapSize.set(q.shadowSize, q.shadowSize);
      Object.assign(key.shadow.camera, { left: -2.6, right: 2.6, top: 2.6, bottom: -2.6, near: 2, far: 14 });
      key.shadow.bias = -0.0004;
      key.shadow.normalBias = 0.015;
      key.shadow.radius = 3;
    }
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xbcd4ff, 0.7);
    rim.position.set(3, 4, -4);
    this.scene.add(rim);
    if (q.reflections) {
      // reflexos difusos de um "salão" genérico: metais e plásticos deixam de parecer foscos
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environmentIntensity = 0.55;
      pmrem.dispose();
    }
    if (q.ambientOcclusion) {
      // MSAA no alvo do compositor: o antialias do canvas não vale quando há pós-processamento
      const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(this.renderer, target);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      const gtao = new GTAOPass(this.scene, this.camera, 1, 1);
      this.gtao = gtao;
      gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1, scale: 1.2 });
      gtao.blendIntensity = 0.85;
      this.composer.addPass(gtao);
      this.composer.addPass(new OutputPass());
    }

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.target.set(0, 0.4, 0);
    this.orbit.enabled = false;

    this.bindFollowPointer();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.applyCamera();
  }

  resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(w, h);
    // oclusão em meia resolução: o efeito é suave e custa 1/4 (o cenário inteiro passa pelo GTAO)
    const pr = this.renderer.getPixelRatio();
    this.gtao?.setSize(Math.max(1, Math.round((w * pr) / 2)), Math.max(1, Math.round((h * pr) / 2)));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.mode !== "free" && this.mode !== "follow") this.applyCamera();
  }

  /** Telas em pé (tablet, celular) precisam de câmera mais afastada para caber o campo inteiro. */
  private distanceScale(): number {
    return Math.max(1, 1.45 / Math.max(0.3, this.camera.aspect));
  }

  cycleCamera(): CameraMode {
    const order: CameraMode[] = ["audience", "driver", "follow", "top", "free"];
    this.mode = order[(order.indexOf(this.mode) + 1) % order.length];
    this.applyCamera();
    return this.mode;
  }

  setCamera(mode: CameraMode): void {
    this.mode = mode;
    this.applyCamera();
  }

  /** Mouse/toque na câmera "Seguir robô": arrastar gira, roda aproxima, duplo clique volta ao padrão. */
  private bindFollowPointer(): void {
    const el = this.renderer.domElement;
    let dragging: { id: number; x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      if (this.mode !== "follow" || e.pointerType === "touch") return;
      dragging = { id: e.pointerId, x: e.clientX, y: e.clientY };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // ponteiro sem captura possível (ex.: evento sintético): o arraste funciona do mesmo jeito
      }
    };
    const move = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== dragging.id) return;
      this.adjustFollow(-(e.clientX - dragging.x) * 0.006, (e.clientY - dragging.y) * 0.005, 0);
      dragging.x = e.clientX;
      dragging.y = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (dragging && e.pointerId === dragging.id) dragging = null;
    };
    const wheel = (e: WheelEvent) => {
      if (this.mode !== "follow") return;
      e.preventDefault();
      this.adjustFollow(0, 0, e.deltaY * 0.0012);
    };
    const reset = () => {
      if (this.mode === "follow") this.resetFollow();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("dblclick", reset);
    this.cleanup.push(() => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("dblclick", reset);
    });
  }

  /** Ajusta a órbita da câmera do robô (rad, rad, fator logarítmico de zoom). Usado pelo mouse e pelo analógico. */
  adjustFollow(dYaw: number, dPitch: number, dZoom: number): void {
    const o = this.followOrbit;
    o.yaw = Math.atan2(Math.sin(o.yaw + dYaw), Math.cos(o.yaw + dYaw));
    o.pitch = Math.min(PITCH_LIMITS[1], Math.max(PITCH_LIMITS[0], o.pitch + dPitch));
    o.distance = Math.min(DISTANCE_LIMITS[1], Math.max(DISTANCE_LIMITS[0], o.distance * Math.exp(dZoom)));
  }

  resetFollow(): void {
    Object.assign(this.followOrbit, DEFAULT_ORBIT);
  }

  /** Retângulo (px, relativo ao canvas) que os pontos ocupam na tela; null se estiverem atrás da câmera. */
  screenRect(points: THREE.Vector3[]): { left: number; top: number; right: number; bottom: number } | null {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.updateMatrixWorld();
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    let visible = false;
    for (const p of points) {
      const v = p.clone().project(this.camera);
      if (v.z > 1 || v.z < -1) continue;
      visible = true;
      const x = ((v.x + 1) / 2) * w;
      const y = ((1 - v.y) / 2) * h;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    return visible ? { left, top, right, bottom } : null;
  }

  private applyCamera(): void {
    this.orbit.enabled = this.mode === "free";
    this.camera.fov = CAMERA_FOV[this.mode];
    this.camera.updateProjectionMatrix();
    const sign = this.driverSide === "red" ? -1 : 1;
    if (this.mode === "audience") {
      const k = this.distanceScale();
      // mais longe e com lente mais fechada, como a câmera de transmissão: o campo inteiro e as equipes menores nas bordas
      this.camera.position.copy(toWorld(0, -205 * k, 125 * k));
      this.camera.lookAt(toWorld(0, -6, 0));
    } else if (this.mode === "driver") {
      const k = this.distanceScale();
      // Olho do piloto um pouco acima da cabeça, mirando a meia altura: a HIVE (até 65,6 pol) e o campo perto cabem.
      this.camera.position.copy(toWorld(sign * 126 * k, 0, 72 * k));
      this.camera.lookAt(toWorld(sign * 4, 0, 22));
    } else if (this.mode === "top") {
      this.camera.position.set(0, 5.6 * this.distanceScale(), 0.001);
      this.camera.lookAt(0, 0, 0);
    } else if (this.mode === "free") {
      this.camera.position.copy(toWorld(-90, -110, 90));
      this.orbit.target.set(0, 0.4, 0);
      this.orbit.update();
    }
  }

  /** Atualiza câmeras que dependem do robô (seguir). */
  update(follow?: { position: THREE.Vector3; heading: number }): void {
    if (this.mode === "follow" && follow) {
      const o = this.followOrbit;
      // atrás do robô (heading + π), girado pela guinada da órbita
      const azimuth = follow.heading + Math.PI + o.yaw;
      const horizontal = Math.cos(o.pitch) * o.distance;
      const offset = new THREE.Vector3(Math.cos(azimuth) * horizontal, Math.sin(o.pitch) * o.distance, -Math.sin(azimuth) * horizontal);
      const target = follow.position.clone().add(new THREE.Vector3(0, 0.25, 0));
      this.camera.position.lerp(target.clone().add(offset), 0.2);
      this.camera.lookAt(target);
    }
    if (this.mode === "free") this.orbit.update();
  }

  /** Direção "para frente" da câmera projetada no chão, no sistema do manual (para controle relativo à tela). */
  forwardOnField(): { x: number; y: number } {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    if (this.mode === "top" || Math.hypot(dir.x, dir.z) < 1e-3) return { x: 0, y: 1 };
    const len = Math.hypot(dir.x, dir.z);
    return { x: dir.x / len, y: -dir.z / len };
  }

  render(): void {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.cleanup.forEach((fn) => fn());
    this.resizeObserver.disconnect();
    this.orbit.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
