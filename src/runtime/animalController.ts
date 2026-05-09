import {
  Box3,
  BoxGeometry,
  LoopOnce,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3
} from 'three';
import type { Object3D, AnimationAction, Scene } from 'three';
import type { MapData } from '../types/map';
import type { AnimalState } from '../types/animal';
import { ANIMAL_TYPES, ANIMAL_HEIGHT_OFFSET } from '../config/animalConfig';
import { HEAD_DOWN_MAX_TERRAIN } from '../config/sceneConfig';
import { getTerrainNormal } from '../services/mapService';
import { loadModel, createSubClip } from './modelLoader';
import type { LoadedModel } from './modelLoader';

const CROSSFADE_DURATION = 0.2;

export interface AnimalController {
  updateAnimal: (animal: AnimalState) => void;
  playAnimation: (name: string) => void;
  setAnimalScale: (scale: number) => void;
  setRotationSpeed: (speed: number) => void;
  setHeadFrameRanges: (
    downStart: number,
    downEnd: number,
    bobStart: number,
    bobEnd: number,
    raiseStart: number,
    raiseEnd: number
  ) => void;
  getAnimalObject: () => Object3D | null;
  getAnimalLoadedModel: () => LoadedModel | null;
}

export function createAnimalController(
  scene: Scene,
  mapData: MapData,
  animal?: AnimalState
): AnimalController {
  let animalObject: Object3D | null = null;
  let animalLoadedModel: LoadedModel | null = null;
  let animalWalkAction: AnimationAction | null = null;
  let animalIdleAction: AnimationAction | null = null;
  let currentAnimName: string | null = null;
  const headActionsMap: Map<string, AnimationAction> = new Map();
  let currentHeadAction: AnimationAction | null = null;
  let prevAnimalX = animal?.x ?? 0;
  let prevAnimalY = animal?.y ?? 0;
  let rotationSpeed = 8.0;
  let groundOffset = ANIMAL_HEIGHT_OFFSET;
  let currentAngle = 0;
  let lastRotationTime = performance.now();
  const initialScale = animal ? (ANIMAL_TYPES[animal.animalType]?.scale ?? 0.2) : 0.2;
  let animalScale = initialScale;

  if (animal) {
    const config = ANIMAL_TYPES[animal.animalType];
    const color = config?.color ?? 0xff9933;
    const geo = new BoxGeometry(0.5, 0.5, 0.5);
    const mat = new MeshStandardMaterial({ color });
    const fallbackMesh = new Mesh(geo, mat);
    fallbackMesh.position.set(animal.x, animal.height, animal.y);
    fallbackMesh.scale.set(animalScale, animalScale, animalScale);
    scene.add(fallbackMesh);
    animalObject = fallbackMesh;

    const modelPath = config?.modelPath;
    if (modelPath) {
      loadModel(modelPath).then((loaded) => {
        if (loaded) {
          scene.remove(fallbackMesh);
          loaded.group.position.set(animal.x, 0, animal.y);
          loaded.group.scale.set(animalScale, animalScale, animalScale);
          const box = new Box3().setFromObject(loaded.group);
          groundOffset = -box.min.y;
          const terrainHeight = animal.height - ANIMAL_HEIGHT_OFFSET;
          loaded.group.position.set(animal.x, terrainHeight + groundOffset, animal.y);
          scene.add(loaded.group);
          animalObject = loaded.group;
          animalLoadedModel = loaded;

          const walkClip =
            loaded.animations.find((c) => c.name.toLowerCase().includes('walk')) ?? null;
          const idleClip =
            loaded.animations.find(
              (c) => c.name.toLowerCase().includes('idle') || c.name.toLowerCase().includes('stand')
            ) ?? null;

          animalWalkAction = walkClip ? loaded.mixer.clipAction(walkClip) : null;
          animalIdleAction = idleClip ? loaded.mixer.clipAction(idleClip) : null;

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

          if (animalIdleAction) {
            animalIdleAction.play();
            currentAnimName = 'idle';
          }
        }
      });
    }
  }

  function crossFadeTo(nextAction: AnimationAction, prevAction: AnimationAction | null): void {
    nextAction.reset();
    nextAction.play();
    if (prevAction) {
      nextAction.crossFadeFrom(prevAction, CROSSFADE_DURATION, false);
    }
  }

  const updateAnimal = (o: AnimalState): void => {
    if (!animalObject) return;
    const terrainY = o.height - ANIMAL_HEIGHT_OFFSET;
    animalObject.position.set(o.x, terrainY + groundOffset, o.y);

    const now = performance.now();
    const dt = (now - lastRotationTime) / 1000;
    lastRotationTime = now;

    const moving = o.directionX !== 0 || o.directionY !== 0;
    if (moving) {
      const targetAngle = Math.atan2(o.directionX, o.directionY);
      const diff = targetAngle - currentAngle;
      const wrapped = Math.atan2(Math.sin(diff), Math.cos(diff));
      const step = rotationSpeed * dt;
      if (Math.abs(wrapped) < step) {
        currentAngle = targetAngle;
      } else {
        currentAngle += Math.sign(wrapped) * step;
      }
    }

    const { nx, ny, nz } = getTerrainNormal(mapData, o.x, o.y, 0.3);
    const up = new Vector3(0, 1, 0);
    const slopeNormal = new Vector3(nx, ny, nz).normalize();
    const tiltQuat = new Quaternion().setFromUnitVectors(up, slopeNormal);
    const yawQuat = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), currentAngle);
    animalObject.quaternion.multiplyQuaternions(tiltQuat, yawQuat);

    const isMoving = o.x !== prevAnimalX || o.y !== prevAnimalY;
    prevAnimalX = o.x;
    prevAnimalY = o.y;

    if (!animalLoadedModel) return;

    const targetAnim = isMoving ? 'walk' : 'idle';
    if (targetAnim === currentAnimName) return;

    if (targetAnim === 'walk' && animalWalkAction) {
      crossFadeTo(animalWalkAction, animalIdleAction);
      currentAnimName = 'walk';
    } else if (targetAnim === 'idle' && animalIdleAction) {
      crossFadeTo(animalIdleAction, animalWalkAction);
      currentAnimName = 'idle';
    }
  };

  const playAnimation = (name: string): void => {
    if (name === 'HeadDown' && animal) {
      const terrainHeight = animal.height - ANIMAL_HEIGHT_OFFSET;
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

  const setAnimalScale = (scale: number): void => {
    animalScale = scale;
    if (animalObject) {
      animalObject.scale.set(scale, scale, scale);
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
    if (!animalLoadedModel?.eatingClip) return;

    const eating = animalLoadedModel.eatingClip;
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
      const action = animalLoadedModel.mixer.clipAction(clip);
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
      action.weight = 999;
      headActionsMap.set(name, action);
    }

    console.debug(
      `[HeadRanges] Down:${downStart}-${downEnd} Bob:${bobStart}-${bobEnd} Raise:${raiseStart}-${raiseEnd}`
    );
  };

  return {
    updateAnimal,
    playAnimation,
    setAnimalScale,
    setRotationSpeed,
    setHeadFrameRanges,
    getAnimalObject: () => animalObject,
    getAnimalLoadedModel: () => animalLoadedModel
  };
}
