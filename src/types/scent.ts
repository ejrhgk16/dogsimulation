export type OwnerType = 'dog' | 'cow' | 'pig' | string;

export interface ScentPoint {
  ownerId: string;
  ownerType: OwnerType;
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
  ownerId: string;
  ownerType: OwnerType;
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

export interface OwnerScentProfile extends ScentParams {
  ownerType: OwnerType;
  baseIntensity: number;
  emitInterval: number;
  emitSpacing: number;
  emitProbability: number;
  spreadRadius: number;
}

export interface ScentVisualConfig {
  pointSize: number;
  minHeight: number;
  ownerColorMap: Record<string, number>;
}

export interface ScentWorldState {
  trailPoints: ScentPoint[];
  emitters: Map<string, EmitAccumulator>;
}
