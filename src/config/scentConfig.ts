import { ANIMAL_SCALE } from './animalConfig';
import type { AnimalScentProfile, ScentParams, ScentVisualConfig } from '../types/scent';

/** scent grid cell 크기 (map cellSize와 독립적). 기본 2 (더 세밀한 그리드). */
export const DEFAULT_SCENT_CELL_SIZE = 2;

export const DEFAULT_SCENT_PARAMS: ScentParams = {
  tauDecay: 8000,
  scentSpreadSigma: 2.0,
  emitSpacing: 1.0
};

export const ANIMAL_PROFILES: Record<string, AnimalScentProfile> = {
  dog: {
    ...DEFAULT_SCENT_PARAMS,
    animalType: 'dog',
    emitInterval: 200,
    emitProbability: 0.8,
    spreadRadius: 0.75,
    emitSpacing: 0.5
  },
  cow: {
    ...DEFAULT_SCENT_PARAMS,
    animalType: 'cow',
    emitInterval: 300,
    emitProbability: 0.6,
    spreadRadius: 2.0,
    emitSpacing: 1.0
  },
  pig: {
    ...DEFAULT_SCENT_PARAMS,
    animalType: 'pig',
    emitInterval: 150,
    emitProbability: 0.9,
    spreadRadius: 1.2,
    emitSpacing: 0.3
  }
};

export const DEFAULT_SCENT_VISUAL_CONFIG: ScentVisualConfig = {
  pointSize: 0.2,
  minHeight: ANIMAL_SCALE * 0.05,
  animalColorMap: {
    dog: 0xffffff,
    cow: 0xffffff,
    pig: 0xffffff
  }
};

let _tauDecayMultiplier = 10;

export function getTauDecayMultiplier(): number {
  return _tauDecayMultiplier;
}

export function setTauDecayMultiplier(multiplier: number): void {
  if (multiplier > 0) {
    _tauDecayMultiplier = multiplier;
  }
}

let _emitRateMultiplier = 1.7;

export function getEmitRateMultiplier(): number {
  return _emitRateMultiplier;
}

export function setEmitRateMultiplier(multiplier: number): void {
  if (multiplier > 0) {
    _emitRateMultiplier = multiplier;
  }
}

let _scentPointSizeMultiplier = 3;

export function getScentPointSizeMultiplier(): number {
  return _scentPointSizeMultiplier;
}

export function setScentPointSizeMultiplier(multiplier: number): void {
  if (multiplier > 0) {
    _scentPointSizeMultiplier = multiplier;
  }
}

export function getAnimalProfile(animalType: string): AnimalScentProfile {
  const existing = ANIMAL_PROFILES[animalType];
  if (existing) {
    return existing;
  }
  return {
    ...DEFAULT_SCENT_PARAMS,
    animalType,
    emitInterval: 250,
    emitProbability: 0.5,
    spreadRadius: 0.75,
    emitSpacing: 0.5
  };
}
