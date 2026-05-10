import {
  AmbientLight,
  Color,
  DirectionalLight,
  MOUSE,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
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
import { createRenderLoop } from './renderLoop';

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
  playAnimation: (id: string, name: string) => void;
  pickAnimal: (offsetX: number, offsetY: number) => string | null;
  setHeadFrameRanges: (
    id: string,
    downStart: number,
    downEnd: number,
    bobStart: number,
    bobEnd: number,
    raiseStart: number,
    raiseEnd: number
  ) => void;
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

  const renderLoop = createRenderLoop(renderer, scene, camera, controls, {
    homePosition: new Vector3(0, 25, 35),
    homeTarget: new Vector3(0, 0, 0)
  });

  renderLoop.setOnFrame((dt: number, now: number) => {
    for (const ctrl of controllers.values()) {
      const loadedModel = ctrl.getLoadedModel();
      if (loadedModel?.mixer) {
        loadedModel.mixer.update(dt);
      }
    }
    updateScent(now);
  });

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

  const setAnimalScale = (id: string, scale: number): void => {
    controllers.get(id)?.setScale(scale);
    // Scale scent point size using first animal's scale (kept for backward compat)
    scentVisualizer?.setPointSize(scale * 0.2);
  };

  const setRotationSpeed = (id: string, radPerSec: number): void => {
    controllers.get(id)?.setRotationSpeed(radPerSec);
  };

  const setScentDecayRate = (multiplier: number): void => {
    setTauDecayMultiplier(multiplier);
  };

  const setEmitRate = (multiplier: number): void => {
    setEmitRateMultiplier(multiplier);
  };

  const playAnimation = (id: string, name: string): void => {
    const ctrl = controllers.get(id);
    if (ctrl && 'playAnimation' in ctrl) {
      (ctrl as PursuerController).playAnimation(name);
    }
  };

  const setHeadFrameRanges = (
    id: string,
    downStart: number,
    downEnd: number,
    bobStart: number,
    bobEnd: number,
    raiseStart: number,
    raiseEnd: number
  ): void => {
    const ctrl = controllers.get(id);
    if (ctrl && 'setHeadFrameRanges' in ctrl) {
      (ctrl as PursuerController).setHeadFrameRanges(
        downStart,
        downEnd,
        bobStart,
        bobEnd,
        raiseStart,
        raiseEnd
      );
    }
  };

  const pickAnimal = (offsetX: number, offsetY: number): string | null => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return null;
    const ndcX = (offsetX / w) * 2 - 1;
    const ndcY = -(offsetY / h) * 2 + 1;
    const raycaster = new Raycaster();
    raycaster.setFromCamera(new Vector2(ndcX, ndcY), camera);

    let nearestId: string | null = null;
    let nearestDist = Infinity;

    for (const [id, ctrl] of controllers) {
      const obj = ctrl.getObject();
      if (!obj) continue;

      const hits = raycaster.intersectObjects([obj], true);
      for (const hit of hits) {
        if (hit.distance < nearestDist) {
          nearestDist = hit.distance;
          nearestId = id;
        }
      }
    }

    return nearestId;
  };

  const resetCamera = (): void => {
    renderLoop.resetCamera();
  };

  const resize = () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderLoop.resize(width, height);
  };

  const start = () => {
    renderLoop.start();
  };

  const stop = () => {
    renderLoop.stop();
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
    playAnimation,
    pickAnimal,
    setHeadFrameRanges
  };
}
