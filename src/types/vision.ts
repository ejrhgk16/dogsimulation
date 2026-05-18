export interface VisionParams {
  /** 시야 감지 최대 거리 */
  visionRange: number;
  /** 시야 cone 반각 (라디안). 전체 cone 각도 = 2 * visionConeAngle */
  visionConeAngle: number;
}
