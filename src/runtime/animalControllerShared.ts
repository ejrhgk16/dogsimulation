import { Box3, BoxGeometry, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { Object3D, AnimationAction, Scene } from 'three';
import type { MapData } from '../types/map';
import type { LoadedModel } from './modelLoader';
import { ANIMAL_HEIGHT_OFFSET } from '../config/animalConfig';
import { getTerrainNormal } from '../services/mapService';

export const CROSSFADE_DURATION = 0.2;

export interface UpdateState {
  prevX: number;
  prevY: number;
  currentAngle: number;
  lastRotationTime: number;
  currentAnimName: string | null;
  walkAction: AnimationAction | null;
  idleAction: AnimationAction | null;
  groundOffset: number;
}

export function createFallbackMesh(
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

export function setupLoadedModel(
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

export function crossFadeTo(nextAction: AnimationAction, prevAction: AnimationAction | null): void {
  nextAction.reset();
  nextAction.play();
  if (prevAction) {
    nextAction.crossFadeFrom(prevAction, CROSSFADE_DURATION, false);
  }
}

export function updatePositionAndRotation(
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

export function updateWalkIdleAnimation(
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
