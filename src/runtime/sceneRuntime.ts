import {
  AmbientLight,
  Color,
  DirectionalLight,
  MOUSE,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { MapData } from '../types/map';
import type { ScentWorldState } from '../types/scent';
import type { PursuerState } from '../types/pursuer';
import type { PursuedState } from '../types/pursued';
import {
  ANIMAL_PROFILES,
  DEFAULT_SCENT_PARAMS,
  DEFAULT_SCENT_VISUAL_CONFIG,
  setTauDecayMultiplier,
  setEmitRateMultiplier
} from '../config/scentConfig';
import { defaultSceneConfig } from '../config/sceneConfig';
import { buildMap } from './mapBuilder';
import { trimExpiredTrails } from '../services/scentService';
import { createScentVisualizer } from './scentVisualizer';
import type { ScentVisualizer } from './scentVisualizer';
import { createPursuerController } from './pursuerController';
import type { PursuerController } from './pursuerController';
import { createPursuedController } from './pursuedController';
import type { PursuedController } from './pursuedController';
import { emitTrailPoint, emitTrailPointOnMove } from '../services/scentService';
import { movePursued_keyevent } from '../services/pursuedService';
import { getAnimalProfile } from '../config/scentConfig';
// render loop inlined — no separate renderLoop

export interface SceneRuntime {
  resize: () => void;
  start: () => void;
  stop: () => void;
  updateScent: (now: number) => void;
  updatePursuer: (id: string, pursuer: PursuerState) => void;
  updatePursued: (id: string, pursued: PursuedState) => void;
  resetCamera: () => void;
  setScentVisible: (visible: boolean) => void;
  setAnimalScale: (id: string, scale: number) => void;
  setRotationSpeed: (id: string, radPerSec: number) => void;
  setScentDecayRate: (multiplier: number) => void;
  setEmitRate: (multiplier: number) => void;
  setPursuedSpeed: (id: string, speed: number) => void;
}

export function createSceneRuntime(
  canvas: HTMLCanvasElement,
  mapData: MapData,
  scentState?: ScentWorldState,
  pursuers?: PursuerState[],
  pursuedList?: PursuedState[]
): SceneRuntime {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene = new Scene();
  scene.background = new Color(0x2a3028);

  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 25, 35);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.target.set(0, 0, 0);
  controls.mouseButtons = {
    LEFT: MOUSE.PAN,
    MIDDLE: MOUSE.DOLLY,
    RIGHT: MOUSE.ROTATE
  };
  controls.enableZoom = true;
  controls.zoomSpeed = 1.0;

  const ambientLight = new AmbientLight(0xffffff, 0.6);
  const directionalLight = new DirectionalLight(0xfff4ea, 1.2);
  directionalLight.position.set(5, 10, 4);

  const { terrainMesh, obstacleMeshes } = buildMap(mapData, defaultSceneConfig);

  scene.add(ambientLight, directionalLight, terrainMesh);

  if (obstacleMeshes.shaped) scene.add(obstacleMeshes.shaped);
  if (obstacleMeshes.single) scene.add(obstacleMeshes.single);

  // Animal controllers and scent visualizer
  const controllers = new Map<string, PursuerController | PursuedController>();
  if (pursuers) {
    for (const p of pursuers) {
      const ctrl = createPursuerController(scene, mapData, p);
      controllers.set(p.id, ctrl);
    }
  }
  if (pursuedList) {
    for (const p of pursuedList) {
      const ctrl = createPursuedController(scene, mapData, p);
      controllers.set(p.id, ctrl);
    }
  }

  let scentVisualizer: ScentVisualizer | null = null;
  if (scentState) {
    scentVisualizer = createScentVisualizer(scene, DEFAULT_SCENT_VISUAL_CONFIG, ANIMAL_PROFILES);
  }

  // --- Inlined render loop state ---
  const homePosition = new Vector3(0, 25, 35);
  const homeTarget = new Vector3(0, 0, 0);
  let isReturningToHome = false;
  let homeResetDist = 0;
  let shouldResetOnEnd = false;
  let animationFrameId: number | null = null;
  let lastFrameTime = performance.now();
  const keys = new Set<string>();
  window.addEventListener('keydown', (e) => keys.add(e.key));
  window.addEventListener('keyup', (e) => keys.delete(e.key));
  let onFrame: ((deltaTime: number, now: number) => void) | null = null;

  renderer.domElement.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button === 2) shouldResetOnEnd = true;
  });

  controls.addEventListener('start', () => {
    isReturningToHome = false;
  });
  controls.addEventListener('end', () => {
    if (shouldResetOnEnd) {
      homeResetDist = camera.position.distanceTo(controls.target);
      isReturningToHome = true;
      shouldResetOnEnd = false;
    }
  });

  onFrame = (dt: number, now: number) => {
    for (const ctrl of controllers.values()) {
      const loadedModel = ctrl.getLoadedModel();
      if (loadedModel?.mixer) {
        loadedModel.mixer.update(dt);
      }
    }
    updateScent(now);

    if (pursuers) {
      for (const pursuer of pursuers) {
        updatePursuer(pursuer.id, pursuer);
      }
    }

    if (pursuedList && scentState) {
      for (const pursued of pursuedList) {
        movePursued_keyevent(pursued, keys, dt, mapData);
        const profile = getAnimalProfile(pursued.animalType);
        emitTrailPoint(
          scentState,
          pursued.id,
          pursued.animalType,
          pursued.x,
          pursued.y,
          pursued.height,
          dt * 1000,
          now,
          profile
        );
        emitTrailPointOnMove(
          scentState,
          pursued.id,
          pursued.animalType,
          pursued.x,
          pursued.y,
          pursued.height,
          now,
          profile
        );
        updatePursued(pursued.id, pursued);
      }
    }
  };

  // UI panel: scent 갱신 (내부 onFrame에서도 자동 호출)
  const updateScent = (now: number): void => {
    if (!scentState || !scentVisualizer) return;
    trimExpiredTrails(scentState, now, DEFAULT_SCENT_PARAMS);
    scentVisualizer.update(scentState.trailPoints, now);
  };

  const updatePursuer = (id: string, o: PursuerState): void => {
    const ctrl = controllers.get(id);
    if (ctrl && 'updatePursuer' in ctrl) {
      (ctrl as PursuerController).updatePursuer(o);
    }
  };

  const updatePursued = (id: string, o: PursuedState): void => {
    const ctrl = controllers.get(id);
    if (ctrl && 'updatePursued' in ctrl) {
      (ctrl as PursuedController).updatePursued(o);
    }
  };

  const setScentVisible = (visible: boolean): void => {
    scentVisualizer?.setVisible(visible);
  };

  // UI slider: 동물 스케일 조절
  const setAnimalScale = (id: string, scale: number): void => {
    controllers.get(id)?.setScale(scale);
    // Scale scent point size using first animal's scale (kept for backward compat)
    scentVisualizer?.setPointSize(scale * 0.2);
  };

  // UI slider: 회전 보간 속도
  const setRotationSpeed = (id: string, radPerSec: number): void => {
    controllers.get(id)?.setRotationSpeed(radPerSec);
  };

  const setScentDecayRate = (multiplier: number): void => {
    setTauDecayMultiplier(multiplier);
  };

  const setEmitRate = (multiplier: number): void => {
    setEmitRateMultiplier(multiplier);
  };

  const setPursuedSpeed = (id: string, speed: number): void => {
    if (pursuedList) {
      const pursued = pursuedList.find((p) => p.id === id);
      if (pursued) pursued.speed = speed;
    }
  };

  const resetCamera = (): void => {
    homeResetDist = camera.position.distanceTo(controls.target);
    isReturningToHome = true;
  };

  const resize = () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const render = (): void => {
    if (isReturningToHome) {
      const homeDir = new Vector3().subVectors(homePosition, homeTarget).normalize();
      const idealPos = controls.target.clone().addScaledVector(homeDir, homeResetDist);
      camera.position.lerp(idealPos, 0.03);
      const currentDir = new Vector3().subVectors(camera.position, controls.target).normalize();
      if (currentDir.dot(homeDir) > 0.9999) {
        camera.position.copy(idealPos);
        isReturningToHome = false;
      }
    }

    const now = performance.now();
    const dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    onFrame?.(dt, now);

    controls.update();
    renderer.render(scene, camera);
    animationFrameId = window.requestAnimationFrame(render);
  };

  const start = (): void => {
    if (animationFrameId !== null) return;
    render();
  };

  const stop = (): void => {
    if (animationFrameId === null) return;
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  };

  resize();

  return {
    resize,
    start,
    stop,
    updateScent,
    updatePursuer,
    updatePursued,
    resetCamera,
    setScentVisible,
    setAnimalScale,
    setRotationSpeed,
    setScentDecayRate,
    setEmitRate,
    setPursuedSpeed
  };
}
