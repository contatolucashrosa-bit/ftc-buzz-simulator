// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Palco 3D: renderizador, luzes, câmeras e presets de qualidade para computadores escolares modestos.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
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

export const QUALITY_SETTINGS: Record<Quality, { pixelRatio: number; antialias: boolean; shadows: boolean; sphereSegments: number; physicsHz: number }> = {
  low: { pixelRatio: 0.75, antialias: false, shadows: false, sphereSegments: 10, physicsHz: 60 },
  medium: { pixelRatio: 1, antialias: true, shadows: false, sphereSegments: 14, physicsHz: 120 },
  high: { pixelRatio: 1.5, antialias: true, shadows: true, sphereSegments: 20, physicsHz: 120 },
};

export class Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.05, 60);
  readonly renderer: THREE.WebGLRenderer;
  mode: CameraMode = "audience";
  private readonly orbit: OrbitControls;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    readonly container: HTMLElement,
    readonly quality: Quality,
    private readonly driverSide: "red" | "blue" = "red",
  ) {
    const q = QUALITY_SETTINGS[quality];
    this.renderer = new THREE.WebGLRenderer({ antialias: q.antialias, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.renderer.shadowMap.enabled = q.shadows;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = "stage-canvas";
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x14161b);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x30343c, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-2, 6, 3);
    sun.castShadow = q.shadows;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 });
    this.scene.add(sun);

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.target.set(0, 0.4, 0);
    this.orbit.enabled = false;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.applyCamera();
  }

  resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
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

  private applyCamera(): void {
    this.orbit.enabled = this.mode === "free";
    const sign = this.driverSide === "red" ? -1 : 1;
    if (this.mode === "audience") {
      const k = this.distanceScale();
      this.camera.position.copy(toWorld(0, -150 * k, 95 * k));
      this.camera.lookAt(toWorld(0, -6, 0));
    } else if (this.mode === "driver") {
      const k = this.distanceScale();
      this.camera.position.copy(toWorld(sign * 128 * k, 0, 66 * k));
      this.camera.lookAt(toWorld(sign * 10, 0, 0));
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
      const back = new THREE.Vector3(-Math.cos(follow.heading), 0, Math.sin(follow.heading)).multiplyScalar(1.2);
      const desired = follow.position.clone().add(back).add(new THREE.Vector3(0, 0.75, 0));
      this.camera.position.lerp(desired, 0.15);
      this.camera.lookAt(follow.position.clone().add(new THREE.Vector3(0, 0.25, 0)));
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
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.orbit.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
