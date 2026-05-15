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

/** 추적자(강아지) — 센서 감지·상태머신·조향·이동 담당 */
export class Pursuer {
  id: string;
  /** 현재 위치 X */
  x: number;
  /** 현재 위치 Y */
  y: number;
  /** 지형 높이 반영 현재 높이 */
  height: number;
  /** 이동 방향 X 성분 (cos) */
  directionX: number;
  /** 이동 방향 Y 성분 (sin) */
  directionY: number;
  /** 현재 바라보는 각도 (게임각, 0=동, CCW) */
  rotationAngle: number;
  /** cast 진입 시점 x 좌표 (원점) */
  castOriginX: number;
  /** cast 진입 시점 y 좌표 (원점) */
  castOriginY: number;
  /** 추적 대상 ID (없으면 null) */
  targetId: string | null;
  /** 추적 상태 (track/surge/cast/lost) */
  state: TrackState;
  /** 최근 접촉점 기록 */
  lastContacts: ContactPoint[];
  /** 지나온 경로 (몸통 위치) */
  trailMemory: { x: number; y: number }[];
  /** 마지막 감지 이후 경과 시간 */
  lostTime: number;
  /** cast/lost 탐색 반경 */
  searchRadius: number;
  /** 추적 불확실도 (sigma) */
  sigma: number;
  /** trailMemory 기반 추정 이동 방향 */
  estimatedHeading: number;
  /** 조향 목표 방향 */
  targetHeading: number;
  /** cast 상태 좌우 스윕 방향 (+1 또는 -1) */
  castSide: number;
  /** 마지막 프레임 감지 신호 */
  lastTrailSignal: number;
  /** 추적 파라미터 (UI 연동) */
  trackingParams: TrackingParams;
  /** 추적 활성 여부 */
  isTracking: boolean;
  /** 직전 프레임 곡률 반지름 (EMA smoothing용) */
  private _prevXi: number;
  private _baseBoundary: number = 0;
  private readonly TURN_RATE: number = 8;

  get castBoundaryAngle(): number {
    return this._baseBoundary;
  }

