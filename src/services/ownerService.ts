import type { OwnerState } from '../types/owner';
import { OWNER_SPEED } from '../config/ownerConfig';

export function createOwner(id: string, ownerType: string, x: number, y: number): OwnerState {
  return { id, ownerType, x, y, directionX: 1, directionY: 0 };
}

export function moveOwner(owner: OwnerState, keys: Set<string>, dt: number): OwnerState {
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
  owner.x += dx * speed;
  owner.y += dy * speed;
  return owner;
}
