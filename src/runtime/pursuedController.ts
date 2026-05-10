import type { Object3D, Scene } from 'three';
import type { MapData } from '../types/map';
import type { PursuedState } from '../types/pursued';
import type { LoadedModel } from './modelLoader';
import { loadModel } from './modelLoader';
import { ANIMAL_TYPES } from '../config/animalConfig';
import {
  createFallbackMesh,
  setupLoadedModel,
  updatePositionAndRotation,
  updateWalkIdleAnimation,
  type UpdateState
} from './animalControllerShared';

export interface PursuedController {
  updatePursued: (pursued: PursuedState) => void;
  setScale: (scale: number) => void;
  setRotationSpeed: (radPerSec: number) => void;
  getObject: () => Object3D | null;
  getLoadedModel: () => LoadedModel | null;
}

export function createPursuedController(
  scene: Scene,
  mapData: MapData,
  pursued?: PursuedState
): PursuedController {
  let obj: Object3D | null = null;
  let loadedModel: LoadedModel | null = null;
  let rotationSpeed = 8.0;
  let currentScale = pursued ? (ANIMAL_TYPES[pursued.animalType]?.scale ?? 0.2) : 0.2;

  const updateState: UpdateState = {
    prevX: pursued?.x ?? 0,
    prevY: pursued?.y ?? 0,
    currentAngle: 0,
    lastRotationTime: performance.now(),
    currentAnimName: null,
    walkAction: null,
    idleAction: null,
    groundOffset: 0
  };

  if (pursued) {
    const config = ANIMAL_TYPES[pursued.animalType];
    const color = config?.color ?? 0xff9933;
    const fallbackMesh = createFallbackMesh(
      scene,
      pursued.x,
      pursued.height,
      pursued.y,
      currentScale,
      color
    );
    obj = fallbackMesh;

    const modelPath = config?.modelPath;
    if (modelPath) {
      loadModel(modelPath, pursued.animalType).then((loaded) => {
        if (loaded) {
          const result = setupLoadedModel(
            loaded,
            scene,
            fallbackMesh,
            pursued.x,
            pursued.height,
            pursued.y,
            currentScale
          );
          obj = result.object;
          loadedModel = result.loadedModel;
          updateState.walkAction = result.walkAction;
          updateState.idleAction = result.idleAction;
          updateState.groundOffset = result.groundOffset;

          if (updateState.idleAction) {
            updateState.idleAction.play();
            updateState.currentAnimName = 'idle';
          }
        }
      });
    }
  }

  const updatePursued = (o: PursuedState): void => {
    if (!obj) return;

    updatePositionAndRotation(
      obj,
      o.x,
      o.y,
      o.height,
      o.directionX,
      o.directionY,
      mapData,
      updateState,
      rotationSpeed
    );

    if (!loadedModel) return;

    const isMoving = o.x !== updateState.prevX || o.y !== updateState.prevY;
    updateState.prevX = o.x;
    updateState.prevY = o.y;

    updateState.currentAnimName = updateWalkIdleAnimation(
      isMoving,
      updateState.walkAction,
      updateState.idleAction,
      updateState.currentAnimName
    );
  };

  const setScale = (scale: number): void => {
    currentScale = scale;
    if (obj) {
      obj.scale.set(scale, scale, scale);
    }
  };

  const setRotationSpeed = (radPerSec: number): void => {
    rotationSpeed = radPerSec;
  };

  return {
    updatePursued,
    setScale,
    setRotationSpeed,
    getObject: () => obj,
    getLoadedModel: () => loadedModel
  };
}
