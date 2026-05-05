import type { OwnerScentProfile, ScentParams, ScentVisualConfig } from '../types/scent';

export const DEFAULT_SCENT_PARAMS: ScentParams = {
  maxTrailAge: 10000,
  tauDecay: 3000,
  scentSpreadSigma: 2.0
};

export const OWNER_PROFILES: Record<string, OwnerScentProfile> = {
  dog: {
    ...DEFAULT_SCENT_PARAMS,
    ownerType: 'dog',
    baseIntensity: 1.0,
    emitSpacing: 0.5,
    emitProbability: 0.8
  },
  cow: {
    ...DEFAULT_SCENT_PARAMS,
    ownerType: 'cow',
    baseIntensity: 1.5,
    emitSpacing: 1.0,
    emitProbability: 0.6
  },
  pig: {
    ...DEFAULT_SCENT_PARAMS,
    ownerType: 'pig',
    baseIntensity: 0.8,
    emitSpacing: 0.3,
    emitProbability: 0.9
  }
};

export const DEFAULT_SCENT_VISUAL_CONFIG: ScentVisualConfig = {
  pointSize: 0.15,
  minHeight: 0.1,
  maxHeight: 0.6,
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
    emitSpacing: 1.0,
    emitProbability: 0.5
  };
}
