import type { AnimalState } from '../types/animal';
import type { MapData } from '../types/map';
import { HEIGHT_SPEED_FACTOR, ANIMAL_HEIGHT_OFFSET } from '../config/animalConfig';
import { isObstacleInFootprint, getHeightAt } from './mapService';

export function createAnimal(
  id: string,
  animalType: string,
  x: number,
  y: number,
  mapData: MapData,
  speed: number = 5.0
): AnimalState {
  const height = getHeightAt(mapData, x, y) + ANIMAL_HEIGHT_OFFSET;
  return {
    id,
    animalType,
    x,
    y,
    height,
    speed,
    directionX: 1,
    directionY: 0,
    rotationAngle: Math.atan2(1, 0)
  };
}

export function moveAnimal_keyevent(
  animal: AnimalState,
  keys: Set<string>,
  dt: number,
  mapData: MapData
): AnimalState {
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
    animal.directionX = dx;
    animal.directionY = dy;
  } else {
    animal.directionX = 0;
    animal.directionY = 0;
  }

  const speed = animal.speed * dt;

  // Tentative new position
  const newX = animal.x + dx * speed;
  const newY = animal.y + dy * speed;

  // Obstacle collision detection and resolution
  let finalDx = dx;
  let finalDy = dy;

  if (isObstacleInFootprint(mapData, newX, newY)) {
    const xClear = !isObstacleInFootprint(mapData, newX, animal.y);
    const yClear = !isObstacleInFootprint(mapData, animal.x, newY);

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

  // Height speed adjustment
  const targetX = animal.x + finalDx * speed;
  const targetY = animal.y + finalDy * speed;
  const heightDiff = Math.abs(
    getHeightAt(mapData, targetX, targetY) - getHeightAt(mapData, animal.x, animal.y)
  );
  const heightFactor = Math.max(0.2, 1 - heightDiff * HEIGHT_SPEED_FACTOR);

  animal.x += finalDx * speed * heightFactor;
  animal.y += finalDy * speed * heightFactor;
  animal.height = getHeightAt(mapData, animal.x, animal.y) + ANIMAL_HEIGHT_OFFSET;
  return animal;
}
