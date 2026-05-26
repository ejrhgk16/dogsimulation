export interface ObstacleAvoidanceParams {
  /** 전방 스캔할 방향 개수 (desiredHeading 기준 ±90° 내 샘플링) */
  rayCount: number;
  /** ray 한 스텝 거리 (m), 작을수록 정밀 */
  rayStepDist: number;
  /** ray 최대 탐색 거리 (m) */
  rayMaxDist: number;
  /** headingAlignment 가중치 (0~1) */
  weightHeading: number;
  /** obstacleDistance 가중치 (0~1) */
  weightObstacle: number;
  /** wall-follow stuck timeout (초), retrace에서 이 시간 초과 시 포기 */
  retraceTimeout: number;
}

export interface ObstacleAvoidanceResult {
  /** 보정된 heading (rad) */
  heading: number;
  /** 전방이 모두 막혀 backtrack이 필요한지 */
  shouldBacktrack: boolean;
  /** wall-follow 모드인지 */
  isWallFollowing: boolean;
}
