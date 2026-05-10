import type { PursuerState } from '../types/pursuer';
import type { MapData } from '../types/map';
import {
  ANIMAL_HEIGHT_OFFSET,
  ANIMAL_HALF_EXTENT,
  HEIGHT_SPEED_FACTOR
} from '../config/animalConfig';
import { getHeightAt, isObstacleInFootprint } from './mapService';

export function createPursuer(
  id: string,
  x: number,
  y: number,
  mapData: MapData,
  speed: number = 5.0,
  chaseSpeed: number = 7.0
): PursuerState {
  const height = getHeightAt(mapData, x, y) + ANIMAL_HEIGHT_OFFSET;
  return {
    id,
    x,
    y,
    height,
    speed,
    chaseSpeed,
    directionX: 1,
    directionY: 0,
    rotationAngle: Math.atan2(1, 0),
    targetId: null
  };
}

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
): { newX: number; newY: number; newHeight: number } {
  const speedScaled = speed * dt;

  const tentativeX = state.x + dx * speedScaled;
  const tentativeY = state.y + dy * speedScaled;

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
      finalDy = 0;
    }
  }

  if (otherEntities.length > 0) {
    const afterObstacleX = state.x + finalDx * speedScaled;
    const afterObstacleY = state.y + finalDy * speedScaled;

    if (isCollidingWithEntities(afterObstacleX, afterObstacleY, otherEntities)) {
      const xClear = !isCollidingWithEntities(state.x + dx * speedScaled, state.y, otherEntities);
      const yClear = !isCollidingWithEntities(state.x, state.y + dy * speedScaled, otherEntities);

      if (!xClear && !yClear) {
        finalDx = 0;
        finalDy = 0;
      } else if (!xClear) {
        finalDx = 0;
      } else if (!yClear) {
        finalDy = 0;
      }
    }
  }

  const heightDiff = Math.abs(
    getHeightAt(mapData, state.x + finalDx * speedScaled, state.y + finalDy * speedScaled) -
      getHeightAt(mapData, state.x, state.y)
  );
  const heightFactor = Math.max(0.2, 1 - heightDiff * HEIGHT_SPEED_FACTOR);

  const resultX = state.x + finalDx * speedScaled * heightFactor;
  const resultY = state.y + finalDy * speedScaled * heightFactor;

  return {
    newX: resultX,
    newY: resultY,
    newHeight: getHeightAt(mapData, resultX, resultY) + ANIMAL_HEIGHT_OFFSET
  };
}

export function chaseTarget(
  pursuer: PursuerState,
  targetX: number,
  targetY: number,
  dt: number,
  mapData: MapData,
  otherEntities: ReadonlyArray<{ x: number; y: number }> = []
): PursuerState {
  const dx = targetX - pursuer.x;
  const dy = targetY - pursuer.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len <= 0.01) {
    return pursuer;
  }

  pursuer.directionX = dx / len;
  pursuer.directionY = dy / len;

  const speed = pursuer.targetId !== null ? pursuer.chaseSpeed : pursuer.speed;

  const { newX, newY, newHeight } = applyMovement(
    pursuer,
    pursuer.directionX,
    pursuer.directionY,
    dt,
    speed,
    mapData,
    otherEntities
  );

  pursuer.x = newX;
  pursuer.y = newY;
  pursuer.height = newHeight;
  pursuer.rotationAngle = Math.atan2(pursuer.directionY, pursuer.directionX);

  return pursuer;
}
