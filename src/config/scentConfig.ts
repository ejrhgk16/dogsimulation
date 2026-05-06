import type { OwnerScentProfile, ScentParams, ScentVisualConfig } from '../types/scent';

export const DEFAULT_SCENT_PARAMS: ScentParams = {
  maxTrailAge: 25000,
  tauDecay: 8000,
  scentSpreadSigma: 2.0,
  tauDecayMin: 6000,
  tauDecayMax: 10000,
  emitSpacing: 1.0
};

export const OWNER_PROFILES: Record<string, OwnerScentProfile> = {
  dog: {
    ...DEFAULT_SCENT_PARAMS,
    ownerType: 'dog',
    baseIntensity: 1.0,
    emitInterval: 200,
    emitProbability: 0.8,
    spreadRadius: 0.75,
    emitSpacing: 0.5,
    tauDecayMin: 6000,
    tauDecayMax: 10000
  },
  cow: {
    ...DEFAULT_SCENT_PARAMS,
    ownerType: 'cow',
    baseIntensity: 1.5,
    emitInterval: 300,
    emitProbability: 0.6,
    spreadRadius: 2.0,
    emitSpacing: 1.0,
    tauDecayMin: 8000,
    tauDecayMax: 14000
  },
  pig: {
    ...DEFAULT_SCENT_PARAMS,
    ownerType: 'pig',
    baseIntensity: 0.8,
    emitInterval: 150,
    emitProbability: 0.9,
    spreadRadius: 1.2,
    emitSpacing: 0.3,
    tauDecayMin: 4000,
    tauDecayMax: 8000
  }
};

export const DEFAULT_SCENT_VISUAL_CONFIG: ScentVisualConfig = {
  pointSize: 0.18,
  minHeight: 0.05,
  ownerColorMap: {
    dog: 0xff9933,
    cow: 0x44aa44,
    pig: 0xff6688
  }
};

export function getOwnerProfile(ownerType: string): OwnerScentProfile {
  const existing = OWNER_PROFILES[ownerType];
  if (existing) {
    return existing;
  }
  return {
    ...DEFAULT_SCENT_PARAMS,
    ownerType,
    baseIntensity: 1.0,
    emitInterval: 250,
    emitProbability: 0.5,
    spreadRadius: 0.75,
    emitSpacing: DEFAULT_SCENT_PARAMS.emitSpacing,
    tauDecayMin: DEFAULT_SCENT_PARAMS.tauDecayMin,
    tauDecayMax: DEFAULT_SCENT_PARAMS.tauDecayMax
  };
}
