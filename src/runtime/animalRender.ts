import type { Object3D, Scene } from 'three';
import {
  Box3,
  BoxGeometry,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3
} from 'three';
import type { AnimationAction } from 'three';
import type { MapData } from '../types/map';
import type { PursuerState } from '../types/pursuer';
import type { PursuedState } from '../types/pursued';
import type { LoadedModel } from './modelLoader';
import { loadModel } from './modelLoader';
import { ANIMAL_TYPES, ANIMAL_HEIGHT_OFFSET } from '../config/animalConfig';
import { getTerrainNormal } from '../services/mapService';

const CROSSFADE_DURATION = 0.2;

interface UpdateState {
  prevX: number;
  prevY: number;
  currentAngle: number;
  lastRotationTime: number;
  currentAnimName: string | null;
  walkAction: AnimationAction | null;
  idleAction: AnimationAction | null;
  gallopAction: AnimationAction | null;
  headDownAction: AnimationAction | null;
  headBobAction: AnimationAction | null;
  headUpAction: AnimationAction | null;
  headAnimName: string | null;
  groundOffset: number;
}

export interface AnimalRender {
  update: (state: PursuerState | PursuedState) => void;
  setScale: (scale: number) => void;
  setRotationSpeed: (radPerSec: number) => void;
  getObject: () => Object3D | null;
  getLoadedModel: () => LoadedModel | null;
}

/** GLTF 로딩 전 대체 박스 메시 생성 */
function createFallbackMesh(
  scene: Scene,
  x: number,
  height: number,
  y: number,
  scale: number,
  color: number
): Object3D {
  const geo = new BoxGeometry(0.5, 0.5, 0.5);
  const mat = new MeshStandardMaterial({ color });
  const mesh = new Mesh(geo, mat);
  mesh.position.set(x, height, y);
  mesh.scale.set(scale, scale, scale);
  scene.add(mesh);
  return mesh;
}

/** GLTF 모델로 전환 (폴백 제거, 위치/스케일/애니메이션 설정) */
function setupLoadedModel(
  loaded: LoadedModel,
  scene: Scene,
  fallbackMesh: Object3D,
  x: number,
  height: number,
  y: number,
  scale: number
): {
  object: Object3D;
  loadedModel: LoadedModel;
  walkAction: AnimationAction | null;
  idleAction: AnimationAction | null;
  gallopAction: AnimationAction | null;
  headDownAction: AnimationAction | null;
  headBobAction: AnimationAction | null;
  headUpAction: AnimationAction | null;
  groundOffset: number;
} {
  scene.remove(fallbackMesh);
  loaded.group.position.set(x, 0, y);
  loaded.group.scale.set(scale, scale, scale);
  const box = new Box3().setFromObject(loaded.group);
  const groundOffset = -box.min.y;
  const terrainHeight = height - ANIMAL_HEIGHT_OFFSET;
  loaded.group.position.set(x, terrainHeight + groundOffset, y);
  scene.add(loaded.group);

  const walkClip = loaded.animations.find((c) => c.name.toLowerCase().includes('walk')) ?? null;
  const idleClip =
    loaded.animations.find(
      (c) => c.name.toLowerCase().includes('idle') || c.name.toLowerCase().includes('stand')
    ) ?? null;
  const walkAction = walkClip ? loaded.mixer.clipAction(walkClip) : null;
  const idleAction = idleClip ? loaded.mixer.clipAction(idleClip) : null;
  const gallopAction = loaded.gallopClip ? loaded.mixer.clipAction(loaded.gallopClip) : null;
  const headDownAction = loaded.headDownClip ? loaded.mixer.clipAction(loaded.headDownClip) : null;
  const headBobAction = loaded.headBobClip ? loaded.mixer.clipAction(loaded.headBobClip) : null;
  const headUpAction = loaded.headUpClip ? loaded.mixer.clipAction(loaded.headUpClip) : null;

  return {
    object: loaded.group,
    loadedModel: loaded,
    walkAction,
    idleAction,
    gallopAction,
    headDownAction,
    headBobAction,
    headUpAction,
    groundOffset
  };
}

/** 두 애니메이션 간 크로스페이드 전환 */
function crossFadeTo(nextAction: AnimationAction, prevAction: AnimationAction | null): void {
  nextAction.reset();
  nextAction.play();
  if (prevAction) {
    nextAction.crossFadeFrom(prevAction, CROSSFADE_DURATION, false);
  }
}

