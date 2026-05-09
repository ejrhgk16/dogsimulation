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
import type { AnimalState } from '../types/animal';
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
import { createAnimalController } from './animalController';
import { createRenderLoop } from './renderLoop';

export interface SceneRuntime {
  resize: () => void;
  start: () => void;
  stop: () => void;
  updateScent: (now: number) => void;
  updateAnimal: (animal: AnimalState) => void;
  resetCamera: () => void;
  setScentVisible: (visible: boolean) => void;
  setAnimalScale: (scale: number) => void;
  setRotationSpeed: (radPerSec: number) => void;
  setScentDecayRate: (multiplier: number) => void;
  setEmitRate: (multiplier: number) => void;
  playAnimation: (name: string) => void;
  setHeadFrameRanges: (
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
  animal?: AnimalState
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

  // Animal controller and scent visualizer
  const controller = createAnimalController(scene, mapData, animal);

  let scentVisualizer: ScentVisualizer | null = null;
  if (scentState) {
    scentVisualizer = createScentVisualizer(scene, DEFAULT_SCENT_VISUAL_CONFIG, ANIMAL_PROFILES);
  }

  const renderLoop = createRenderLoop(renderer, scene, camera, controls, {
    homePosition: new Vector3(0, 25, 35),
    homeTarget: new Vector3(0, 0, 0)
  });

  renderLoop.setOnFrame((dt: number, now: number) => {
    const loadedModel = controller.getAnimalLoadedModel();
    if (loadedModel?.mixer) {
      loadedModel.mixer.update(dt);
    }
    updateScent(now);
  });

  const updateScent = (now: number): void => {
    if (!scentState || !scentVisualizer) return;
    trimExpiredTrails(scentState, now, DEFAULT_SCENT_PARAMS);
    scentVisualizer.update(scentState.trailPoints, now);
  };

  const updateAnimal = (o: AnimalState): void => {
    controller.updateAnimal(o);
  };

  const setScentVisible = (visible: boolean): void => {
    scentVisualizer?.setVisible(visible);
  };

  const setAnimalScale = (scale: number): void => {
    controller.setAnimalScale(scale);
    scentVisualizer?.setPointSize(scale * 0.2);
  };

  const setRotationSpeed = (radPerSec: number): void => {
    controller.setRotationSpeed(radPerSec);
  };

  const setScentDecayRate = (multiplier: number): void => {
    setTauDecayMultiplier(multiplier);
  };

  const setEmitRate = (multiplier: number): void => {
    setEmitRateMultiplier(multiplier);
  };

  const playAnimation = (name: string): void => {
    controller.playAnimation(name);
  };

  const setHeadFrameRanges = (
    downStart: number,
    downEnd: number,
    bobStart: number,
    bobEnd: number,
    raiseStart: number,
    raiseEnd: number
  ): void => {
    controller.setHeadFrameRanges(downStart, downEnd, bobStart, bobEnd, raiseStart, raiseEnd);
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
    updateAnimal,
    resetCamera,
    setScentVisible,
    setAnimalScale,
    setRotationSpeed,
    setScentDecayRate,
    setEmitRate,
    playAnimation,
    setHeadFrameRanges
  };
}
