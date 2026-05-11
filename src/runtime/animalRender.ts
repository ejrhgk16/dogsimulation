import type { Object3D, Scene } from 'three';
import { Box3, BoxGeometry, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
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

  return { object: loaded.group, loadedModel: loaded, walkAction, idleAction, groundOffset };
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
    update,
    setScale,
    setRotationSpeed,
    getObject: () => obj,
    getLoadedModel: () => loadedModel
  };
}
