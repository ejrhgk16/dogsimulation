import type { PursuedState } from '../types/pursued';
import type { MapData } from '../types/map';
import {
  HEIGHT_SPEED_FACTOR,
  ANIMAL_HEIGHT_OFFSET,
  ANIMAL_HALF_EXTENT
} from '../config/animalConfig';
import { isObstacleInFootprint, getHeightAt } from './mapService';

export function createPursued(
  id: string,
  animalType: string,
  x: number,
  y: number,
  mapData: MapData,
  speed?: number
): PursuedState {
  const height = getHeightAt(mapData, x, y) + ANIMAL_HEIGHT_OFFSET;
  return {
    id,
    animalType,
    x,
    y,
    height,
    speed: speed ?? 5.0,
    directionX: 1,
    directionY: 0,
    rotationAngle: Math.atan2(1, 0)
  };
}

export function movePursued_keyevent(
  pursued: PursuedState,
  keys: Set<string>,
  dt: number,
  mapData: MapData,
  // 키입력 → 방향벡터, 추격자 충돌 정보 포함
  pursuers: ReadonlyArray<{ x: number; y: number }> = []
): PursuedState {
  let dx = 0;
  let dy = 0;

  if (keys.has('ArrowUp')) dy = -1;
  if (keys.has('ArrowDown')) dy = 1;
  if (keys.has('ArrowLeft')) dx = -1;
  if (keys.has('ArrowRight')) dx = 1;

  if (dx !== 0 || dy !== 0) {
    const len = Math.sqrt(dx * dx + dy * dy);
    dx /= len;
    dy /= len;
    pursued.directionX = dx;
    pursued.directionY = dy;
  } else {
    pursued.directionX = 0;
    pursued.directionY = 0;
  }

  const { newX, newY, newHeight } = applyMovement(
    pursued,
    dx,
    dy,
    dt,
    pursued.speed,
    mapData,
    pursuers
  );

  pursued.x = newX;
  pursued.y = newY;
  pursued.height = newHeight;

  return pursued;
}

// entity 간 거리 기반 충돌 검사 (footprint 반지름 합)
function isCollidingWithEntities(
  x: number,
  y: number,
  entities: ReadonlyArray<{ x: number; y: number }>
): boolean {
  for (const e of entities) {
    const dist = Math.sqrt((x - e.x) ** 2 + (y - e.y) ** 2);
    if (dist < 2 * ANIMAL_HALF_EXTENT) return true;
  }
  return false;
}

function applyMovement(
  state: { x: number; y: number; directionX: number; directionY: number },
  dx: number,
  dy: number,
  dt: number,
  speed: number,
  mapData: MapData,
  otherEntities: ReadonlyArray<{ x: number; y: number }> = []
): { newX: number; newY: number; newHeight: number; finalDx: number; finalDy: number } {
  const speedScaled = speed * dt;

  // Tentative new position
  const tentativeX = state.x + dx * speedScaled;
  const tentativeY = state.y + dy * speedScaled;

  // Obstacle collision detection and resolution
  let finalDx = dx;
  let finalDy = dy;

  if (isObstacleInFootprint(mapData, tentativeX, tentativeY)) {
    const xClear = !isObstacleInFootprint(mapData, tentativeX, state.y);
    const yClear = !isObstacleInFootprint(mapData, state.x, tentativeY);

    if (!xClear && !yClear) {
      finalDx = 0;
      finalDy = 0;
    } else if (!xClear) {
      finalDx = 0;
    } else if (!yClear) {
      finalDy = 0;
    } else {
      // BothClear: diagonal cell blocked but axes individually clear → slide along dominant axis
      finalDy = 0;
    }
  }

  // entity 충돌: 장애물 해소 후 위치가 다른 entity와 겹치는지 검사
  if (otherEntities.length > 0) {
    const afterObstacleX = state.x + finalDx * speedScaled;
    const afterObstacleY = state.y + finalDy * speedScaled;

    if (isCollidingWithEntities(afterObstacleX, afterObstacleY, otherEntities)) {
      // x축만 이동 시도
      const xTentativeX = state.x + dx * speedScaled;
      const xTentativeY = state.y;
      const xClear = !isCollidingWithEntities(xTentativeX, xTentativeY, otherEntities);

      // y축만 이동 시도
      const yTentativeX = state.x;
      const yTentativeY = state.y + dy * speedScaled;
      const yClear = !isCollidingWithEntities(yTentativeX, yTentativeY, otherEntities);

      if (!xClear && !yClear) {
        finalDx = 0;
        finalDy = 0;
      } else if (!xClear) {
        finalDx = 0;
      } else if (!yClear) {
        finalDy = 0;
      }
      // BothClear: 두 축 모두 가능 → 슬라이딩 허용
    }
  }

  // Height speed adjustment
  const targetX = state.x + finalDx * speedScaled;
  const targetY = state.y + finalDy * speedScaled;
  const heightDiff = Math.abs(
    getHeightAt(mapData, targetX, targetY) - getHeightAt(mapData, state.x, state.y)
  );
  const heightFactor = Math.max(0.2, 1 - heightDiff * HEIGHT_SPEED_FACTOR);

  const resultX = state.x + finalDx * speedScaled * heightFactor;
  const resultY = state.y + finalDy * speedScaled * heightFactor;
  const resultHeight = getHeightAt(mapData, resultX, resultY) + ANIMAL_HEIGHT_OFFSET;

  return {
    newX: resultX,
    newY: resultY,
    newHeight: resultHeight,
    finalDx,
    finalDy
  };
}