/** 지형 높이·법선 따라 오브젝트 위치+회전 업데이트 */
function updatePositionAndRotation(
  obj: Object3D,
  x: number,
  y: number,
  height: number,
  directionX: number,
  directionY: number,
  mapData: MapData,
  updateState: UpdateState,
  rotationSpeed: number
): void {
  const terrainY = height - ANIMAL_HEIGHT_OFFSET;
  obj.position.set(x, terrainY + updateState.groundOffset, y);

  const now = performance.now();
  const dt = (now - updateState.lastRotationTime) / 1000;
  updateState.lastRotationTime = now;

  const moving = directionX !== 0 || directionY !== 0;
  if (moving) {
    const targetAngle = Math.atan2(directionX, directionY);
    const diff = targetAngle - updateState.currentAngle;
    const wrapped = Math.atan2(Math.sin(diff), Math.cos(diff));
    const step = rotationSpeed * dt;
    if (Math.abs(wrapped) < step) {
      updateState.currentAngle = targetAngle;
    } else {
      updateState.currentAngle += Math.sign(wrapped) * step;
    }
  }

  const { nx, ny, nz } = getTerrainNormal(mapData, x, y, 0.3);
  const up = new Vector3(0, 1, 0);
  const slopeNormal = new Vector3(nx, ny, nz).normalize();
  const tiltQuat = new Quaternion().setFromUnitVectors(up, slopeNormal);
  const yawQuat = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), updateState.currentAngle);
  obj.quaternion.multiplyQuaternions(tiltQuat, yawQuat);
}

/** 이동/정지 상태에 따라 걷기/대기 애니메이션 전환 */
function updateWalkIdleAnimation(
  isMoving: boolean,
  walkAction: AnimationAction | null,
  idleAction: AnimationAction | null,
  currentAnimName: string | null
): string | null {
  const targetAnim = isMoving ? 'walk' : 'idle';
  if (targetAnim === currentAnimName) return currentAnimName;

  if (targetAnim === 'walk' && walkAction) {
    crossFadeTo(walkAction, idleAction);
    return 'walk';
  } else if (targetAnim === 'idle' && idleAction) {
    crossFadeTo(idleAction, walkAction);
    return 'idle';
  }
  return currentAnimName;
}

/** Pursuer 속도 기반 본체 애니메이션 선택 (idle/walk/gallop) */
function updateSpeedAnimation(
  speed: number,
  idleAction: AnimationAction | null,
  walkAction: AnimationAction | null,
  gallopAction: AnimationAction | null,
  currentAnimName: string | null
): string | null {
  const targetAnim: string =
    speed < 0.01 ? 'idle' : speed < 3.5 ? 'walk' : gallopAction ? 'gallop' : 'walk';

  if (targetAnim === currentAnimName) return currentAnimName;

  const actionMap: Record<string, AnimationAction | null> = {
    idle: idleAction,
    walk: walkAction,
    gallop: gallopAction
  };
  const nextAction = actionMap[targetAnim];
  const prevAction = currentAnimName ? actionMap[currentAnimName] : null;

  if (nextAction) {
    crossFadeTo(nextAction, prevAction ?? null);
  }

  return targetAnim;
}

/** Pursuer 머리 애니메이션 재생 (headDown→headBob / headUp) */
function updateHeadAnimation(
  speed: number,
  headDownAction: AnimationAction | null,
  headBobAction: AnimationAction | null,
  headUpAction: AnimationAction | null,
  currentHeadAnim: string | null
): string | null {
  // Guard: no head clips
  if (!headDownAction && !headBobAction && !headUpAction) return null;

  // Stopped: stop all head animations
  if (speed < 0.01) {
    if (currentHeadAnim !== null) {
      headDownAction?.stop();
      headBobAction?.stop();
      headUpAction?.stop();
    }
    return null;
  }

  // Low speed: headDown (one-shot → loop) or headBob loop
  if (speed < 3.5) {
    // Already playing headDown, check if finished
    if (currentHeadAnim === 'headDown') {
      const clip = headDownAction?.getClip();
      if (clip && (headDownAction?.time ?? 0) >= clip.duration - 0.01) {
        headDownAction?.stop();
        if (headBobAction) {
          headBobAction.reset();
          headBobAction.setLoop(LoopRepeat, Infinity);
          headBobAction.weight = 999;
          headBobAction.play();
          return 'headBob';
        }
      }
      return 'headDown';
    }

    // Already playing headBob, keep it
    if (currentHeadAnim === 'headBob') {
      return 'headBob';
    }

    // Starting head sequence (currentHeadAnim is null or 'headUp')
    headDownAction?.stop();
    headBobAction?.stop();
    headUpAction?.stop();

    if (headDownAction) {
      headDownAction.reset();
      headDownAction.setLoop(LoopOnce, 1);
      headDownAction.clampWhenFinished = true;
      headDownAction.weight = 999;
      headDownAction.play();
      return 'headDown';
    }
    // Fallback: no headDown, play headBob directly
    if (headBobAction) {
      headBobAction.reset();
      headBobAction.setLoop(LoopRepeat, Infinity);
      headBobAction.weight = 999;
      headBobAction.play();
      return 'headBob';
    }

    return currentHeadAnim;
  }

  // High speed: headUp (one-shot)
  if (headUpAction) {
    if (currentHeadAnim !== 'headUp') {
      headDownAction?.stop();
      headBobAction?.stop();
      headUpAction.stop();

      headUpAction.reset();
      headUpAction.setLoop(LoopOnce, 1);
      headUpAction.clampWhenFinished = true;
      headUpAction.weight = 999;
      headUpAction.play();
    }
    return 'headUp';
  }

  return currentHeadAnim;
}

