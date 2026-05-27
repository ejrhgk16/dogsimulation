import type { MapData } from '../types/map';
import type { ObstacleAvoidanceParams, ObstacleAvoidanceResult } from '../types/obstacleAvoidance';
import { isObstacleInFootprint } from './mapService';
import { DEFAULT_SCENT_CELL_SIZE } from '../config/scentConfig';

const TWO_PI = 2 * Math.PI;
const THREE_PI = 3 * Math.PI;

/** 모듈 수준 wall-follow 방향 지속성 (랜덤 선택 유지) */
let _wallFollowSide: number | null = null;

/** wall-follow 방향 상태 리셋 (테스트/언스턱) */
export function resetWallFollowSide(): void {
  _wallFollowSide = null;
}

/** 현재 wall-follow 방향 상태 조회 */
export function getWallFollowSide(): number | null {
  return _wallFollowSide;
}

/** wall-follow 방향 상태 설정 */
export function setWallFollowSide(side: number | null): void {
  _wallFollowSide = side;
}

/** 각도를 [-PI, PI] 범위로 정규화 */
function normalizeAngle(angle: number): number {
  angle = angle % TWO_PI;
  if (angle > Math.PI) angle -= TWO_PI;
  if (angle < -Math.PI) angle += TWO_PI;
  return angle;
}

/** 목표-현재 사이 최단 부호 각도 차이 [-PI, PI] */
function shortestAngleDiff(target: number, current: number): number {
  return ((((target - current) % TWO_PI) + THREE_PI) % TWO_PI) - Math.PI;
}

/**
 * 주어진 방향으로 레이캐스트, stepDist 간격으로 장애물/경계 또는 maxDist까지 전진
 * 첫 장애물까지 거리 반환, 없으면 maxDist
 */
export function rayDistance(
  x: number,
  y: number,
  angle: number,
  mapData: MapData,
  maxDist: number,
  stepDist: number
): number {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const steps = Math.max(1, Math.floor(maxDist / stepDist));

  for (let i = 1; i <= steps; i++) {
    const sx = x + cosA * i * stepDist;
    const sy = y + sinA * i * stepDist;
    if (isObstacleInFootprint(mapData, sx, sy)) {
      return i * stepDist;
    }
  }
  return maxDist;
}

/**
 * 후보 방향 점수 산정 (헤딩 정렬 + 장애물 거리)
 * 가중합 반환: params.weightHeading * headingAlignment + params.weightObstacle * obstacleScore
 */
export function scoreDirection(
  desiredHeading: number,
  sampleAngle: number,
  dist: number,
  params: ObstacleAvoidanceParams
): number {
  const headingAlignment = 1 - Math.abs(shortestAngleDiff(sampleAngle, desiredHeading)) / Math.PI;
  const obstacleScore = Math.min(dist / params.rayMaxDist, 1);
  return params.weightHeading * headingAlignment + params.weightObstacle * obstacleScore;
}

/**
 * wall-follow 방향 우선순위용 좌/우 섹터 신호를 가진 향 샘플
 */
export interface ScentSectorSignals {
  left: number;
  right: number;
}

/**
 * 전방 방향 점수 산정, 최적 방향 선택. 전부 막혔으면 wall-follow 진입
 * @param scentBias 향 샘플링 netBias (-1..1, 음수=좌, 양수=우)
 */
export function avoidObstacle(
  x: number,
  y: number,
  desiredHeading: number,
  mapData: MapData,
  params: ObstacleAvoidanceParams,
  scentBias?: number
): ObstacleAvoidanceResult {
  // 향 바이어스를 desired heading에 적용
  const adjustedHeading =
    scentBias !== undefined ? desiredHeading + scentBias * (Math.PI / 6) : desiredHeading;

  const halfSpan = Math.PI / 2;
  const rayCount = params.rayCount;
  let bestScore = -Infinity;
  let bestAngle = adjustedHeading;
  let anyClear = false;

  for (let i = 0; i < rayCount; i++) {
    const t = rayCount > 1 ? i / (rayCount - 1) : 0.5;
    const sampleAngle = normalizeAngle(adjustedHeading - halfSpan + t * (2 * halfSpan));
    const dist = rayDistance(x, y, sampleAngle, mapData, params.rayMaxDist, params.rayStepDist);

    // 최소 한 스텝 이상 진행 가능하면 clear로 간주
    const isClear = dist > params.rayStepDist;

    if (isClear) {
      anyClear = true;
      const score = scoreDirection(adjustedHeading, sampleAngle, dist, params);
      if (score > bestScore) {
        bestScore = score;
        bestAngle = sampleAngle;
      }
    }
  }

  if (anyClear) {
    return {
      heading: normalizeAngle(bestAngle),
      shouldBacktrack: false,
      isWallFollowing: false
    };
  }

  // 전부 막힘 → wall-follow
  return wallFollow(x, y, bestAngle, 1, mapData, params);
}

/**
 * Wall-follow 모드: 좌/우 여유 공간 측정, 우선순위 규칙으로 방향 선택
 * 우선순위: 1) 향 신호 2) 더 긴 레이 3) castSide 4) 랜덤(고정)
 */
