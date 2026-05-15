export type AnimalType = 'dog' | 'cow' | 'pig' | string;

export interface ScentPoint {
  animalId: string;
  animalType: AnimalType;
  x: number;
  y: number;
  height: number;
  t: number;
  tauDecay?: number;
}

export interface EmitAccumulator {
  timeSinceLastEmit: number;
  distanceSinceLast: number;
  animalId: string;
  animalType: AnimalType;
  lastX: number;
  lastY: number;
  lastHeight: number;
}

export interface ScentParams {
  tauDecay: number;
  scentSpreadSigma: number;
  emitSpacing: number;
}

export interface AnimalScentProfile extends ScentParams {
  animalType: AnimalType;
  emitInterval: number;
  emitSpacing: number;
  emitProbability: number;
  spreadRadius: number;
}

export interface ScentVisualConfig {
  pointSize: number;
  minHeight: number;
  animalColorMap: Record<string, number>;
}

export interface TrackingParams {
  sensorRadius: number;
  /** 부채꼴 센서의 총 각도 (라디안). 기본값은 Math.PI / 2 (90°). */
  sensorFanAngle: number;
  detectThreshold: number;
  tauMemory: number;
  sigmaBase: number;
  sigmaMin: number;
  sigmaMax: number;
  lambda: number;
  xi: number;
  kLost: number;
  kPatch: number;
  initialRadius: number;
  kRadius: number;
  castAngleMax: number;
  castTurnTolerance: number;
  lostRadius: number;
  lostTurnRate: number;
  surgeDuration: number;
  maxContacts: number;
  minSpeed: number;
  maxSpeed: number;
  kSpeedSigma: number;
  /** sector envelope multiplier (Θ₀ >> 1, 논문 Fig.3A). cast sweep 반각 = sigma * theta0 */
  theta0: number;
  /** radial distance contribution weight to sigma. sigma += kRadial * r */
  kRadial: number;
  /** cast 상태에서 lostTime 누적 배율 (기본 1.0). 0으로 두면 cast 고정 */
  castLostScale: number;
  /** cast flip 마진 (0.3~1.0). _baseBoundary = tan(halfSectorAngle * margin). 작을수록 더 자주 flip */
  castFlipMargin: number;
  /** cast flip 시 꺾는 각도 배율 (0.3~2.0). castSide * halfSectorAngle * scale. 1.0=경계선까지, 작을수록 좁은 각도 */
  castFlipAngleScale: number;
}

export interface ScentWorldState {
  trailPoints: ScentPoint[];
  emitters: Map<string, EmitAccumulator>;
}