/** 동물 3D 컨트롤러 생성 (폴백박스 → GLTF 모델) */
export function createAnimalRender(
  scene: Scene,
  mapData: MapData,
  animalType: string,
  state?: PursuerState | PursuedState
): AnimalRender {
  let obj: Object3D | null = null;
  let loadedModel: LoadedModel | null = null;
  const config = ANIMAL_TYPES[animalType];
  let rotationSpeed = config?.rotationSpeed ?? 8.0;
  const initialScale = config?.scale ?? 0.2;
  let currentScale = initialScale;

  const updateState: UpdateState = {
    prevX: state?.x ?? 0,
    prevY: state?.y ?? 0,
    currentAngle: 0,
    lastRotationTime: performance.now(),
    currentAnimName: null,
    walkAction: null,
    idleAction: null,
    gallopAction: null,
    headDownAction: null,
    headBobAction: null,
    headUpAction: null,
    headAnimName: null,
    groundOffset: 0
  };

  if (state) {
    const color = config?.color ?? 0xff9933;
    const fallbackMesh = createFallbackMesh(
      scene,
      state.x,
      state.height,
      state.y,
      currentScale,
      color
    );
    obj = fallbackMesh;

    const modelPath = config?.modelPath;
    if (modelPath) {
      loadModel(modelPath, animalType).then((loaded) => {
        if (loaded) {
          const result = setupLoadedModel(
            loaded,
            scene,
            fallbackMesh,
            state.x,
            state.height,
            state.y,
            currentScale
          );
          obj = result.object;
          loadedModel = result.loadedModel;
          updateState.walkAction = result.walkAction;
          updateState.idleAction = result.idleAction;
          updateState.gallopAction = result.gallopAction;
          updateState.headDownAction = result.headDownAction;
          updateState.headBobAction = result.headBobAction;
          updateState.headUpAction = result.headUpAction;
          updateState.groundOffset = result.groundOffset;

          if (updateState.idleAction) {
            updateState.idleAction.play();
            updateState.currentAnimName = 'idle';
          }
        }
      });
    }
  }

  /** 동물 위치/회전/애니메이션 갱신 */
  const update = (o: PursuerState | PursuedState): void => {
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

    // Type guard: PursuerState has castOriginX, PursuedState does not
    if ('castOriginX' in o) {
      const speed = (o as PursuerState).speed;

      // Body animation — speed-based
      updateState.currentAnimName = updateSpeedAnimation(
        speed,
        updateState.idleAction,
        updateState.walkAction,
        updateState.gallopAction,
        updateState.currentAnimName
      );

      // Head animation — speed-based (dog only)
      if (animalType === 'dog') {
        updateState.headAnimName = updateHeadAnimation(
          speed,
          updateState.headDownAction,
          updateState.headBobAction,
          updateState.headUpAction,
          updateState.headAnimName
        );
      }

      updateState.prevX = o.x;
      updateState.prevY = o.y;
    } else {
      // Pursued: 기존 isMoving 기반 walk/idle (변경 없음)
      const isMoving = o.x !== updateState.prevX || o.y !== updateState.prevY;
      updateState.prevX = o.x;
      updateState.prevY = o.y;

      updateState.currentAnimName = updateWalkIdleAnimation(
        isMoving,
        updateState.walkAction,
        updateState.idleAction,
        updateState.currentAnimName
      );
    }
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
    update,
    setScale,
    setRotationSpeed,
    getObject: () => obj,
    getLoadedModel: () => loadedModel
  };
}
