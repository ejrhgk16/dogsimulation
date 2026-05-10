import { LoopOnce } from 'three';
import type { Object3D, AnimationAction, Scene } from 'three';
import type { MapData } from '../types/map';
import type { PursuerState } from '../types/pursuer';
import type { LoadedModel } from './modelLoader';
import { loadModel, createSubClip } from './modelLoader';
import { ANIMAL_TYPES, ANIMAL_HEIGHT_OFFSET } from '../config/animalConfig';
import { HEAD_DOWN_MAX_TERRAIN } from '../config/sceneConfig';
import {
  createFallbackMesh,
  setupLoadedModel,
  updatePositionAndRotation,
  updateWalkIdleAnimation,
  type UpdateState
} from './animalControllerShared';

export interface PursuerController {
  updatePursuer: (pursuer: PursuerState) => void;
  playAnimation: (name: string) => void;
  setScale: (scale: number) => void;
  setRotationSpeed: (radPerSec: number) => void;
  setHeadFrameRanges: (
    downStart: number,
    downEnd: number,
    bobStart: number,
    bobEnd: number,
    raiseStart: number,
    raiseEnd: number
  ) => void;
  getObject: () => Object3D | null;
  getLoadedModel: () => LoadedModel | null;
}

export function createPursuerController(
  scene: Scene,
  mapData: MapData,
  pursuer?: PursuerState
): PursuerController {
  let obj: Object3D | null = null;
  let loadedModel: LoadedModel | null = null;
  let rotationSpeed = 8.0;
  const initialScale = ANIMAL_TYPES['dog']?.scale ?? 0.2;
  let currentScale = initialScale;
  const headActionsMap: Map<string, AnimationAction> = new Map();
  let currentHeadAction: AnimationAction | null = null;
  let pendingHeadRanges: [number, number, number, number, number, number] | null = null;

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

          const headClips: Array<{
            name: string;
            clip: typeof loaded.headDownClip;
          }> = [
            { name: 'HeadDown', clip: loaded.headDownClip },
            { name: 'HeadBobbing', clip: loaded.headBobbingClip },
            { name: 'HeadRaise', clip: loaded.headRaiseClip }
          ];
          for (const { name, clip } of headClips) {
            if (clip) {
              const action = loaded.mixer.clipAction(clip);
              action.setLoop(LoopOnce, 1);
              action.clampWhenFinished = true;
              action.weight = 999;
              headActionsMap.set(name, action);
            }
          }

          if (updateState.idleAction) {
            updateState.idleAction.play();
            updateState.currentAnimName = 'idle';
          }

          if (pendingHeadRanges) {
            const [ds, de, bs, be, rs, re] = pendingHeadRanges;
            pendingHeadRanges = null;
            applyHeadFrameRanges(ds, de, bs, be, rs, re);
          }
        }
      });
    }
  }

  function applyHeadFrameRanges(
    downStart: number,
    downEnd: number,
    bobStart: number,
    bobEnd: number,
    raiseStart: number,
    raiseEnd: number
  ): void {
    if (!loadedModel?.eatingClip) return;

    const eating = loadedModel.eatingClip;
    const fps = 30;
    const ds = downStart / fps;
    const de = downEnd / fps;
    const bs = bobStart / fps;
    const be = bobEnd / fps;
    const rs = raiseStart / fps;
    const re = raiseEnd / fps;

    if (currentHeadAction) {
      currentHeadAction.stop();
      currentHeadAction = null;
    }

    headActionsMap.clear();

    const headDownClip = createSubClip(eating, 'HeadDown', ds, de);
    const headBobbingClip = createSubClip(eating, 'HeadBobbing', bs, be);
    const headRaiseClip = createSubClip(eating, 'HeadRaise', rs, re);

    for (const [name, clip] of [
      ['HeadDown', headDownClip],
      ['HeadBobbing', headBobbingClip],
      ['HeadRaise', headRaiseClip]
    ] as const) {
      const action = loadedModel.mixer.clipAction(clip);
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
      action.weight = 999;
      headActionsMap.set(name, action);
    }

    console.debug(
      `[HeadRanges] Down:${downStart}-${downEnd} Bob:${bobStart}-${bobEnd} Raise:${raiseStart}-${raiseEnd}`
    );
  }

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

  const playAnimation = (name: string): void => {
    if (name === 'HeadDown' && pursuer) {
      const terrainHeight = pursuer.height - ANIMAL_HEIGHT_OFFSET;
      if (terrainHeight > HEAD_DOWN_MAX_TERRAIN) {
        name = 'HeadRaise';
      }
    }
    const action = headActionsMap.get(name);
    if (!action) return;

    action.reset();
    action.weight = 999;
    action.play();
    if (currentHeadAction && currentHeadAction !== action) {
      currentHeadAction.stop();
    }
    currentHeadAction = action;
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

  const setHeadFrameRanges = (
    downStart: number,
    downEnd: number,
    bobStart: number,
    bobEnd: number,
    raiseStart: number,
    raiseEnd: number
  ): void => {
    if (!loadedModel?.eatingClip) {
      pendingHeadRanges = [downStart, downEnd, bobStart, bobEnd, raiseStart, raiseEnd];
      return;
    }
    pendingHeadRanges = null;
    applyHeadFrameRanges(downStart, downEnd, bobStart, bobEnd, raiseStart, raiseEnd);
  };

  return {
    updatePursuer,
    playAnimation,
    setScale,
    setRotationSpeed,
    setHeadFrameRanges,
    getObject: () => obj,
    getLoadedModel: () => loadedModel
  };
}
