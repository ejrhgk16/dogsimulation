import type { MapData } from '../types/map';
import {
  ANIMAL_HEIGHT_OFFSET,
  ANIMAL_HALF_EXTENT,
  HEIGHT_SPEED_FACTOR
} from '../config/animalConfig';
import { getHeightAt, isObstacleInFootprint } from './mapService';

export class Pursuer {
  id: string;
  x: number;
  y: number;
  height: number;
  speed: number;
  chaseSpeed: number;
  directionX: number;
  directionY: number;
  rotationAngle: number;
  targetId: string | null;

  /** 추적자 생성 (위치/속도/추적속도 초기화) */
  constructor(id: string, x: number, y: number, mapData: MapData, speed = 5.0, chaseSpeed = 7.0) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.height = getHeightAt(mapData, x, y) + ANIMAL_HEIGHT_OFFSET;
    this.speed = speed;
    this.chaseSpeed = chaseSpeed;
    this.directionX = 1;
    this.directionY = 0;
    this.rotationAngle = Math.atan2(1, 0);
    this.targetId = null;
  }

  /** 목표 방향으로 추적 이동 */
  chase(
    target: { x: number; y: number },
    dt: number,
    mapData: MapData,
    otherEntities: ReadonlyArray<{ x: number; y: number }> = []
  ): void {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len <= 0.01) return;

    this.directionX = dx / len;
    this.directionY = dy / len;

    const speed = this.targetId !== null ? this.chaseSpeed : this.speed;
    const { newX, newY, newHeight } = this.applyMovement(
      this.directionX,
      this.directionY,
      dt,
      speed,
      mapData,
      otherEntities
    );

    this.x = newX;
    this.y = newY;
    this.height = newHeight;
    this.rotationAngle = Math.atan2(this.directionY, this.directionX);
  }

  /** 장애물·충돌·경사 고려 실제 이동 계산 */
  private applyMovement(
    dx: number,
    dy: number,
    dt: number,
    speed: number,
    mapData: MapData,
    otherEntities: ReadonlyArray<{ x: number; y: number }> = []
  ): { newX: number; newY: number; newHeight: number } {
    const speedScaled = speed * dt;

    const tentativeX = this.x + dx * speedScaled;
    const tentativeY = this.y + dy * speedScaled;

    let finalDx = dx;
    let finalDy = dy;

    if (isObstacleInFootprint(mapData, tentativeX, tentativeY)) {
      const xClear = !isObstacleInFootprint(mapData, tentativeX, this.y);
      const yClear = !isObstacleInFootprint(mapData, this.x, tentativeY);

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
      const afterObstacleX = this.x + finalDx * speedScaled;
      const afterObstacleY = this.y + finalDy * speedScaled;

      if (this.isCollidingWithEntities(afterObstacleX, afterObstacleY, otherEntities)) {
        const xClear = !this.isCollidingWithEntities(
          this.x + dx * speedScaled,
          this.y,
          otherEntities
        );
        const yClear = !this.isCollidingWithEntities(
          this.x,
          this.y + dy * speedScaled,
          otherEntities
        );

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
      getHeightAt(mapData, this.x + finalDx * speedScaled, this.y + finalDy * speedScaled) -
        getHeightAt(mapData, this.x, this.y)
    );
    const heightFactor = Math.max(0.2, 1 - heightDiff * HEIGHT_SPEED_FACTOR);

    const resultX = this.x + finalDx * speedScaled * heightFactor;
    const resultY = this.y + finalDy * speedScaled * heightFactor;

    return {
      newX: resultX,
      newY: resultY,
      newHeight: getHeightAt(mapData, resultX, resultY) + ANIMAL_HEIGHT_OFFSET
    };
  }

  /** 엔티티 간 원형 충돌 검사 */
  private isCollidingWithEntities(
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
}
