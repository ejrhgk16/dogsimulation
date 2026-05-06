export type OwnerType = 'dog' | 'cow' | 'pig' | string;

export interface ScentPoint {
  ownerId: string;
  ownerType: OwnerType;
  x: number;
  y: number;
  t: number;
  baseIntensity: number;
  tauDecay?: number;
}

export interface EmitAccumulator {
  distanceSinceLast: number;
  ownerId: string;
  ownerType: OwnerType;
  lastX: number;
  lastY: number;
}

export interface ScentParams {
  maxTrailAge: number;
  tauDecay: number;
  scentSpreadSigma: number;
  tauDecayMin?: number;
  tauDecayMax?: number;
}

export interface OwnerScentProfile extends ScentParams {
  ownerType: OwnerType;
  baseIntensity: number;
  emitSpacing: number;
  emitProbability: number;
  lateralSpreadSigma: number;
}

export interface ScentVisualConfig {
  pointSize: number;
  minHeight: number;
  maxHeight: number;
  ownerColorMap: Record<string, number>;
}

export interface ScentWorldState {
  trailPoints: ScentPoint[];
  emitters: Map<string, EmitAccumulator>;
}
