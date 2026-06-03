import type { MapData } from '../types/map';
import type { ContactPoint, TrackState, ScentSample, PursuerState } from '../types/pursuer';
import type { TrackingParams, ScentGrid } from '../types/scent';
import {
  ANIMAL_HEIGHT_OFFSET,
  ANIMAL_HALF_EXTENT,
  HEIGHT_SPEED_FACTOR
} from '../config/animalConfig';
import { DEFAULT_TRACKING_PARAMS } from '../config/trackingConfig';
import { DEFAULT_SCENT_PARAMS } from '../config/scentConfig';
import { sampleScentInSector, getLastContactDistance, estimatePatchiness } from './scentSampler';
import { getHeightAt, hasLineOfSight, isObstacleInFootprint } from './mapService';
import { resolveStuck, avoidObstacle } from './obstacleAvoidance';
import { DEFAULT_AVOIDANCE_PARAMS } from '../config/avoidanceConfig';
import { gwlcSigma, estimateTrailHeading } from './gwlc';

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
  /** 마지막 감지 이후 경과 시간 */
  lostTime: number;
  /** cast/lost 탐색 반경 */
  searchRadius: number;
  /** 추적 불확실도 (sigma) */
  sigma: number;
  /** lastContacts 기반 추정 이동 방향 */
  estimatedHeading: number;
  /** 조향 목표 방향 */
  targetHeading: number;
  /** cast 상태 좌우 스윕 방향 (+1 또는 -1) */
  castSide: number;
  /** 마지막 프레임 감지 신호 */
  lastTrailSignal: number;
  /** 최근 2개 contact 간 거리 (Chebyshev, world 단위) */
  lastContactDistance: number;
  /** 곡률 반지름 추정값 (EMA smoothing) */
  curvatureRadius: number;
  /** 시야로 감지한 대상 ID (없으면 null) */
  visionTargetId: string | null;
  /** 시야 감지 여부 (현재 프레임) */
  hasVisionContact: boolean;
  /** 추적 파라미터 (UI 연동) */
  trackingParams: TrackingParams;
  /** 추적 활성 여부 */
  isTracking: boolean;
  /** 지나온 grid cell 배열 (key: "ix,iy" 형식), 최근 10개 유지 */
  visitedCells: string[];
  /** 직전 프레임 곡률 반지름 (EMA smoothing용) */
  private _prevXi: number;
  private _baseBoundary: number = 0;
  private _halfSectorAngle: number = 0;
  private _currentFlipScale: number;
  private _avoidanceParams = DEFAULT_AVOIDANCE_PARAMS;
  private _stuckFrameCount: number = 0;
  /** lost 상태 탐색 중인 현재 동심원 거리 (1→2→3 순차) */
  _currentLostSearchRadius: number = 1;
  /** lost 상태에서 장애물/경계로 실패한 셀 Set (key: "gx,gy") */
  private _triedLostCells: Set<string>;
  /** lost 상태에서 persistent하게 추적 중인 target cell key ("gx,gy"), 없으면 null */
  private _currentLostTargetCell: string | null;
  currentSpeed: number = 0;

  get castBoundaryAngle(): number {
    return this._baseBoundary;
  }

  get flipScale(): number {
    return this._currentFlipScale;
  }

  get currentLostSearchRadius(): number {
    return this._currentLostSearchRadius;
  }

  /** 추적자 생성 (위치/추적 파라미터 초기화) */
  constructor(id: string, x: number, y: number, mapData: MapData, trackingParams?: TrackingParams) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.height = getHeightAt(mapData, x, y) + ANIMAL_HEIGHT_OFFSET;
    this.directionX = 0;
    this.directionY = 1;
    this.rotationAngle = Math.atan2(1, 0);
    this.castOriginX = x;
    this.castOriginY = y;
    this.targetId = null;
    this.state = 'track';
    this.lastContacts = [];
    this.lostTime = 0;
    this.searchRadius = 0;
    this.trackingParams = trackingParams ?? DEFAULT_TRACKING_PARAMS;
    this.sigma = this.trackingParams.sigmaBase;
    this.estimatedHeading = this.rotationAngle;
    this.targetHeading = this.rotationAngle;
    this.castSide = Math.random() < 0.5 ? 1 : -1;
    this.lastTrailSignal = 0;
    this.lastContactDistance = 0;
    this.curvatureRadius = this.trackingParams.xi;
    this.visionTargetId = null;
    this.hasVisionContact = false;
    this.isTracking = false;
    this.visitedCells = [];
    this._prevXi = this.trackingParams.xi;
    this._currentFlipScale = this.trackingParams.flipRampStart;
    this._stuckFrameCount = 0;
    this._triedLostCells = new Set();
    this._currentLostTargetCell = null;
  }

  /** 주어진 위치로 순간이동 (텔레포트) — 위치·높이·상태·visitedCells 전면 초기화, direction은 유지 */
  setPosition(x: number, y: number, mapData: MapData): void {
    this.x = x;
    this.y = y;
    this.height = getHeightAt(mapData, x, y) + ANIMAL_HEIGHT_OFFSET;
    this.state = 'track';
    this.lastContacts = [];
    this.lostTime = 0;
    this.searchRadius = 0;
    this.sigma = this.trackingParams.sigmaBase;
    this.estimatedHeading = this.rotationAngle;
    this.targetHeading = this.rotationAngle;
    this.castOriginX = x;
    this.castOriginY = y;
    this.visionTargetId = null;
    this.hasVisionContact = false;
    this.lastTrailSignal = 0;
    this.lastContactDistance = 0;
    this.curvatureRadius = this.trackingParams.xi;
    this.visitedCells = [];
    this._stuckFrameCount = 0;
    this._currentLostSearchRadius = 1;
    this._triedLostCells = new Set();
    this._currentLostTargetCell = null;
  }

  /** 개별 추적 파라미터 업데이트 */
  updateTrackingParam<K extends keyof TrackingParams>(key: K, value: TrackingParams[K]): void {
    this.trackingParams[key] = value;
  }
  // slider

  /** 현재 상태를 PursuerState로 반환 */
  toState(): PursuerState {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      height: this.height,
      directionX: this.directionX,
      directionY: this.directionY,
      rotationAngle: this.rotationAngle,
      castOriginX: this.castOriginX,
      castOriginY: this.castOriginY,
      targetId: this.targetId,
      state: this.state,
      lastContacts: [...this.lastContacts],
      lostTime: this.lostTime,
      searchRadius: this.searchRadius,
      sigma: this.sigma,
      estimatedHeading: this.estimatedHeading,
      targetHeading: this.targetHeading,
      castSide: this.castSide,
      lastTrailSignal: this.lastTrailSignal,
      visionTargetId: this.visionTargetId,
      hasVisionContact: this.hasVisionContact,
      visitedCells: [...this.visitedCells],
      speed: this.currentSpeed
    };
  }

  /** 강아지 추적 상태머신: scent 샘플링 → 상태 전환 → 속도/조향 결정 → 이동 */
  updateDogState(
    grid: ScentGrid,
    now: number,
    dt: number,
    mapData: MapData,
    otherEntities: ReadonlyArray<{ id: string; x: number; y: number }> = []
  ): void {
    if (!this.isTracking) return;

    // Vision check before scent sampling
    const visionTarget = this.detectVisionTarget(otherEntities, mapData);
    if (visionTarget) {
      this.visionTargetId = visionTarget.targetId;
      this.hasVisionContact = true;
    } else {
      this.visionTargetId = null;
      this.hasVisionContact = false;
    }

    const sample = this.buildDogScentSample(grid, now);
    const detected = sample.totalSignal > this.trackingParams.detectThreshold;

    if (detected) {
      this.lastTrailSignal = sample.totalSignal;
      this.lostTime = 0;
      this.searchRadius = 0;
      if (this.state === 'lost') {
        this._triedLostCells.clear();
        this._currentLostTargetCell = null;
      }
      this.state = 'track';

      // Record contact in grid cell coordinates via ScentGrid API
      const cell = grid.worldToCell(this.x, this.y);
      if (cell) {
        // Filter duplicate cell: skip if same cell as the last contact
        const lastContact =
          this.lastContacts.length > 0 ? this.lastContacts[this.lastContacts.length - 1] : null;
        if (!lastContact || lastContact.cx !== cell.cx || lastContact.cy !== cell.cy) {
          this.lastContacts.push({
            cx: cell.cx,
            cy: cell.cy,
            wx: this.x,
            wy: this.y,
            t: now,
            confidence: Math.min(1, sample.totalSignal / this.trackingParams.detectThreshold)
          });
          if (this.lastContacts.length > this.trackingParams.maxContacts) {
            this.lastContacts.splice(0, this.lastContacts.length - this.trackingParams.maxContacts);
          }
        }
      }

      // visitedCells: scent 감지된 셀만 기록
      const visitedCell = grid.worldToCell(this.x, this.y);
      if (visitedCell) {
        const visitedKey = `${visitedCell.cx},${visitedCell.cy}`;
        if (!this.visitedCells.includes(visitedKey)) {
          this.visitedCells.push(visitedKey);
          if (this.visitedCells.length > 10) {
            this.visitedCells.shift();
          }
        }
      }

      this.updateHeading(grid);
    } else {
      const scale = this.state === 'cast' ? this.trackingParams.castLostScale : 1;
      this.lostTime += dt * scale;
    }

    const lastContactDistance = getLastContactDistance(this.lastContacts);
    const patchiness = estimatePatchiness(this.lastContacts, now);

    this.lastContactDistance = lastContactDistance;

    this.sigma = this.updateSigma(lastContactDistance, this.lostTime, patchiness);
    this.curvatureRadius = this._prevXi;
    this.searchRadius = Math.min(
      this.trackingParams.initialRadius + this.trackingParams.kRadius * this.lostTime,
      this.trackingParams.lostRadius * 2
    );

    const stateBefore = this.state;
    if (stateBefore === 'track' && !detected) {
      this.state = 'surge';
    }
    if (stateBefore === 'surge') {
      let rFromContact = 0;
      if (this.lastContacts.length > 0) {
        const last = this.lastContacts[this.lastContacts.length - 1];
        const worldPos = grid.cellToWorld(last.cx, last.cy);
        if (worldPos) {
          rFromContact = Math.hypot(this.x - worldPos.x, this.y - worldPos.y);
        }
      }
      if (rFromContact * this.sigma > this.trackingParams.sensorRadius) {
        this.state = 'cast';
        this.castOriginX = this.x;
        this.castOriginY = this.y;
        this._halfSectorAngle = Math.min(this.sigma, this.trackingParams.castAngleMax);
        this._baseBoundary = Math.tan(this._halfSectorAngle * this.trackingParams.castFlipMargin);
        this._currentFlipScale = this.trackingParams.flipRampStart;
        this.targetHeading = this.normalizeAngle(
          this.estimatedHeading + this.castSide * this._halfSectorAngle * this._currentFlipScale
        );
        // Fix 1: cast entry boundary check — flip castSide if heading points to obstacle or map boundary
        const halfW = (mapData.width * mapData.cellSize) / 2;
        const halfD = (mapData.depth * mapData.cellSize) / 2;
        const boundaryMargin = ANIMAL_HALF_EXTENT;
        if (
          isObstacleInFootprint(
            mapData,
            this.x + Math.cos(this.targetHeading) * 0.3,
            this.y + Math.sin(this.targetHeading) * 0.3
          ) ||
          (this.x + boundaryMargin > halfW - boundaryMargin && Math.cos(this.targetHeading) > 0) ||
          (this.x - boundaryMargin < -halfW + boundaryMargin && Math.cos(this.targetHeading) < 0) ||
          (this.y + boundaryMargin > halfD - boundaryMargin && Math.sin(this.targetHeading) > 0) ||
          (this.y - boundaryMargin < -halfD + boundaryMargin && Math.sin(this.targetHeading) < 0)
        ) {
          this.castSide *= -1;
          this.targetHeading = this.normalizeAngle(
            this.estimatedHeading + this.castSide * this._halfSectorAngle * this._currentFlipScale
          );
        }
      }
    }
    if (stateBefore === 'cast' && this.searchRadius > this.trackingParams.lostRadius) {
      this.state = 'lost';
    }

    const sigma = this.sigma;
    let moveSpeed: number;

    // Vision override: approach target, stop when within stopDistance
    if (visionTarget) {
      const dx = visionTarget.x - this.x;
      const dy = visionTarget.y - this.y;
      const dist = Math.hypot(dx, dy);
      const STOP_DISTANCE = 2;

      if (dist <= STOP_DISTANCE) {
        moveSpeed = 0;
        this.targetHeading = this.rotationAngle; // keep current heading
      } else {
        this.targetHeading = Math.atan2(dy, dx);
        moveSpeed = this.trackingParams.maxSpeed;
      }
    } else if (this.state === 'track') {
      this.targetHeading = this.rotationAngle + (Math.PI / 6) * sample.netBias;

      moveSpeed = this.dynamicSpeed(sigma);
    } else if (this.state === 'surge') {
      this.targetHeading = this.blendHeading(
        this.estimatedHeading,
        sample.signalDirection,
        0.5 * sample.directionConfidence
      );

      moveSpeed = this.dynamicSpeed(sigma) * 0.8;
    } else if (this.state === 'cast') {
      const dx = this.x - this.castOriginX;
      const dy = this.y - this.castOriginY;
      const heading = this.estimatedHeading;
      const cosH = Math.cos(heading);
      const sinH = Math.sin(heading);

      // dot = forward 방향 거리 (heading에 정사영)
      // cross = 옆 방향 거리 (heading에 수직, +왼쪽)
      const dot = dx * cosH + dy * sinH;
      const cross = -dx * sinH + dy * cosH;

      // |cross| / max(|dot|, ε) = tan(각도차)
      const forwardDist = Math.abs(dot);
      const lateralDist = Math.abs(cross);
      const tanAngle = lateralDist / Math.max(forwardDist, 0.001);

      if (tanAngle >= this._baseBoundary && this.castSide * cross > 0) {
        const oldCastSide = this.castSide;
        const oldHeading = this.targetHeading;
        this.castSide *= -1;
        this.targetHeading = this.normalizeAngle(
          this.estimatedHeading + this.castSide * this._halfSectorAngle * this._currentFlipScale
        );
        // Fix 2: cancel flip if new heading points toward boundary
        if (
          isObstacleInFootprint(
            mapData,
            this.x + Math.cos(this.targetHeading) * 0.3,
            this.y + Math.sin(this.targetHeading) * 0.3
          )
        ) {
          this.castSide = oldCastSide;
          this.targetHeading = oldHeading;
        } else {
          this._currentFlipScale = Math.min(
            this._currentFlipScale + this.trackingParams.flipRampStep,
            this.trackingParams.castFlipScaleMax
          );
        }
      }

      moveSpeed = this.dynamicSpeed(sigma) * 0.5;
    } else {
      // lost
      const lastContact =
        this.lastContacts.length > 0 ? this.lastContacts[this.lastContacts.length - 1] : null;

      // persistent target 유지: 이미 target 있으면 도달 체크 후 heading 재계산
      if (this._currentLostTargetCell && lastContact) {
        const [tgx, tgy] = this._currentLostTargetCell.split(',').map(Number);
        const center = grid.cellToWorld(tgx, tgy);
        if (!center) {
          // target 셀이 grid 범위 밖 → 무효화
          this._triedLostCells.add(this._currentLostTargetCell);
          this._currentLostTargetCell = null;
        } else {
          const dist = Math.hypot(this.x - center.x, this.y - center.y);
          const arrivalThreshold = grid.scentCellSize * 0.5;
          if (dist < arrivalThreshold) {
            // 도달 → tried 처리 후 target 해제
            this._triedLostCells.add(this._currentLostTargetCell);
            this._currentLostTargetCell = null;
          } else {
            // 아직 이동 중 → 현재 위치에서 target 방향 heading 재계산 (장애물 회피 적용)
            const targetAngle = Math.atan2(center.y - this.y, center.x - this.x);
            this.targetHeading = avoidObstacle(
              this.x,
              this.y,
              targetAngle,
              mapData,
              this._avoidanceParams
            ).heading;
          }
        }
      }

      // target 없으면 새로 search
      if (!this._currentLostTargetCell && lastContact) {
        const cx = lastContact.cx;
        const cy = lastContact.cy;
        const maxSearchRadius = Math.min(
          8,
          Math.max(1, Math.ceil(this.trackingParams.visionRange / grid.scentCellSize))
        );
        for (let radius = 1; radius <= maxSearchRadius; radius++) {
          let foundThisRadius = false;

          for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
              // Only check perimeter cells at this radius
              if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

              const gx = cx + dx;
              const gy = cy + dy;
              const key = `${gx},${gy}`;

              if (this._triedLostCells.has(key)) continue;
              if (!this.visitedCells.includes(key)) {
                const center = grid.cellToWorld(gx, gy);
                if (!center) {
                  this._triedLostCells.add(key);
                  continue;
                }
                if (isObstacleInFootprint(mapData, center.x, center.y)) {
                  this._triedLostCells.add(key);
                  continue;
                }
                this._currentLostTargetCell = key;
                this._currentLostSearchRadius = radius;
                const targetAngle = Math.atan2(center.y - this.y, center.x - this.x);
                this.targetHeading = avoidObstacle(
                  this.x,
                  this.y,
                  targetAngle,
                  mapData,
                  this._avoidanceParams
                ).heading;
                foundThisRadius = true;
                break;
              }
            }
            if (foundThisRadius) break;
          }

          if (foundThisRadius) break;
        }
      }

      moveSpeed = this.trackingParams.minSpeed;
    }

    this.currentSpeed = moveSpeed;

    this.directionX = Math.cos(this.rotationAngle);
    this.directionY = Math.sin(this.rotationAngle);

    // cast obstacle pre-check: rotationAngle may not have caught up to safe targetHeading
    if (this.state === 'cast') {
      const footDist = ANIMAL_HALF_EXTENT;
      const checkX = this.x + this.directionX * footDist;
      const checkY = this.y + this.directionY * footDist;
      // Use isObstacleInFootprint but only for terrain obstacles, not map boundaries
      // (boundary clamping in applyMovement handles the edge case)
      const mw2 = (mapData.width * mapData.cellSize) / 2;
      const md2 = (mapData.depth * mapData.cellSize) / 2;
      if (
        checkX > -mw2 + ANIMAL_HALF_EXTENT &&
        checkX < mw2 - ANIMAL_HALF_EXTENT &&
        checkY > -md2 + ANIMAL_HALF_EXTENT &&
        checkY < md2 - ANIMAL_HALF_EXTENT
      ) {
        if (isObstacleInFootprint(mapData, checkX, checkY)) {
          const avoidResult = avoidObstacle(
            this.x,
            this.y,
            this.targetHeading,
            mapData,
            this._avoidanceParams
          );
          this.rotationAngle = avoidResult.heading;
          this.directionX = Math.cos(this.rotationAngle);
          this.directionY = Math.sin(this.rotationAngle);
        }
      }
    }

    const { newX, newY, newHeight } = this.applyMovement(
      this.directionX,
      this.directionY,
      dt,
      moveSpeed,
      mapData,
      otherEntities,
      sample.sectorSignals
    );

    this.x = newX;
    this.y = newY;
    this.height = newHeight;
    const angleDiff = this.shortestAngleDiff(this.targetHeading, this.rotationAngle);
    const turnRate =
      this.state === 'cast' ? this.trackingParams.flipTurnRate : this.trackingParams.trackTurnRate;
    this.rotationAngle += angleDiff * Math.min(1, turnRate * dt);
  }

  /** 장애물·충돌·경사 고려 실제 이동 계산 */
  private applyMovement(
    dx: number,
    dy: number,
    dt: number,
    speed: number,
    mapData: MapData,
    otherEntities: ReadonlyArray<{ x: number; y: number }> = [],
    scentSignals?: { left: number; right: number }
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

    // Stuck detection + obstacle avoidance integration
    const xAttempted = Math.abs(dx) > 1e-9;
    const yAttempted = Math.abs(dy) > 1e-9;
    const xBlocked = xAttempted && Math.abs(finalDx) < 1e-9;
    const yBlocked = yAttempted && Math.abs(finalDy) < 1e-9;
    const isStuck = (finalDx === 0 && finalDy === 0) || xBlocked || yBlocked;

    if (isStuck) {
      this._stuckFrameCount++;
    } else {
      this._stuckFrameCount = 0;
    }

    if (this._stuckFrameCount >= 2) {
      this._stuckFrameCount = 0;
      let avoidResult: { heading: number; shouldBacktrack: boolean };

      if (this.state === 'cast') {
        // cast: 장애물 만나면 즉시 flip (경계 방향이면 무시)
        const newCastSide = this.castSide * -1;
        const newHeading = this.normalizeAngle(
          this.estimatedHeading + newCastSide * this._halfSectorAngle * this._currentFlipScale
        );
        if (
          !isObstacleInFootprint(
            mapData,
            this.x + Math.cos(newHeading) * 0.3,
            this.y + Math.sin(newHeading) * 0.3
          )
        ) {
          this.castSide = newCastSide;
          this.targetHeading = newHeading;
        }
        avoidResult = resolveStuck(
          this.x,
          this.y,
          this.targetHeading,
          this.castSide,
          mapData,
          this._avoidanceParams,
          this.visitedCells,
          scentSignals
        );
      } else if (this.state === 'lost') {
        // lost: 랜덤 회피 heading으로 탈출 (triedCells 유지 — 실패 셀 재시도 방지)
        const avoidAngle =
          this.rotationAngle +
          (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2 + (Math.random() * Math.PI) / 2);
        avoidResult = resolveStuck(
          this.x,
          this.y,
          avoidAngle,
          this.castSide,
          mapData,
          this._avoidanceParams,
          this.visitedCells,
          scentSignals
        );
        this.targetHeading = avoidResult.heading;
      } else {
        avoidResult = resolveStuck(
          this.x,
          this.y,
          this.targetHeading,
          this.castSide,
          mapData,
          this._avoidanceParams,
          this.visitedCells,
          scentSignals
        );
      }

      this.targetHeading = avoidResult.heading;

      // 회피 heading으로 재계산
      const avoidDx = Math.cos(this.targetHeading);
      const avoidDy = Math.sin(this.targetHeading);
      finalDx = avoidDx;
      finalDy = avoidDy;
    }

    const heightDiff = Math.abs(
      getHeightAt(mapData, this.x + finalDx * speedScaled, this.y + finalDy * speedScaled) -
        getHeightAt(mapData, this.x, this.y)
    );
    const heightFactor = Math.max(0.2, 1 - heightDiff * HEIGHT_SPEED_FACTOR);

    const resultX = this.x + finalDx * speedScaled * heightFactor;
    const resultY = this.y + finalDy * speedScaled * heightFactor;

    // Clamp to map world boundaries with ANIMAL_HALF_EXTENT margin
    const halfW = (mapData.width * mapData.cellSize) / 2;
    const halfD = (mapData.depth * mapData.cellSize) / 2;
    const margin = ANIMAL_HALF_EXTENT;
    const clampedX = this.clamp(resultX, -halfW + margin, halfW - margin);
    const clampedY = this.clamp(resultY, -halfD + margin, halfD - margin);

    return {
      newX: clampedX,
      newY: clampedY,
      newHeight: getHeightAt(mapData, clampedX, clampedY) + ANIMAL_HEIGHT_OFFSET
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

  /** 각도를 [-π, π] 범위로 정규화 */
  private normalizeAngle(angle: number): number {
    angle = angle % TWO_PI;
    if (angle > Math.PI) angle -= TWO_PI;
    if (angle < -Math.PI) angle += TWO_PI;
    return angle;
  }

  /** lastContacts 기반 trail heading 추정 (GWLC propagator).
   *  contacts.length >= 2 일 때 estimateTrailHeading으로 갱신, 미만이면 유지. */
  private updateHeading(_grid: ScentGrid): void {
    if (this.lastContacts.length < 2) return;
    const tp = this.trackingParams;
    const heading = estimateTrailHeading(this.lastContacts, tp.lambda, tp.xi);
    if (!isNaN(heading)) {
      this.estimatedHeading = heading;
    }
  }

  /** sigma 업데이트: gwlcSigma + lost·patch 반영 */
  private updateSigma(lastContactDistance: number, lostTime: number, patchiness: number): number {
    const tp = this.trackingParams;
    const xi = this.estimateCurvatureRadius();
    const L = lastContactDistance;

    const sigmaTrail = gwlcSigma(L, tp.lambda, xi);

    return this.clamp(
      sigmaTrail + tp.kLost * lostTime + tp.kPatch * patchiness,
      tp.sigmaMin,
      tp.sigmaMax
    );
  }

  /** lastContacts의 최근 3개 접촉점으로 외접원 반지름(곡률) 계산 후 EMA smoothing */
  estimateCurvatureRadius(): number {
    const contacts = this.lastContacts;
    if (contacts.length < 3) {
      this._prevXi = this.trackingParams.xi;
      return this._prevXi;
    }

    const p0 = contacts[contacts.length - 3];
    const p1 = contacts[contacts.length - 2];
    const p2 = contacts[contacts.length - 1];

    const a = Math.max(Math.abs(p1.wx - p0.wx), Math.abs(p1.wy - p0.wy));
    const b = Math.max(Math.abs(p2.wx - p1.wx), Math.abs(p2.wy - p1.wy));
    const c = Math.max(Math.abs(p2.wx - p0.wx), Math.abs(p2.wy - p0.wy));

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

  /**
   * 시야 cone 내에 있는 pursued 중 가장 가까운 것 반환.
   * 조건: cone 각도 내 + visionRange 내 + 장애물 가시선 확보
   */
  private detectVisionTarget(
    pursuedList: ReadonlyArray<{ id: string; x: number; y: number }>,
    mapData: MapData
  ): { targetId: string; x: number; y: number } | null {
    let closest: { targetId: string; x: number; y: number } | null = null;
    let closestDist = Infinity;

    for (const pursued of pursuedList) {
      const dx = pursued.x - this.x;
      const dy = pursued.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist > this.trackingParams.visionRange) continue;

      const angleToTarget = Math.atan2(dy, dx);
      const relativeAngle = this.normalizeAngle(angleToTarget - this.rotationAngle);

      if (Math.abs(relativeAngle) > this.trackingParams.visionConeAngle) continue;

      if (!hasLineOfSight(mapData, this.x, this.y, pursued.x, pursued.y)) continue;

      if (dist < closestDist) {
        closestDist = dist;
        closest = { targetId: pursued.id, x: pursued.x, y: pursued.y };
      }
    }

    return closest;
  }

  /** 센서 3섹터(좌·중·우) 샘플링 → netBias·signalDirection·confidence 산출 */
  private buildDogScentSample(grid: ScentGrid, now: number): ScentSample {
    const fanAngle = this.trackingParams.sensorFanAngle;
    const halfFan = fanAngle / 2;
    const sectorWidth = fanAngle / 3;
    const maxRadius = this.trackingParams.sensorRadius;
    const origin = { x: this.x, y: this.y };
    const facing = this.rotationAngle;

    const visitedParam = this.visitedCells;

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
      grid,
      now,
      params,
      visitedParam
    );
    const left = sampleScentInSector(
      origin,
      facing,
      -halfFan,
      -sectorWidth / 2,
      maxRadius,
      grid,
      now,
      params,
      visitedParam
    );
    const right = sampleScentInSector(
      origin,
      facing,
      sectorWidth / 2,
      halfFan,
      maxRadius,
      grid,
      now,
      params,
      visitedParam
    );

    let trailHeading = this.estimatedHeading;

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

    return {
      totalSignal,
      signalDirection,
      directionConfidence: confidence,
      netBias,
      sectorSignals: { left: left.totalSignal, right: right.totalSignal }
    };
  }
}
