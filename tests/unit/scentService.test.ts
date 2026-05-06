import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ScentWorldState, ScentPoint } from '../../src/types/scent';
import { DEFAULT_SCENT_PARAMS } from '../../src/config/scentConfig';
import { emitTrailPoint, sampleScentAt, trimExpiredTrails } from '../../src/services/scentService';

function createEmptyState(): ScentWorldState {
  return { trailPoints: [], emitters: new Map() };
}

function makeScentPoint(overrides: Partial<ScentPoint> = {}): ScentPoint {
  return {
    ownerId: 'test-owner',
    ownerType: 'dog',
    x: 0,
    y: 0,
    t: 0,
    baseIntensity: 1.0,
    tauDecay: 8000,
    ...overrides
  };
}

describe('emitTrailPoint', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates accumulator and does not emit on first call (no prior position)', () => {
    const state = createEmptyState();
    emitTrailPoint(state, 'owner-1', 'dog', 10, 20, 0, 0, 100, {
      ownerType: 'dog',
      baseIntensity: 1.0,
      emitSpacing: 0.5,
      emitProbability: 1.0,
      lateralSpreadSigma: 0.3,
      ...DEFAULT_SCENT_PARAMS
    });
    expect(state.trailPoints).toHaveLength(0);
    expect(state.emitters.has('owner-1')).toBe(true);
    const acc = state.emitters.get('owner-1')!;
    expect(acc.lastX).toBe(10);
    expect(acc.lastY).toBe(20);
    expect(acc.distanceSinceLast).toBe(0);
  });

  it('does not emit when accumulated distance < emitSpacing', () => {
    const state = createEmptyState();
    const profile = {
      ownerType: 'dog',
      baseIntensity: 1.0,
      emitSpacing: 5.0,
      emitProbability: 1.0,
      lateralSpreadSigma: 0.3,
      ...DEFAULT_SCENT_PARAMS
    };
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'o1', 'dog', 1, 0, 0, 0, 101, profile);
    expect(state.trailPoints).toHaveLength(0);
    expect(state.emitters.get('o1')!.distanceSinceLast).toBeCloseTo(1);
  });

  it('emits when accumulated distance >= emitSpacing', () => {
    const state = createEmptyState();
    const profile = {
      ownerType: 'dog',
      baseIntensity: 2.0,
      emitSpacing: 3.0,
      emitProbability: 1.0,
      lateralSpreadSigma: 0.3,
      ...DEFAULT_SCENT_PARAMS
    };
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'o1', 'dog', 4, 0, 0, 0, 101, profile);
    expect(state.trailPoints).toHaveLength(1);
    expect(state.trailPoints[0].x).toBe(4);
    expect(state.trailPoints[0].y).toBe(0);
    expect(state.trailPoints[0].t).toBe(101);
    expect(state.trailPoints[0].baseIntensity).toBe(2.0);
    expect(state.trailPoints[0].ownerId).toBe('o1');
    expect(state.trailPoints[0].ownerType).toBe('dog');
  });

  it('resets distanceSinceLast to 0 after emitting', () => {
    const state = createEmptyState();
    const profile = {
      ownerType: 'dog',
      baseIntensity: 1.0,
      emitSpacing: 3.0,
      emitProbability: 1.0,
      lateralSpreadSigma: 0.3,
      ...DEFAULT_SCENT_PARAMS
    };
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'o1', 'dog', 4, 0, 0, 0, 101, profile);
    expect(state.emitters.get('o1')!.distanceSinceLast).toBe(0);
  });

  it('updates lastX/lastY after emitting', () => {
    const state = createEmptyState();
    const profile = {
      ownerType: 'dog',
      baseIntensity: 1.0,
      emitSpacing: 3.0,
      emitProbability: 1.0,
      lateralSpreadSigma: 0.3,
      ...DEFAULT_SCENT_PARAMS
    };
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'o1', 'dog', 4, 0, 0, 0, 101, profile);
    const acc = state.emitters.get('o1')!;
    expect(acc.lastX).toBe(4);
    expect(acc.lastY).toBe(0);
  });

  it('skips emission when Math.random() > emitProbability', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const state = createEmptyState();
    const profile = {
      ownerType: 'dog',
      baseIntensity: 1.0,
      emitSpacing: 1.0,
      emitProbability: 0.3,
      lateralSpreadSigma: 1.0,
      ...DEFAULT_SCENT_PARAMS
    };
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'o1', 'dog', 5, 0, 0, 0, 101, profile);
    expect(state.trailPoints).toHaveLength(0);
    expect(state.emitters.get('o1')!.distanceSinceLast).toBe(0);
  });

  it('emits when Math.random() <= emitProbability', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2);
    const state = createEmptyState();
    const profile = {
      ownerType: 'dog',
      baseIntensity: 1.0,
      emitSpacing: 1.0,
      emitProbability: 0.5,
      lateralSpreadSigma: 1.0,
      ...DEFAULT_SCENT_PARAMS
    };
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'o1', 'dog', 5, 0, 0, 0, 101, profile);
    expect(state.trailPoints).toHaveLength(1);
  });

  it('accumulates distance over multiple frames before emitting', () => {
    const state = createEmptyState();
    const profile = {
      ownerType: 'dog',
      baseIntensity: 1.0,
      emitSpacing: 5.0,
      emitProbability: 1.0,
      lateralSpreadSigma: 0.3,
      ...DEFAULT_SCENT_PARAMS
    };
    // Acc created at (0,0). distanceSinceLast=0
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 0, 100, profile);
    // dist from (0,0)->(2,0)=2, acc=2 < 5, lastX/lastY still (0,0)
    emitTrailPoint(state, 'o1', 'dog', 2, 0, 0, 0, 101, profile);
    expect(state.trailPoints).toHaveLength(0);
    // dist from (0,0)->(4,0)=4, acc=2+4=6 >= 5 → emit at x=4
    emitTrailPoint(state, 'o1', 'dog', 4, 0, 0, 0, 102, profile);
    expect(state.trailPoints).toHaveLength(1);
    // After emit: lastX=4, lastY=0, acc=0
    // dist from (4,0)->(7,0)=3, acc=3 < 5
    emitTrailPoint(state, 'o1', 'dog', 7, 0, 0, 0, 103, profile);
    expect(state.trailPoints).toHaveLength(1);
  });

  it('assigns tauDecay within profile range', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const state = createEmptyState();
    const profile = {
      ownerType: 'dog',
      baseIntensity: 1.0,
      emitSpacing: 1.0,
      emitProbability: 1.0,
      lateralSpreadSigma: 0.3,
      ...DEFAULT_SCENT_PARAMS
    };
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'o1', 'dog', 5, 0, 0, 0, 101, profile);
    // Math.random()=0.5 => 6000 + 0.5*(10000-6000) = 8000
    expect(state.trailPoints[0].tauDecay).toBeCloseTo(8000, 5);
  });

  it('handles multiple emitters independently', () => {
    const state = createEmptyState();
    const profile = {
      ownerType: 'dog',
      baseIntensity: 1.0,
      emitSpacing: 2.0,
      emitProbability: 1.0,
      lateralSpreadSigma: 0.3,
      ...DEFAULT_SCENT_PARAMS
    };
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'o2', 'cow', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'o1', 'dog', 3, 0, 0, 0, 101, profile);
    emitTrailPoint(state, 'o2', 'cow', 3, 0, 0, 0, 101, profile);
    expect(state.trailPoints).toHaveLength(2);
    expect(state.trailPoints[0].ownerId).toBe('o1');
    expect(state.trailPoints[1].ownerId).toBe('o2');
  });
});

