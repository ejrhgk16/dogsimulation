import type { ObstacleAvoidanceParams } from '../types/obstacleAvoidance';

export const DEFAULT_AVOIDANCE_PARAMS: ObstacleAvoidanceParams = {
  rayCount: 12,
  rayStepDist: 0.3,
  rayMaxDist: 5,
  weightHeading: 0.4,
  weightObstacle: 0.6,
  retraceTimeout: 5
};
