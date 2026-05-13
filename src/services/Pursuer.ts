import type { MapData } from '../types/map';
import type { ContactPoint, TrackState, ScentSample } from '../types/pursuer';
import type { TrackingParams, ScentPoint } from '../types/scent';
import {
  ANIMAL_HEIGHT_OFFSET,
  ANIMAL_HALF_EXTENT,
  HEIGHT_SPEED_FACTOR
} from '../config/animalConfig';
import { DEFAULT_TRACKING_PARAMS } from '../config/trackingConfig';
import { DEFAULT_SCENT_PARAMS } from '../config/scentConfig';
import { sampleScentInSector, getLastContactDistance, estimatePatchiness } from './scentSampler';
import { getHeightAt, isObstacleInFootprint } from './mapService';

const TWO_PI = 2 * Math.PI;
const THREE_PI = 3 * Math.PI;

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
  state: TrackState;
  lastContacts: ContactPoint[];
  trailMemory: { x: number; y: number }[];
  lostTime: number;
  searchRadius: number;
  sigma: number;
  estimatedHeading: number;
  targetHeading: number;
  castSide: number;
  lastTrailSignal: number;
  trackingParams: TrackingParams;
  isTracking: boolean;

  /** 추적자 생성 (위치/속도/추적속도 초기화) */
  constructor(
    id: string,
    x: number,
    y: number,
    mapData: MapData,
    speed = 5.0,
    chaseSpeed = 7.0,
    trackingParams?: TrackingParams
  ) {
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
    this.state = 'track';
    this.lastContacts = [];
    this.trailMemory = [];
    this.lostTime = 0;
    this.searchRadius = 0;
    this.trackingParams = trackingParams ?? DEFAULT_TRACKING_PARAMS;
    this.sigma = this.trackingParams.sigmaBase;
    this.estimatedHeading = this.rotationAngle;
    this.targetHeading = this.rotationAngle;
    this.castSide = Math.random() < 0.5 ? 1 : -1;
    this.lastTrailSignal = 0;
    this.isTracking = false;
  }

  /** 개별 추적 파라미터 업데이트 */
  updateTrackingParam<K extends keyof TrackingParams>(key: K, value: TrackingParams[K]): void {
    this.trackingParams[key] = value;
  }

  /** 강아지 추적 상태머신: scent 샘플링 → 상태 전환 → 속도/조향 결정 → 이동 */
  updateDogState(
    trailPoints: readonly ScentPoint[],
    now: number,
    dt: number,
    mapData: MapData,
    otherEntities: ReadonlyArray<{ x: number; y: number }> = []
  ): void {
    if (!this.isTracking) return;

    const sample = this.buildDogScentSample(trailPoints, now);
    const detected = sample.totalSignal > this.trackingParams.detectThreshold;

    if (detected) {
      this.lastTrailSignal = sample.totalSignal;
      this.lostTime = 0;
      this.searchRadius = 0;
      this.state = 'track';

      this.lastContacts.push({
        x: this.x,
        y: this.y,
        t: now,
        confidence: Math.min(1, sample.totalSignal / this.trackingParams.detectThreshold)
      });
      if (this.lastContacts.length > this.trackingParams.maxContacts) {
        this.lastContacts.splice(0, this.lastContacts.length - this.trackingParams.maxContacts);
      }
    } else {
      this.lostTime += dt;
    }

    const lastContactDistance = getLastContactDistance(this.lastContacts);
    const patchiness = estimatePatchiness(this.lastContacts, now);

    // Update estimatedHeading from trailMemory
    if (this.trailMemory.length >= 2) {
      const prev = this.trailMemory[this.trailMemory.length - 2];
      const last = this.trailMemory[this.trailMemory.length - 1];
      const dx = last.x - prev.x;
      const dy = last.y - prev.y;
      if (Math.abs(dx) > 1e-9 || Math.abs(dy) > 1e-9) {
        this.estimatedHeading = Math.atan2(dy, dx);
      }
    }
    // If less than 2 points, keep existing estimatedHeading

    this.sigma = this.updateSigma(lastContactDistance, this.lostTime, patchiness);
    this.searchRadius = Math.min(
      this.trackingParams.initialRadius + this.trackingParams.kRadius * this.lostTime,
      this.trackingParams.lostRadius * 2
    );

    if (this.state === 'track' && !detected) {
      this.state = 'surge';
    } else if (this.state === 'surge' && this.lostTime > this.trackingParams.surgeDuration) {
      this.state = 'cast';
    } else if (this.state === 'cast' && this.searchRadius > this.trackingParams.lostRadius) {
      this.state = 'lost';
      this.trailMemory = [];
      this.estimatedHeading = this.rotationAngle;
    }

    const sigma = this.sigma;
    let moveSpeed: number;

    // Fallback: when trailMemory is empty but tracking/surging, use current facing
    if ((this.state === 'track' || this.state === 'surge') && this.trailMemory.length < 2) {
      this.estimatedHeading = this.rotationAngle;
    }

    if (this.state === 'track') {
      this.targetHeading = this.blendHeading(
        this.estimatedHeading,
        sample.signalDirection,
        sample.directionConfidence
      );
      console.log(
        '[HEADING] rot:',
        this.rotationAngle.toFixed(2),
        'est:',
        this.estimatedHeading.toFixed(2),
        'sig:',
        sample.signalDirection.toFixed(2),
        'tgt:',
        this.targetHeading.toFixed(2),
        'conf:',
        sample.directionConfidence.toFixed(3)
      );
      moveSpeed = this.dynamicSpeed(sigma);
    } else if (this.state === 'surge') {
      this.targetHeading = this.blendHeading(
        this.estimatedHeading,
        sample.signalDirection,
        0.5 * sample.directionConfidence
      );
      moveSpeed = this.dynamicSpeed(sigma) * 0.8;
    } else if (this.state === 'cast') {
      const castAngle = Math.min(sigma, this.trackingParams.castAngleMax);
      this.targetHeading = this.estimatedHeading + this.castSide * castAngle;
      moveSpeed = this.dynamicSpeed(sigma) * 0.5;
    } else {
      this.targetHeading += this.trackingParams.lostTurnRate * dt;
      moveSpeed = this.trackingParams.minSpeed;
    }

    const diff = this.shortestAngleDiff(this.rotationAngle, this.targetHeading);
    if (Math.abs(diff) < this.trackingParams.castTurnTolerance) {
      this.castSide *= -1;
    }

    this.directionX = Math.cos(this.targetHeading);
    this.directionY = Math.sin(this.targetHeading);

    const { newX, newY, newHeight } = this.applyMovement(
      this.directionX,
      this.directionY,
      dt,
      moveSpeed,
      mapData,
      otherEntities
    );

    this.x = newX;
    this.y = newY;
    this.height = newHeight;
    const angleDiff = this.shortestAngleDiff(this.targetHeading, this.rotationAngle);
    this.rotationAngle += angleDiff * Math.min(1, 8 * dt);
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

  private clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  private shortestAngleDiff(target: number, current: number): number {
    return ((((target - current) % TWO_PI) + THREE_PI) % TWO_PI) - Math.PI;
  }

  private updateSigma(lastContactDistance: number, lostTime: number, patchiness: number): number {
    const tp = this.trackingParams;
    const sigmaTrail = Math.sqrt(
      tp.sigmaBase * tp.sigmaBase +
        (lastContactDistance / (2 * tp.xi)) ** 2 +
        (2 * tp.lambda * lastContactDistance) / (3 * tp.xi * tp.xi)
    );

    return this.clamp(
      sigmaTrail + tp.kLost * lostTime + tp.kPatch * patchiness,
      tp.sigmaMin,
      tp.sigmaMax
    );
  }

  private blendHeading(baseHeading: number, signalDirection: number, confidence: number): number {
    return baseHeading + confidence * this.shortestAngleDiff(signalDirection, baseHeading);
  }

  private dynamicSpeed(sigma: number): number {
    const tp = this.trackingParams;
    return this.clamp(tp.maxSpeed * Math.exp(-tp.kSpeedSigma * sigma), tp.minSpeed, tp.maxSpeed);
  }

  private buildDogScentSample(trailPoints: readonly ScentPoint[], now: number): ScentSample {
    const fanAngle = this.trackingParams.sensorFanAngle;
    const halfFan = fanAngle / 2;
    const sectorWidth = fanAngle / 3;
    const maxRadius = this.trackingParams.sensorRadius;
    const origin = { x: this.x, y: this.y };
    const facing = this.rotationAngle;

    const params = {
      ...DEFAULT_SCENT_PARAMS,
      sensorRadius: maxRadius
    };
    const center = sampleScentInSector(
      origin,
      facing,
      -sectorWidth / 2,
      sectorWidth / 2,
      maxRadius,
      trailPoints,
      now,
      params
    );
    const left = sampleScentInSector(
      origin,
      facing,
      -halfFan,
      -sectorWidth / 2,
      maxRadius,
      trailPoints,
      now,
      params
    );
    const right = sampleScentInSector(
      origin,
      facing,
      sectorWidth / 2,
      halfFan,
      maxRadius,
      trailPoints,
      now,
      params
    );

    // Estimate heading from trailMemory, fallback to current facing when empty
    let trailHeading = this.trailMemory.length >= 2 ? this.estimatedHeading : this.rotationAngle;
    if (this.trailMemory.length >= 2) {
      const prev = this.trailMemory[this.trailMemory.length - 2];
      const last = this.trailMemory[this.trailMemory.length - 1];
      const dx = last.x - prev.x;
      const dy = last.y - prev.y;
      if (Math.abs(dx) > 1e-9 || Math.abs(dy) > 1e-9) {
        trailHeading = Math.atan2(dy, dx);
      }
    }

    const ages = [
      { side: -1, age: left.avgAge },
      { side: 0, age: center.avgAge },
      { side: 1, age: right.avgAge }
    ].filter((a) => isFinite(a.age));

    let netBias = 0;
    let confidence = 0;

    if (ages.length >= 2) {
      ages.sort((a, b) => a.age - b.age);
      const freshest = ages[0];
      const second = ages[1];
      const diff = (second.age - freshest.age) / Math.max(second.age, freshest.age, 1e-3);
      netBias = freshest.side * diff;
      confidence = Math.abs(netBias);
    } else if (ages.length === 1) {
      netBias = ages[0].side;
      confidence = 1;
    }

    const maxTurn = Math.PI / 6;
    const signalDirection = trailHeading + maxTurn * netBias;
    const totalSignal = Math.max(center.totalSignal, left.totalSignal, right.totalSignal);

    if (confidence < 1e-3) {
      if (isFinite(center.avgAge)) {
        const shouldPush =
          this.trailMemory.length === 0 ||
          Math.hypot(
            this.x - this.trailMemory[this.trailMemory.length - 1].x,
            this.y - this.trailMemory[this.trailMemory.length - 1].y
          ) > 0.1;
        if (shouldPush) {
          this.trailMemory.push({ x: this.x, y: this.y });
          if (this.trailMemory.length > 5) {
            this.trailMemory.shift();
          }
        }
      }
      return {
        totalSignal,
        signalDirection: trailHeading,
        directionConfidence: 0
      };
    }

    return {
      totalSignal,
      signalDirection,
      directionConfidence: confidence
    };
  }
}