export function wallFollow(
  x: number,
  y: number,
  heading: number,
  castSide: number,
  mapData: MapData,
  params: ObstacleAvoidanceParams,
  scentSample?: ScentSectorSignals
): ObstacleAvoidanceResult {
  const leftAngle = normalizeAngle(heading + Math.PI / 2);
  const rightAngle = normalizeAngle(heading - Math.PI / 2);

  const leftDist = rayDistance(x, y, leftAngle, mapData, params.rayMaxDist, params.rayStepDist);
  const rightDist = rayDistance(x, y, rightAngle, mapData, params.rayMaxDist, params.rayStepDist);

  const bothBlocked = leftDist < params.rayStepDist * 2 && rightDist < params.rayStepDist * 2;

  if (bothBlocked) {
    return {
      heading: normalizeAngle(heading),
      shouldBacktrack: true,
      isWallFollowing: true
    };
  }

  // 우선순위 1: 향 신호
  if (scentSample) {
    if (scentSample.right > scentSample.left) {
      return { heading: normalizeAngle(rightAngle), shouldBacktrack: false, isWallFollowing: true };
    }
    if (scentSample.left > scentSample.right) {
      return { heading: normalizeAngle(leftAngle), shouldBacktrack: false, isWallFollowing: true };
    }
  }

  // 우선순위 2: 더 긴 레이 거리
  if (Math.abs(leftDist - rightDist) > params.rayStepDist * 0.5) {
    const chosenAngle = leftDist > rightDist ? leftAngle : rightAngle;
    return { heading: normalizeAngle(chosenAngle), shouldBacktrack: false, isWallFollowing: true };
  }

  // 우선순위 3: castSide
  if (castSide !== 0) {
    const chosenAngle = castSide > 0 ? leftAngle : rightAngle;
    return { heading: normalizeAngle(chosenAngle), shouldBacktrack: false, isWallFollowing: true };
  }

  // 우선순위 4: 랜덤(고정)
  if (_wallFollowSide === null) {
    _wallFollowSide = Math.random() < 0.5 ? 1 : -1;
  }
  const chosenAngle = _wallFollowSide > 0 ? leftAngle : rightAngle;
  return { heading: normalizeAngle(chosenAngle), shouldBacktrack: false, isWallFollowing: true };
}

/**
 * 백트래킹 시 방문하지 않은 최적 방향 탐색
 * 추적자 주변 7x7 그리드(반경 3) 스캔, 현재 헤딩 기준 120° 이내 미방문 셀 각도 수집, 평균 각도 반환
 * 모든 셀 방문 시 null 반환
 */
export function findBestUnvisitedAngle(
  x: number,
  y: number,
  heading: number,
  visitedCells: Set<string>
): number | null {
  const scanRadius = 3;
  const cellSize = DEFAULT_SCENT_CELL_SIZE;
  const sx = Math.floor(x / cellSize);
  const sy = Math.floor(y / cellSize);
  let bestAngle: number | null = null;
  let bestCount = 0;

  for (let dx = -scanRadius; dx <= scanRadius; dx++) {
    for (let dy = -scanRadius; dy <= scanRadius; dy++) {
      if (dx === 0 && dy === 0) continue;
      const key = `${sx + dx},${sy + dy}`;
      if (visitedCells.has(key)) continue;

      const angle = Math.atan2(dy, dx);
      // 전방 진행 선호 (헤딩 기준 120° 이내)
      const diff = normalizeAngle(angle - heading);
      if (Math.abs(diff) > (2 * Math.PI) / 3) continue;

      if (bestAngle === null) {
        bestAngle = angle;
        bestCount = 1;
      } else {
        bestAngle = (bestAngle * bestCount + angle) / (bestCount + 1);
        bestCount++;
      }
    }
  }
  return bestAngle;
}

/**
 * 스턱 상태 해결: avoidObstacle 시도, 실패 시 wall-follow, 필요 시 backtrack
 */
export function resolveStuck(
  x: number,
  y: number,
  heading: number,
  castSide: number,
  mapData: MapData,
  params: ObstacleAvoidanceParams,
  visitedCells: Set<string>,
  scentSample?: ScentSectorSignals
): { heading: number; shouldBacktrack: boolean } {
  const avoidanceResult = avoidObstacle(x, y, heading, mapData, params);

  if (!avoidanceResult.isWallFollowing) {
    // clear 방향 발견
    _wallFollowSide = null;
    return { heading: avoidanceResult.heading, shouldBacktrack: false };
  }

  // 전부 막힘 → wall-follow
  const wallResult = wallFollow(x, y, heading, castSide, mapData, params, scentSample);

  if (wallResult.shouldBacktrack) {
    // 백트래킹: 근처 미방문 셀로 방향 전환
    const bestAngle = findBestUnvisitedAngle(x, y, heading, visitedCells);
    if (bestAngle !== null) {
      return { heading: normalizeAngle(bestAngle), shouldBacktrack: true };
    }
    // 폴백: 반대 방향 회전
    return { heading: normalizeAngle(heading + Math.PI), shouldBacktrack: true };
  }

  return { heading: wallResult.heading, shouldBacktrack: false };
}