describe('sampleScentAt', () => {
  it('returns 0 for empty trail', () => {
    const state = createEmptyState();
    const signal = sampleScentAt(state, { x: 0, y: 0 }, 100, DEFAULT_SCENT_PARAMS);
    expect(signal).toBe(0);
  });

  it('returns baseIntensity for fresh point at same position', () => {
    const state = createEmptyState();
    state.trailPoints.push(makeScentPoint({ x: 5, y: 10, t: 100, baseIntensity: 2.0 }));
    const signal = sampleScentAt(state, { x: 5, y: 10 }, 100, DEFAULT_SCENT_PARAMS);
    expect(signal).toBeCloseTo(2.0);
  });

  it('applies time decay correctly', () => {
    const state = createEmptyState();
    state.trailPoints.push(
      makeScentPoint({ x: 0, y: 0, t: 0, baseIntensity: 1.0, tauDecay: 3000 })
    );
    const signal = sampleScentAt(state, { x: 0, y: 0 }, 3000, {
      maxTrailAge: 10000,
      tauDecay: 3000,
      scentSpreadSigma: 2.0
    });
    expect(signal).toBeCloseTo(Math.exp(-1), 3);
  });

  it('uses per-point tauDecay over global params', () => {
    const state = createEmptyState();
    // point.tauDecay=5000, params.tauDecay=10000
    state.trailPoints.push(
      makeScentPoint({ x: 0, y: 0, t: 0, baseIntensity: 1.0, tauDecay: 5000 })
    );
    const signal = sampleScentAt(state, { x: 0, y: 0 }, 5000, {
      maxTrailAge: 25000,
      tauDecay: 10000,
      scentSpreadSigma: 2.0
    });
    // With tauDecay=5000: exp(-5000/5000) = exp(-1)
    expect(signal).toBeCloseTo(Math.exp(-1), 3);
  });

  it('applies spatial decay correctly', () => {
    const state = createEmptyState();
    state.trailPoints.push(makeScentPoint({ x: 0, y: 0, t: 100, baseIntensity: 1.0 }));
    const signal = sampleScentAt(state, { x: 2, y: 0 }, 100, {
      maxTrailAge: 10000,
      tauDecay: 3000,
      scentSpreadSigma: 2.0
    });
    expect(signal).toBeCloseTo(Math.exp(-0.5), 3);
  });

  it('skips points with age > maxTrailAge', () => {
    const state = createEmptyState();
    state.trailPoints.push(makeScentPoint({ x: 0, y: 0, t: 0, baseIntensity: 1.0 }));
    const signal = sampleScentAt(state, { x: 0, y: 0 }, 30000, DEFAULT_SCENT_PARAMS);
    expect(signal).toBe(0);
  });

  it('skips points with age < 0 (future timestamp)', () => {
    const state = createEmptyState();
    state.trailPoints.push(makeScentPoint({ x: 0, y: 0, t: 9999, baseIntensity: 1.0 }));
    const signal = sampleScentAt(state, { x: 0, y: 0 }, 0, DEFAULT_SCENT_PARAMS);
    expect(signal).toBe(0);
  });

  it('filters by ownerType when specified', () => {
    const state = createEmptyState();
    state.trailPoints.push(
      makeScentPoint({
        ownerId: 'd1',
        ownerType: 'dog',
        x: 0,
        y: 0,
        t: 100,
        baseIntensity: 1.0
      })
    );
    state.trailPoints.push(
      makeScentPoint({
        ownerId: 'c1',
        ownerType: 'cow',
        x: 0,
        y: 0,
        t: 100,
        baseIntensity: 2.0
      })
    );
    const signal = sampleScentAt(state, { x: 0, y: 0 }, 100, DEFAULT_SCENT_PARAMS, 'dog');
    expect(signal).toBeCloseTo(1.0);
  });

  it('sums multiple points correctly', () => {
    const state = createEmptyState();
    state.trailPoints.push(makeScentPoint({ x: 0, y: 0, t: 100, baseIntensity: 1.0 }));
    state.trailPoints.push(makeScentPoint({ x: 0, y: 0, t: 100, baseIntensity: 2.0 }));
    const signal = sampleScentAt(state, { x: 0, y: 0 }, 100, DEFAULT_SCENT_PARAMS);
    expect(signal).toBeCloseTo(3.0);
  });

  it('returns 0 when ownerType filter matches nothing', () => {
    const state = createEmptyState();
    state.trailPoints.push(
      makeScentPoint({ ownerType: 'dog', x: 0, y: 0, t: 100, baseIntensity: 1.0 })
    );
    const signal = sampleScentAt(state, { x: 0, y: 0 }, 100, DEFAULT_SCENT_PARAMS, 'cow');
    expect(signal).toBe(0);
  });

  it('combines time and spatial decay correctly', () => {
    const state = createEmptyState();
    state.trailPoints.push(
      makeScentPoint({ x: 3, y: 4, t: 0, baseIntensity: 2.0, tauDecay: 3000 })
    );
    const expected = 2.0 * Math.exp(-3000 / 3000) * Math.exp(-25 / (2 * 2 * 2));
    const signal = sampleScentAt(state, { x: 0, y: 0 }, 3000, {
      maxTrailAge: 10000,
      tauDecay: 3000,
      scentSpreadSigma: 2.0
    });
    expect(signal).toBeCloseTo(expected, 5);
  });

  it('does not filter by ownerType when ownerType is undefined', () => {
    const state = createEmptyState();
    state.trailPoints.push(
      makeScentPoint({ ownerType: 'dog', x: 0, y: 0, t: 100, baseIntensity: 1.0 })
    );
    state.trailPoints.push(
      makeScentPoint({ ownerType: 'cow', x: 0, y: 0, t: 100, baseIntensity: 2.0 })
    );
    const signal = sampleScentAt(state, { x: 0, y: 0 }, 100, DEFAULT_SCENT_PARAMS);
    expect(signal).toBeCloseTo(3.0);
  });
});

