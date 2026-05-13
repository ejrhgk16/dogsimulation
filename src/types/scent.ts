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
}

export interface ScentWorldState {
  trailPoints: ScentPoint[];
  emitters: Map<string, EmitAccumulator>;
}
