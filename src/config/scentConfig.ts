import { ANIMAL_SCALE } from './animalConfig';
import type { AnimalScentProfile, ScentParams, ScentVisualConfig } from '../types/scent';

export const DEFAULT_SCENT_PARAMS: ScentParams = {
  maxTrailAge: 25000,
  tauDecay: 8000,
  scentSpreadSigma: 2.0,
  tauDecayMin: 6000,
  tauDecayMax: 10000,
  emitSpacing: 1.0
};

export const ANIMAL_PROFILES: Record<string, AnimalScentProfile> = {
  dog: {
    ...DEFAULT_SCENT_PARAMS,
    animalType: 'dog',
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
    animalType: 'cow',
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
    animalType: 'pig',
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
  pointSize: ANIMAL_SCALE * 0.2,
  minHeight: ANIMAL_SCALE * 0.05,
  animalColorMap: {
    dog: 0xff9933,
    cow: 0x44aa44,
    pig: 0xff6688
  }
};

export function getAnimalProfile(animalType: string): AnimalScentProfile {
  const existing = ANIMAL_PROFILES[animalType];
  if (existing) {
    return existing;
  }
  return {
    ...DEFAULT_SCENT_PARAMS,
    animalType,
    baseIntensity: 1.0,
    emitInterval: 250,
    emitProbability: 0.5,
    spreadRadius: 0.75,
    emitSpacing: DEFAULT_SCENT_PARAMS.emitSpacing,
    tauDecayMin: DEFAULT_SCENT_PARAMS.tauDecayMin,
    tauDecayMax: DEFAULT_SCENT_PARAMS.tauDecayMax
  };
}