  /** 추적자 생성 (위치/추적 파라미터 초기화) */
  constructor(id: string, x: number, y: number, mapData: MapData, trackingParams?: TrackingParams) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.height = getHeightAt(mapData, x, y) + ANIMAL_HEIGHT_OFFSET;
    this.directionX = 1;
    this.directionY = 0;
    this.rotationAngle = Math.atan2(1, 0);
    this.castOriginX = x;
    this.castOriginY = y;
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
    this._prevXi = this.trackingParams.xi;
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
      // cast 상태에만 castLostScale 적용 → 0으로 두면 cast→lost 전이 방지 (디버깅용)
      const scale = this.state === 'cast' ? this.trackingParams.castLostScale : 1;
      this.lostTime += dt * scale;
    }

    const lastContactDistance = getLastContactDistance(this.lastContacts);
    const patchiness = estimatePatchiness(this.lastContacts, now);

    // Update estimatedHeading from trailMemory (frozen during cast)
    if (this.state !== 'cast' && this.trailMemory.length >= 2) {
      const prev = this.trailMemory[this.trailMemory.length - 2];
      const last = this.trailMemory[this.trailMemory.length - 1];
      const dx = last.x - prev.x;
      const dy = last.y - prev.y;
      if (Math.abs(dx) > 1e-9 || Math.abs(dy) > 1e-9) {
        this.estimatedHeading = Math.atan2(dy, dx);
      }
    }

    this.sigma = this.updateSigma(lastContactDistance, this.lostTime, patchiness);
    this.searchRadius = Math.min(
      this.trackingParams.initialRadius + this.trackingParams.kRadius * this.lostTime,
      this.trackingParams.lostRadius * 2
    );

    if (this.state === 'track' && !detected) {
      this.state = 'surge';
    } else if (this.state === 'surge') {
      let rFromContact = 0;
      if (this.lastContacts.length > 0) {
        const last = this.lastContacts[this.lastContacts.length - 1];
        rFromContact = Math.hypot(this.x - last.x, this.y - last.y);
      }
      const effectiveSigma = this.sigma + this.trackingParams.kRadial * rFromContact;
      if (effectiveSigma * this.trackingParams.theta0 > this.trackingParams.sensorFanAngle / 2) {
        this.state = 'cast';
        this.castOriginX = this.x;
        this.castOriginY = this.y;
        this._baseBoundary = Math.min(
          effectiveSigma * this.trackingParams.theta0,
          this.trackingParams.castAngleMax
        );
        this.targetHeading =
          this.estimatedHeading +
          this.castSide * (this._baseBoundary + this.trackingParams.castFlipMargin);
        this.rotationAngle = this.targetHeading;
        console.log('[CAST BOUNDARY] new:', this._baseBoundary.toFixed(3));
      }
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

      moveSpeed = this.dynamicSpeed(sigma);
    } else if (this.state === 'surge') {
      this.targetHeading = this.blendHeading(
        this.estimatedHeading,
        sample.signalDirection,
        0.5 * sample.directionConfidence
      );
      moveSpeed = this.dynamicSpeed(sigma) * 0.8;
    } else if (this.state === 'cast') {
      // estimatedHeading 중심선에서의 수직거리 (signed: +왼쪽, -오른쪽)
      const dx = this.x - this.castOriginX;
      const dy = this.y - this.castOriginY;
      const lateral = dy * Math.cos(this.estimatedHeading) - dx * Math.sin(this.estimatedHeading);

      console.log(
        '[CAST BOUNDARY] lateral:',
        lateral.toFixed(3),
        'max:',
        this.trackingParams.castLateralMax.toFixed(3),
        'r:',
        Math.hypot(dx, dy).toFixed(1),
        'side:',
        this.castSide,
        'heading:',
        this.targetHeading.toFixed(3)
      );

      if (this.castSide * lateral > this.trackingParams.castLateralMax) {
        const oldSide = this.castSide;
        this.castSide *= -1;
        this.targetHeading =
          this.estimatedHeading +
          this.castSide * (this._baseBoundary + this.trackingParams.castFlipMargin);
        this.rotationAngle = this.targetHeading;
        console.log(
          '[CAST FLIP] side:',
          oldSide,
          '→',
          this.castSide,
          'lateral:',
          lateral.toFixed(3),
          'heading:',
          this.targetHeading.toFixed(3)
        );
      }

      moveSpeed = this.dynamicSpeed(sigma) * 0.5;
    } else {
      this.targetHeading += this.trackingParams.lostTurnRate * dt;
      moveSpeed = this.trackingParams.minSpeed;
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
    this.rotationAngle += angleDiff * Math.min(1, this.TURN_RATE * dt);
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

  /** 값을 min~max 범위로 제한 */
  private clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  /** 두 각도 간 최단 차이 [-π, π] 반환 */
  private shortestAngleDiff(target: number, current: number): number {
    return ((((target - current) % TWO_PI) + THREE_PI) % TWO_PI) - Math.PI;
  }

  /** sigma 업데이트: 동적 xi + GWLC regime 보간 + lost·patch 반영 */
  private updateSigma(lastContactDistance: number, lostTime: number, patchiness: number): number {
    const tp = this.trackingParams;
    const xi = this.estimateCurvatureRadius();
    const L = lastContactDistance;
    const lam = tp.lambda;

    // GWLC regime interpolation: w ∈ [0,1]
    // L ≪ λ → w ≈ 0 (curvature dominated)
    // L ≫ λ → w ≈ 1 (diffusive dominated)
    const denom = L + lam;
    const w = denom > 0 ? L / denom : 0;

    const curvatureTerm = (L * L) / (4 * xi * xi);
    const diffusiveTerm = (2 * lam * L) / (3 * xi * xi);

    const sigmaTrail = Math.sqrt(
      tp.sigmaBase * tp.sigmaBase + (1 - w) * curvatureTerm + w * diffusiveTerm
    );

    return this.clamp(
      sigmaTrail + tp.kLost * lostTime + tp.kPatch * patchiness,
      tp.sigmaMin,
      tp.sigmaMax
    );
  }

  /** lastContacts의 최근 3개 접촉점으로 외접원 반지름(곡률) 계산 후 EMA smoothing */
  // Internal: will be wired by task-2-update-sigma-gwlc
  estimateCurvatureRadius(): number {
    const contacts = this.lastContacts;
    if (contacts.length < 3) {
      this._prevXi = this.trackingParams.xi;
      return this._prevXi;
    }

    const p0 = contacts[contacts.length - 3];
    const p1 = contacts[contacts.length - 2];
    const p2 = contacts[contacts.length - 1];

    const a = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const b = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const c = Math.hypot(p2.x - p0.x, p2.y - p0.y);

    const s = (a + b + c) / 2;
    const areaSq = s * (s - a) * (s - b) * (s - c);
    const area = Math.sqrt(Math.max(0, areaSq));

    const EPSILON = 1e-9;
    let currentXi: number;
    if (area > EPSILON) {
      currentXi = (a * b * c) / (4 * area);
    } else {
      currentXi = this.trackingParams.xi;
    }

    const alpha = 0.3;
    this._prevXi = alpha * currentXi + (1 - alpha) * this._prevXi;
    return this._prevXi;
  }

  /** 기준 heading에 signalDirection을 confidence 가중치로 blend */
  private blendHeading(baseHeading: number, signalDirection: number, confidence: number): number {
    return baseHeading + confidence * this.shortestAngleDiff(signalDirection, baseHeading);
  }

  /** sigma 기반 동적 속도 계산 (불확실성 높을수록 느리게) */
  private dynamicSpeed(sigma: number): number {
    const tp = this.trackingParams;
    return this.clamp(tp.maxSpeed * Math.exp(-tp.kSpeedSigma * sigma), tp.minSpeed, tp.maxSpeed);
  }

  /** 센서 3섹터(좌·중·우) 샘플링 → netBias·signalDirection·confidence 산출 */
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
