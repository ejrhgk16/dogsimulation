import type { Object3D, Scene } from 'three';
import type { MapData } from '../types/map';
import type { PursuerState } from '../types/pursuer';
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

export interface PursuerController {
  updatePursuer: (pursuer: PursuerState) => void;
  setScale: (scale: number) => void;
  setRotationSpeed: (radPerSec: number) => void;
  getObject: () => Object3D | null;
  getLoadedModel: () => LoadedModel | null;
}

/** 추적자 3D 컨트롤러 생성 (폴백박스 → GLTF 모델) */
export function createPursuerController(
  scene: Scene,
  mapData: MapData,
  pursuer?: PursuerState
): PursuerController {
  let obj: Object3D | null = null;
  let loadedModel: LoadedModel | null = null;
  let rotationSpeed = ANIMAL_TYPES['dog']?.rotationSpeed ?? 8.0;
  const initialScale = ANIMAL_TYPES['dog']?.scale ?? 0.2;
  let currentScale = initialScale;
  const updateState: UpdateState = {
    prevX: pursuer?.x ?? 0,
    prevY: pursuer?.y ?? 0,
    currentAngle: 0,
    lastRotationTime: performance.now(),
    currentAnimName: null,
    walkAction: null,
    idleAction: null,
    groundOffset: 0
  };

  if (pursuer) {
    const config = ANIMAL_TYPES['dog'];
    const color = config?.color ?? 0xff9933;
    const fallbackMesh = createFallbackMesh(
      scene,
      pursuer.x,
      pursuer.height,
      pursuer.y,
      currentScale,
      color
    );
    obj = fallbackMesh;

    const modelPath = config?.modelPath;
    if (modelPath) {
      loadModel(modelPath, 'dog').then((loaded) => {
        if (loaded) {
          const result = setupLoadedModel(
            loaded,
            scene,
            fallbackMesh,
            pursuer.x,
            pursuer.height,
            pursuer.y,
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

  /** 추적자 위치/회전/애니메이션 갱신 */
  const updatePursuer = (o: PursuerState): void => {
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

  /** 모델 스케일 변경 */
  const setScale = (scale: number): void => {
    currentScale = scale;
    if (obj) {
      obj.scale.set(scale, scale, scale);
    }
  };

  /** 회전 속도 변경 */
  const setRotationSpeed = (radPerSec: number): void => {
    rotationSpeed = radPerSec;
  };

  return {
    updatePursuer,
    setScale,
    setRotationSpeed,
    getObject: () => obj,
    getLoadedModel: () => loadedModel
  };
}