describe('trimExpiredTrails', () => {
  it('removes points older than maxTrailAge', () => {
    const state = createEmptyState();
    state.trailPoints.push(makeScentPoint({ t: 0, baseIntensity: 1.0 }));
    state.trailPoints.push(makeScentPoint({ t: 2000, baseIntensity: 1.0 }));
    state.trailPoints.push(makeScentPoint({ t: 4000, baseIntensity: 1.0 }));
    trimExpiredTrails(state, 5000, {
      maxTrailAge: 3000,
      tauDecay: 3000,
      scentSpreadSigma: 2.0
    });
    expect(state.trailPoints).toHaveLength(2);
    expect(state.trailPoints[0].t).toBe(2000);
    expect(state.trailPoints[1].t).toBe(4000);
  });

  it('keeps all points when none are expired', () => {
    const state = createEmptyState();
    state.trailPoints.push(makeScentPoint({ t: 8000, baseIntensity: 1.0 }));
    state.trailPoints.push(makeScentPoint({ t: 9000, baseIntensity: 1.0 }));
    trimExpiredTrails(state, 10000, {
      maxTrailAge: 3000,
      tauDecay: 3000,
      scentSpreadSigma: 2.0
    });
    expect(state.trailPoints).toHaveLength(2);
  });

  it('removes all points when all are expired', () => {
    const state = createEmptyState();
    state.trailPoints.push(makeScentPoint({ t: 0, baseIntensity: 1.0 }));
    state.trailPoints.push(makeScentPoint({ t: 1000, baseIntensity: 1.0 }));
    trimExpiredTrails(state, 10000, {
      maxTrailAge: 3000,
      tauDecay: 3000,
      scentSpreadSigma: 2.0
    });
    expect(state.trailPoints).toHaveLength(0);
  });

  it('handles empty trailPoints gracefully', () => {
    const state = createEmptyState();
    trimExpiredTrails(state, 5000, DEFAULT_SCENT_PARAMS);
    expect(state.trailPoints).toHaveLength(0);
  });

  it('keeps point with age exactly equal to maxTrailAge (boundary)', () => {
    const state = createEmptyState();
    state.trailPoints.push(makeScentPoint({ t: 7000, baseIntensity: 1.0 }));
    trimExpiredTrails(state, 10000, {
      maxTrailAge: 3000,
      tauDecay: 3000,
      scentSpreadSigma: 2.0
    });
    expect(state.trailPoints).toHaveLength(1);
  });
});
