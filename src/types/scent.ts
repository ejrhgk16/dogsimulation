export type AnimalType = 'dog' | 'cow' | 'pig' | string;

export interface ScentPoint {
  animalId: string;
  animalType: AnimalType;
  x: number;
  y: number;
  height: number;
  t: number;
  baseIntensity: number;
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
  maxTrailAge: number;
  tauDecay: number;
  scentSpreadSigma: number;
  tauDecayMin: number;
  tauDecayMax: number;
  emitSpacing: number;
}

export interface AnimalScentProfile extends ScentParams {
  animalType: AnimalType;
  baseIntensity: number;
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

export interface ScentWorldState {
  trailPoints: ScentPoint[];
  emitters: Map<string, EmitAccumulator>;
}
