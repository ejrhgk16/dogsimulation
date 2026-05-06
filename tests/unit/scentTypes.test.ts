import { describe, it, expect } from 'vitest';
import type { ScentPoint, OwnerScentProfile, ScentParams } from '../../src/types/scent';

describe('ScentPoint', () => {
  it('accepts optional tauDecay field', () => {
    const point: ScentPoint = {
      ownerId: 'test',
      ownerType: 'dog',
      x: 0,
      y: 0,
      t: 100,
      baseIntensity: 1.0
    };
    expect(point.tauDecay).toBeUndefined();
  });

  it('accepts tauDecay when provided', () => {
    const point: ScentPoint = {
      ownerId: 'test',
      ownerType: 'dog',
      x: 0,
      y: 0,
      t: 100,
      baseIntensity: 1.0,
      tauDecay: 5000
    };
    expect(point.tauDecay).toBe(5000);
  });
});

describe('OwnerScentProfile', () => {
  it('accepts optional tauDecayMin and tauDecayMax', () => {
    const profile: OwnerScentProfile = {
      ownerType: 'dog',
      baseIntensity: 1.0,
      emitSpacing: 0.5,
      emitProbability: 0.8,
      lateralSpreadSigma: 0.3,
      maxTrailAge: 25000,
      tauDecay: 8000,
      scentSpreadSigma: 2.0
    };
    expect(profile.tauDecayMin).toBeUndefined();
    expect(profile.tauDecayMax).toBeUndefined();
  });

  it('accepts tauDecayMin and tauDecayMax when provided', () => {
    const profile: OwnerScentProfile = {
      ownerType: 'dog',
      baseIntensity: 1.0,
      emitSpacing: 0.5,
      emitProbability: 0.8,
      lateralSpreadSigma: 0.3,
      maxTrailAge: 25000,
      tauDecay: 8000,
      scentSpreadSigma: 2.0,
      tauDecayMin: 5000,
      tauDecayMax: 12000
    };
    expect(profile.tauDecayMin).toBe(5000);
    expect(profile.tauDecayMax).toBe(12000);
  });
});

describe('ScentParams', () => {
  it('still has tauDecay as required field', () => {
    const params: ScentParams = {
      maxTrailAge: 25000,
      tauDecay: 8000,
      scentSpreadSigma: 2.0
    };
    expect(params.tauDecay).toBe(8000);
  });

  it('accepts optional tauDecayMin and tauDecayMax', () => {
    const params: ScentParams = {
      maxTrailAge: 25000,
      tauDecay: 8000,
      scentSpreadSigma: 2.0,
      tauDecayMin: 6000,
      tauDecayMax: 10000
    };
    expect(params.tauDecayMin).toBe(6000);
    expect(params.tauDecayMax).toBe(10000);
  });
});
