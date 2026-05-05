import type { OwnerState } from '../types/owner';
import type { MapData } from '../types/map';
import { OWNER_SPEED, HEIGHT_SPEED_FACTOR } from '../config/ownerConfig';
import { isObstacleAt, getHeightAt } from './mapService';

export function createOwner(id: string, ownerType: string, x: number, y: number): OwnerState {
  return { id, ownerType, x, y, directionX: 1, directionY: 0 };
}

export function moveOwner(
  owner: OwnerState,
  keys: Set<string>,
  dt: number,
  mapData: MapData
): OwnerState {
  let dx = 0;
  let dy = 0;

  if (keys.has('w') || keys.has('W') || keys.has('ArrowUp')) dy -= 1;
  if (keys.has('s') || keys.has('S') || keys.has('ArrowDown')) dy += 1;
  if (keys.has('a') || keys.has('A') || keys.has('ArrowLeft')) dx -= 1;
  if (keys.has('d') || keys.has('D') || keys.has('ArrowRight')) dx += 1;

  if (dx !== 0 || dy !== 0) {
    const len = Math.sqrt(dx * dx + dy * dy);
    dx /= len;
    dy /= len;
    owner.directionX = dx;
    owner.directionY = dy;
  }

  const speed = OWNER_SPEED * dt;

  // Tentative new position
  const newX = owner.x + dx * speed;
  const newY = owner.y + dy * speed;

  // Obstacle collision detection and resolution
  let finalDx = dx;
  let finalDy = dy;

  if (isObstacleAt(mapData, newX, newY)) {
    const xClear = !isObstacleAt(mapData, newX, owner.y);
    const yClear = !isObstacleAt(mapData, owner.x, newY);

    if (!xClear && !yClear) {
      finalDx = 0;
      finalDy = 0;
    } else if (!xClear) {
      finalDx = 0;
    } else if (!yClear) {
      finalDy = 0;
    }
    // Both clear → keep original direction (corner-case pass-through)
  }

  // Height speed adjustment
  const targetX = owner.x + finalDx * speed;
  const targetY = owner.y + finalDy * speed;
  const heightDiff = Math.abs(
    getHeightAt(mapData, targetX, targetY) - getHeightAt(mapData, owner.x, owner.y)
  );
  const heightFactor = Math.max(0.2, 1 - heightDiff * HEIGHT_SPEED_FACTOR);

  owner.x += finalDx * speed * heightFactor;
  owner.y += finalDy * speed * heightFactor;
  return owner;
}
