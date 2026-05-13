import type { MapData } from '../types/map';
import type { ScentPoint, ScentParams, AnimalScentProfile } from '../types/scent';
import {
  ANIMAL_HEIGHT_OFFSET,
  ANIMAL_HALF_EXTENT,
  HEIGHT_SPEED_FACTOR
} from '../config/animalConfig';
import {
  getAnimalProfile,
  getTauDecayMultiplier,
  getEmitRateMultiplier,
  DEFAULT_SCENT_PARAMS
} from '../config/scentConfig';
import { getHeightAt, isObstacleInFootprint } from './mapService';

/** Box-Muller 정규분포 난수 생성 */
function randomGaussian(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** 피추적자(알파카) — 키보드 이동·scent 방출 담당 */
export class Pursued {
  id: string;
  /** 동물 타입 (profile 식별자) */
  animalType: string;
  /** 현재 위치 X */
  x: number;
  /** 현재 위치 Y */
  y: number;
  /** 지형 반영 현재 높이 */
  height: number;
  /** 이동 속도 */
  speed: number;
  /** 방향 X 성분 */
  directionX: number;
  /** 방향 Y 성분 */
  directionY: number;
  /** 바라보는 각도 */
  rotationAngle: number;

  // Scent
  /** 방출된 향기 포인트 목록 */
  trailPoints: ScentPoint[] = [];
  /** 마지막 방출 시간 (시간 기반 스로틀) */
  private lastEmitTime = -Infinity;
  /** 마지막 방출 이후 누적 이동거리 (거리 기반 스로틀) */
  private distanceSinceLast = 0;
  /** 마지막 방출 X 좌표 */
  private lastScentX: number;
  /** 마지막 방출 Y 좌표 */
  private lastScentY: number;

  /** 피추적자 생성 (위치/속도/방향 초기화) */
  constructor(id: string, animalType: string, x: number, y: number, mapData: MapData, speed = 5.0) {
    this.id = id;
    this.animalType = animalType;
    this.x = x;
    this.y = y;
    this.height = getHeightAt(mapData, x, y) + ANIMAL_HEIGHT_OFFSET;
    this.speed = speed;
    this.directionX = 1;
    this.directionY = 0;
    this.rotationAngle = Math.atan2(1, 0);
    this.lastScentX = x;
    this.lastScentY = y;
  }

  /** 키보드 입력 기반 이동 처리 */
  moveByKeys(
    keys: Set<string>,
    dt: number,
    mapData: MapData,
    pursuers: ReadonlyArray<{ x: number; y: number }> = []
  ): void {
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
      this.directionX = dx;
      this.directionY = dy;
    } else {
      this.directionX = 0;
      this.directionY = 0;
    }

    const { newX, newY, newHeight } = this.applyMovement(dx, dy, dt, this.speed, mapData, pursuers);

    this.x = newX;
    this.y = newY;
    this.height = newHeight;
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

  /** scent 생성 + trim (한 번에 처리) */
  emitScent(now: number): void {
    const profile = getAnimalProfile(this.animalType);
    this.trim(now, DEFAULT_SCENT_PARAMS);

    // 시간 기반 방출 (emitInterval 스로틀)
    if (now - this.lastEmitTime >= profile.emitInterval) {
      this.lastEmitTime = now;
      if (Math.random() <= profile.emitProbability * getEmitRateMultiplier()) {
        this.pushScentPoint(this.x, this.y, this.height, now, profile);
      }
    }

    // 거리 기반 방출 (emitSpacing 스로틀)
    const dx = this.x - this.lastScentX;
    const dy = this.y - this.lastScentY;
    this.distanceSinceLast += Math.sqrt(dx * dx + dy * dy);
    this.lastScentX = this.x;
    this.lastScentY = this.y;

    if (this.distanceSinceLast >= profile.emitSpacing) {
      this.distanceSinceLast = 0;
      if (Math.random() <= profile.emitProbability * getEmitRateMultiplier()) {
        this.pushScentPoint(this.x, this.y, this.height, now, profile);
      }
    }
  }

  /** 향기 포인트 생성 (위치·약간의 랜덤 오프셋 적용) */
  private pushScentPoint(
    x: number,
    y: number,
    height: number,
    now: number,
    profile: AnimalScentProfile
  ): void {
    const angle = Math.random() * 2 * Math.PI;
    const radius = Math.abs(randomGaussian()) * profile.spreadRadius;
    this.trailPoints.push({
      animalId: this.id,
      animalType: this.animalType,
      x: x + Math.cos(angle) * radius,
      y: y + Math.sin(angle) * radius,
      height,
      t: now,
      tauDecay: profile.tauDecay * getTauDecayMultiplier()
    });
  }

  /** 5×tauDecay 초과 오래된 향기 제거 */
  private trim(now: number, params: ScentParams): void {
    this.trailPoints = this.trailPoints.filter((point) => {
      const age = now - point.t;
      const threshold = (point.tauDecay ?? params.tauDecay) * 5;
      return age <= threshold;
    });
  }
}
