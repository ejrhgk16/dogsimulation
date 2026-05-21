import type { MapData } from '../types/map';
import type { ObstacleAvoidanceParams, ObstacleAvoidanceResult } from '../types/obstacleAvoidance';
import { isObstacleInFootprint } from './mapService';

const TWO_PI = 2 * Math.PI;
const THREE_PI = 3 * Math.PI;

/** Module-level wall-follow side persistence (random choice stays sticky) */
let _wallFollowSide: number | null = null;

/** Reset wall-follow side state (for tests / unstuck) */
export function resetWallFollowSide(): void {
  _wallFollowSide = null;
}

/** Get current wall-follow side state */
export function getWallFollowSide(): number | null {
  return _wallFollowSide;
}

/** Set wall-follow side state */
export function setWallFollowSide(side: number | null): void {
  _wallFollowSide = side;
}

/** Normalize angle to [-PI, PI] */
function normalizeAngle(angle: number): number {
  angle = angle % TWO_PI;
  if (angle > Math.PI) angle -= TWO_PI;
  if (angle < -Math.PI) angle += TWO_PI;
  return angle;
}

/** Shortest signed angle difference target - current in [-PI, PI] */
function shortestAngleDiff(target: number, current: number): number {
  return ((((target - current) % TWO_PI) + THREE_PI) % TWO_PI) - Math.PI;
}

/**
 * Ray-cast in given direction, stepping by stepDist until obstacle/boundary or maxDist.
 * Returns distance to first blocked point, or maxDist if clear.
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
 * Score a candidate direction based on heading alignment and obstacle distance.
 * Returns weighted sum: params.weightHeading * headingAlignment + params.weightObstacle * obstacleScore
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
 * Scent sample with left/right sector signals for wall-follow direction priority.
 */
export interface ScentSectorSignals {
  left: number;
  right: number;
}

/**
 * Score front directions, pick best clear one. If all blocked, enter wall-follow.
 * @param scentBias Optional netBias from scent sampling (-1..1, negative=left, positive=right)
 */
export function avoidObstacle(
  x: number,
  y: number,
  desiredHeading: number,
  mapData: MapData,
  params: ObstacleAvoidanceParams,
  scentBias?: number
): ObstacleAvoidanceResult {
  // Apply scent bias to desired heading
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

    // Consider a direction "clear" if it gets past at least one step
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

  // All blocked → wall-follow
  return wallFollow(x, y, bestAngle, 1, mapData, params);
}

/**
 * Wall-follow mode: measure left/right clearance, apply priority rules to pick direction.
 * Priority: 1) scent signal side 2) longer ray side 3) castSide 4) random (sticky)
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

  // Priority 1: scent signal
  if (scentSample) {
    if (scentSample.right > scentSample.left) {
      return { heading: normalizeAngle(rightAngle), shouldBacktrack: false, isWallFollowing: true };
    }
    if (scentSample.left > scentSample.right) {
      return { heading: normalizeAngle(leftAngle), shouldBacktrack: false, isWallFollowing: true };
    }
  }

  // Priority 2: longer ray distance
  if (Math.abs(leftDist - rightDist) > params.rayStepDist * 0.5) {
    const chosenAngle = leftDist > rightDist ? leftAngle : rightAngle;
    return { heading: normalizeAngle(chosenAngle), shouldBacktrack: false, isWallFollowing: true };
  }

  // Priority 3: castSide
  if (castSide !== 0) {
    const chosenAngle = castSide > 0 ? leftAngle : rightAngle;
    return { heading: normalizeAngle(chosenAngle), shouldBacktrack: false, isWallFollowing: true };
  }

  // Priority 4: random (sticky)
  if (_wallFollowSide === null) {
    _wallFollowSide = Math.random() < 0.5 ? 1 : -1;
  }
  const chosenAngle = _wallFollowSide > 0 ? leftAngle : rightAngle;
  return { heading: normalizeAngle(chosenAngle), shouldBacktrack: false, isWallFollowing: true };
}

/**
 * Resolve stuck state: try avoidObstacle, fall back to wall-follow,
 * then backtrack if needed using trailMemory.
 */
export function resolveStuck(
  x: number,
  y: number,
  heading: number,
  castSide: number,
  mapData: MapData,
  params: ObstacleAvoidanceParams,
  trailMemory: { x: number; y: number }[],
  scentSample?: ScentSectorSignals
): { heading: number; shouldBacktrack: boolean } {
  const avoidanceResult = avoidObstacle(x, y, heading, mapData, params);

  if (!avoidanceResult.isWallFollowing) {
    // Found a clear direction
    _wallFollowSide = null;
    return { heading: avoidanceResult.heading, shouldBacktrack: false };
  }

  // All blocked → wall-follow
  const wallResult = wallFollow(x, y, heading, castSide, mapData, params, scentSample);

  if (wallResult.shouldBacktrack) {
    // Backtrack: prefer trailMemory direction, else reverse
    if (trailMemory.length >= 2) {
      const prev = trailMemory[trailMemory.length - 2];
      const dx = prev.x - x;
      const dy = prev.y - y;
      if (Math.abs(dx) > 1e-9 || Math.abs(dy) > 1e-9) {
        const backtrackHeading = Math.atan2(dy, dx);
        return { heading: normalizeAngle(backtrackHeading), shouldBacktrack: true };
      }
    }
    // Fallback: reverse direction
    return { heading: normalizeAngle(heading + Math.PI), shouldBacktrack: true };
  }

  return { heading: wallResult.heading, shouldBacktrack: false };
}
