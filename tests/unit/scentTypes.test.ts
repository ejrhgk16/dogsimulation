import { describe, it, expect } from 'vitest';
import type {
  ScentPoint,
  OwnerScentProfile,
  ScentParams,
  EmitAccumulator,
  ScentVisualConfig
} from '../../src/types/scent';

describe('ScentPoint', () => {
  it('accepts optional tauDecay field', () => {
    const point: ScentPoint = {
      ownerId: 'test',
      ownerType: 'dog',
      x: 0,
      y: 0,
      height: 0,
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
      height: 0,
      t: 100,
      baseIntensity: 1.0,
      tauDecay: 5000
    };
    expect(point.tauDecay).toBe(5000);
  });

  it('accepts height field', () => {
    const point: ScentPoint = {
      ownerId: 'test',
      ownerType: 'dog',
      x: 0,
      y: 0,
      height: 1.5,
      t: 100,
      baseIntensity: 1.0
    };
    expect(point.height).toBe(1.5);
  });
});

describe('EmitAccumulator', () => {
  it('has timeSinceLastEmit and lastHeight fields', () => {
    const acc: EmitAccumulator = {
      timeSinceLastEmit: 0,
      distanceSinceLast: 0,
      ownerId: 'test',
      ownerType: 'dog',
      lastX: 0,
      lastY: 0,
      lastHeight: 0
    };
    expect(acc.timeSinceLastEmit).toBe(0);
    expect(acc.distanceSinceLast).toBe(0);
    expect(acc.lastHeight).toBe(0);
  });

  it('accepts non-zero values', () => {
    const acc: EmitAccumulator = {
      timeSinceLastEmit: 500,
      distanceSinceLast: 0,
      ownerId: 'test',
      ownerType: 'dog',
      lastX: 10,
      lastY: 20,
      lastHeight: 1.5
    };
    expect(acc.timeSinceLastEmit).toBe(500);
    expect(acc.distanceSinceLast).toBe(0);
    expect(acc.lastHeight).toBe(1.5);
  });

  it('accepts non-zero distanceSinceLast', () => {
    const acc: EmitAccumulator = {
      timeSinceLastEmit: 0,
      distanceSinceLast: 2.5,
      ownerId: 'test',
      ownerType: 'dog',
      lastX: 10,
      lastY: 20,
      lastHeight: 1.5
    };
    expect(acc.distanceSinceLast).toBe(2.5);
  });
});

describe('OwnerScentProfile', () => {
  it('has emitInterval and spreadRadius as required fields', () => {
    const profile: OwnerScentProfile = {
      ownerType: 'dog',
      baseIntensity: 1.0,
      emitInterval: 200,
      emitProbability: 0.8,
      spreadRadius: 1.5,
      maxTrailAge: 25000,
      tauDecay: 8000,
      scentSpreadSigma: 2.0,
      tauDecayMin: 6000,
      tauDecayMax: 10000,
      emitSpacing: 1.0
    };
    expect(profile.emitInterval).toBe(200);
    expect(profile.spreadRadius).toBe(1.5);
  });

  it('has tauDecayMin and tauDecayMax as required fields', () => {
    const profile: OwnerScentProfile = {
      ownerType: 'dog',
      baseIntensity: 1.0,
      emitInterval: 200,
      emitProbability: 0.8,
      spreadRadius: 1.5,
      maxTrailAge: 25000,
      tauDecay: 8000,
      scentSpreadSigma: 2.0,
      tauDecayMin: 6000,
      tauDecayMax: 10000,
      emitSpacing: 1.0
    };
    expect(profile.tauDecayMin).toBe(6000);
    expect(profile.tauDecayMax).toBe(10000);
  });

  it('has emitSpacing as required field', () => {
    const profile: OwnerScentProfile = {
      ownerType: 'dog',
      baseIntensity: 1.0,
      emitInterval: 200,
      emitProbability: 0.8,
      spreadRadius: 1.5,
      maxTrailAge: 25000,
      tauDecay: 8000,
      scentSpreadSigma: 2.0,
      tauDecayMin: 6000,
      tauDecayMax: 10000,
      emitSpacing: 0.5
    };
    expect(profile.emitSpacing).toBe(0.5);
  });
});

describe('ScentParams', () => {
  it('has tauDecay as required field', () => {
    const params: ScentParams = {
      maxTrailAge: 25000,
      tauDecay: 8000,
      scentSpreadSigma: 2.0,
      tauDecayMin: 6000,
      tauDecayMax: 10000,
      emitSpacing: 1.0
    };
    expect(params.tauDecay).toBe(8000);
  });

  it('has tauDecayMin and tauDecayMax as required fields', () => {
    const params: ScentParams = {
      maxTrailAge: 25000,
      tauDecay: 8000,
      scentSpreadSigma: 2.0,
      tauDecayMin: 6000,
      tauDecayMax: 10000,
      emitSpacing: 1.0
    };
    expect(params.tauDecayMin).toBe(6000);
    expect(params.tauDecayMax).toBe(10000);
  });

  it('has emitSpacing as required field', () => {
    const params: ScentParams = {
      maxTrailAge: 25000,
      tauDecay: 8000,
      scentSpreadSigma: 2.0,
      tauDecayMin: 6000,
      tauDecayMax: 10000,
      emitSpacing: 1.5
    };
    expect(params.emitSpacing).toBe(1.5);
  });
});

describe('ScentVisualConfig', () => {
  it('does not have maxHeight field', () => {
    const config: ScentVisualConfig = {
      pointSize: 0.18,
      minHeight: 0.05,
      ownerColorMap: { dog: 0xff9933 }
    };
    expect((config as unknown as Record<string, unknown>).maxHeight).toBeUndefined();
  });

  it('has pointSize, minHeight, ownerColorMap', () => {
    const config: ScentVisualConfig = {
      pointSize: 0.18,
      minHeight: 0.05,
      ownerColorMap: { dog: 0xff9933, cow: 0x44aa44 }
    };
    expect(config.pointSize).toBe(0.18);
    expect(config.minHeight).toBe(0.05);
    expect(config.ownerColorMap.dog).toBe(0xff9933);
  });
});
