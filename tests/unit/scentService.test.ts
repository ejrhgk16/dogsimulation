import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ScentWorldState, ScentPoint } from '../../src/types/scent';
import { DEFAULT_SCENT_PARAMS, getOwnerProfile } from '../../src/config/scentConfig';
import {
  emitTrailPoint,
  emitTrailPointOnMove,
  sampleScentAt,
  trimExpiredTrails
} from '../../src/services/scentService';

function createEmptyState(): ScentWorldState {
  return { trailPoints: [], emitters: new Map() };
}

function makeScentPoint(overrides: Partial<ScentPoint> = {}): ScentPoint {
  return {
    ownerId: 'test-owner',
    ownerType: 'dog',
    x: 0,
    y: 0,
    height: 0,
    t: 0,
    baseIntensity: 1.0,
    tauDecay: 8000,
    ...overrides
  };
}

function makeDogProfile() {
  return getOwnerProfile('dog');
}

describe('emitTrailPoint', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates accumulator and does not emit on first call (dt < emitInterval)', () => {
    const state = createEmptyState();
    emitTrailPoint(state, 'owner-1', 'dog', 10, 20, 1.5, 50, 100, makeDogProfile());
    expect(state.trailPoints).toHaveLength(0);
    expect(state.emitters.has('owner-1')).toBe(true);
    const acc = state.emitters.get('owner-1')!;
    expect(acc.lastX).toBe(10);
    expect(acc.lastY).toBe(20);
    expect(acc.lastHeight).toBe(1.5);
    expect(acc.timeSinceLastEmit).toBe(50);
  });

  it('does not emit when accumulated dt < emitInterval', () => {
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitInterval = 200
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 100, 100, profile);
    emitTrailPoint(state, 'o1', 'dog', 1, 0, 0, 50, 200, profile);
    expect(state.trailPoints).toHaveLength(0);
    expect(state.emitters.get('o1')!.timeSinceLastEmit).toBe(150);
  });

  it('emits when accumulated dt >= emitInterval', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitInterval = 200
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 250, 350, profile);
    expect(state.trailPoints).toHaveLength(1);
    expect(state.trailPoints[0].t).toBe(350);
    expect(state.trailPoints[0].baseIntensity).toBe(1.0);
    expect(state.trailPoints[0].ownerId).toBe('o1');
    expect(state.trailPoints[0].ownerType).toBe('dog');
  });

  it('resets timeSinceLastEmit to 0 after emitting', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile();
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 250, 350, profile);
    expect(state.emitters.get('o1')!.timeSinceLastEmit).toBe(0);
  });

  it('updates lastX/lastY/lastHeight after emitting', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile();
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'o1', 'dog', 4, 5, 1.2, 250, 350, profile);
    const acc = state.emitters.get('o1')!;
    expect(acc.lastX).toBe(4);
    expect(acc.lastY).toBe(5);
    expect(acc.lastHeight).toBe(1.2);
  });

  it('emits at stationary position when dt accumulates without movement', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile();
    // Owner stays at (10, 20), dt accumulates over frames
    emitTrailPoint(state, 'o1', 'dog', 10, 20, 1.0, 100, 100, profile);
    emitTrailPoint(state, 'o1', 'dog', 10, 20, 1.0, 150, 250, profile);
    expect(state.trailPoints).toHaveLength(1);
    // Point is spread by gaussian around owner position
    const dx = state.trailPoints[0].x - 10;
    const dy = state.trailPoints[0].y - 20;
    const dist = Math.sqrt(dx * dx + dy * dy);
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThan(profile.spreadRadius * 4);
  });

  it('skips emission when Math.random() > emitProbability', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitProbability = 0.8
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 250, 350, profile);
    expect(state.trailPoints).toHaveLength(0);
    expect(state.emitters.get('o1')!.timeSinceLastEmit).toBe(0);
  });

  it('emits when Math.random() <= emitProbability', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2);
    const state = createEmptyState();
    const profile = makeDogProfile();
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 250, 350, profile);
    expect(state.trailPoints).toHaveLength(1);
  });

  it('accumulates dt over multiple frames before emitting', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitInterval = 200
    // dt=50 → acc=50 < 200
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 50, 100, profile);
    expect(state.trailPoints).toHaveLength(0);
    // dt=100 → acc=150 < 200
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 100, 200, profile);
    expect(state.trailPoints).toHaveLength(0);
    // dt=100 → acc=250 >= 200 → emit
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 100, 300, profile);
    expect(state.trailPoints).toHaveLength(1);
    // After emit: acc=0 → dt=50 → acc=50 < 200
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 50, 350, profile);
    expect(state.trailPoints).toHaveLength(1);
  });

  it('stores ownerHeight in ScentPoint.height', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile();
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 2.5, 0, 100, profile);
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 2.5, 250, 350, profile);
    expect(state.trailPoints[0].height).toBe(2.5);
  });

  it('spreads points in circular pattern around owner', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile(); // spreadRadius = 0.75
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 250, 350, profile);
    const pt = state.trailPoints[0];
    const dist = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
    // Point should not be at exact center; spread applied
    expect(dist).toBeGreaterThan(0);
    // Point should be within reasonable gaussian spread radius
    expect(dist).toBeLessThan(profile.spreadRadius * 4);
  });

  it('assigns tauDecay within profile range', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const state = createEmptyState();
    const profile = makeDogProfile(); // tauDecayMin=6000, tauDecayMax=10000
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 250, 350, profile);
    // Math.random()=0.5 => 6000 + 0.5*(10000-6000) = 8000
    expect(state.trailPoints[0].tauDecay).toBeCloseTo(8000, 5);
  });

  it('handles multiple emitters independently', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile();
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'o2', 'cow', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 250, 350, profile);
    emitTrailPoint(state, 'o2', 'cow', 0, 0, 0, 250, 350, profile);
    expect(state.trailPoints).toHaveLength(2);
    expect(state.trailPoints[0].ownerId).toBe('o1');
    expect(state.trailPoints[1].ownerId).toBe('o2');
  });
});

describe('emitTrailPointOnMove', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates accumulator with distanceSinceLast=0 on first call', () => {
    const state = createEmptyState();
    emitTrailPointOnMove(state, 'owner-1', 'dog', 10, 20, 1.5, 100, makeDogProfile());
    expect(state.trailPoints).toHaveLength(0);
    expect(state.emitters.has('owner-1')).toBe(true);
    const acc = state.emitters.get('owner-1')!;
    expect(acc.distanceSinceLast).toBe(0);
    expect(acc.lastX).toBe(10);
    expect(acc.lastY).toBe(20);
    expect(acc.lastHeight).toBe(1.5);
    // timeSinceLastEmit should not be touched
    expect(acc.timeSinceLastEmit).toBe(0);
  });

  it('does not emit when moving distance < emitSpacing', () => {
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitSpacing = 0.5
    emitTrailPointOnMove(state, 'o1', 'dog', 0, 0, 0, 100, profile);
    // Move 0.3 units, below threshold
    emitTrailPointOnMove(state, 'o1', 'dog', 0.3, 0, 0, 200, profile);
    expect(state.trailPoints).toHaveLength(0);
    expect(state.emitters.get('o1')!.distanceSinceLast).toBeCloseTo(0.3, 5);
  });

  it('accumulates distance over multiple moves before emitting', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitSpacing = 0.5
    emitTrailPointOnMove(state, 'o1', 'dog', 0, 0, 0, 100, profile);
    // Move 0.2 → acc=0.2 < 0.5
    emitTrailPointOnMove(state, 'o1', 'dog', 0.2, 0, 0, 200, profile);
    expect(state.trailPoints).toHaveLength(0);
    // Move 0.2 → acc=0.4 < 0.5
    emitTrailPointOnMove(state, 'o1', 'dog', 0.4, 0, 0, 300, profile);
    expect(state.trailPoints).toHaveLength(0);
    // Move 0.2 → acc=0.6 >= 0.5 → emit
    emitTrailPointOnMove(state, 'o1', 'dog', 0.6, 0, 0, 400, profile);
    expect(state.trailPoints).toHaveLength(1);
    // After emit: acc=0 → next 0.2 < 0.5
    emitTrailPointOnMove(state, 'o1', 'dog', 0.8, 0, 0, 500, profile);
    expect(state.trailPoints).toHaveLength(1);
  });

  it('resets distanceSinceLast to 0 after emitting', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitSpacing = 0.5
    emitTrailPointOnMove(state, 'o1', 'dog', 0, 0, 0, 100, profile);
    emitTrailPointOnMove(state, 'o1', 'dog', 0.6, 0, 0, 200, profile);
    expect(state.emitters.get('o1')!.distanceSinceLast).toBe(0);
  });

  it('updates lastX/lastY/lastHeight after emitting', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile();
    emitTrailPointOnMove(state, 'o1', 'dog', 0, 0, 0, 100, profile);
    emitTrailPointOnMove(state, 'o1', 'dog', 4, 5, 1.2, 200, profile);
    const acc = state.emitters.get('o1')!;
    expect(acc.lastX).toBe(4);
    expect(acc.lastY).toBe(5);
    expect(acc.lastHeight).toBe(1.2);
  });

  it('updates lastX/lastY/lastHeight even when not emitting', () => {
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitSpacing = 0.5
    emitTrailPointOnMove(state, 'o1', 'dog', 0, 0, 0, 100, profile);
    // Move 0.2 → dist=0.2 < 0.5, no emit
    emitTrailPointOnMove(state, 'o1', 'dog', 0.2, 0, 2.0, 200, profile);
    const acc = state.emitters.get('o1')!;
    expect(acc.lastX).toBe(0.2);
    expect(acc.lastY).toBe(0);
    expect(acc.lastHeight).toBe(2.0);
    expect(state.trailPoints).toHaveLength(0);
  });

  it('skips emission when Math.random() > emitProbability', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitProbability = 0.8
    emitTrailPointOnMove(state, 'o1', 'dog', 0, 0, 0, 100, profile);
    emitTrailPointOnMove(state, 'o1', 'dog', 0.6, 0, 0, 200, profile);
    expect(state.trailPoints).toHaveLength(0);
    expect(state.emitters.get('o1')!.distanceSinceLast).toBe(0);
  });

  it('stores ownerHeight in ScentPoint.height', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile();
    emitTrailPointOnMove(state, 'o1', 'dog', 0, 0, 2.5, 100, profile);
    emitTrailPointOnMove(state, 'o1', 'dog', 0.6, 0, 2.5, 200, profile);
    expect(state.trailPoints[0].height).toBe(2.5);
  });

  it('spreads points in circular pattern around owner', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile(); // spreadRadius = 0.75
    emitTrailPointOnMove(state, 'o1', 'dog', 0, 0, 0, 100, profile);
    emitTrailPointOnMove(state, 'o1', 'dog', 0.6, 0, 0, 200, profile);
    const pt = state.trailPoints[0];
    const dist = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThan(profile.spreadRadius * 4);
  });

  it('does not touch timeSinceLastEmit', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile();
    // Set up timeSinceLastEmit via emitTrailPoint
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 150, 100, profile);
    expect(state.emitters.get('o1')!.timeSinceLastEmit).toBe(150);
    // emitTrailPointOnMove should not reset timeSinceLastEmit
    emitTrailPointOnMove(state, 'o1', 'dog', 0.6, 0, 0, 200, profile);
    expect(state.emitters.get('o1')!.timeSinceLastEmit).toBe(150);
  });

  it('does not affect distanceSinceLast when emitTrailPoint is called', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitSpacing = 0.5
    // Set up distanceSinceLast via emitTrailPointOnMove (small moves, below emitSpacing)
    emitTrailPointOnMove(state, 'o1', 'dog', 0, 0, 0, 100, profile);
    emitTrailPointOnMove(state, 'o1', 'dog', 0.1, 0, 0, 200, profile);
    expect(state.emitters.get('o1')!.distanceSinceLast).toBeCloseTo(0.1, 5);
    // emitTrailPoint should not reset distanceSinceLast
    emitTrailPoint(state, 'o1', 'dog', 0.1, 0, 0, 50, 250, profile);
    expect(state.emitters.get('o1')!.distanceSinceLast).toBeCloseTo(0.1, 5);
    // emitTrailPointOnMove still accumulates distanceSinceLast after emitTrailPoint call
    emitTrailPointOnMove(state, 'o1', 'dog', 0.2, 0, 0, 300, profile);
    expect(state.emitters.get('o1')!.distanceSinceLast).toBeCloseTo(0.2, 5);
  });

  it('produces dual emission when both functions are called in same frame', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitInterval=200, emitSpacing=0.5
    // Initialize both counters at position (0,0)
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPointOnMove(state, 'o1', 'dog', 0, 0, 0, 100, profile);
    expect(state.trailPoints).toHaveLength(0);
    // First emitTrailPoint at (0,0) with dt=250 >= 200 → emits via time
    emitTrailPoint(state, 'o1', 'dog', 0, 0, 0, 250, 350, profile);
    // Then emitTrailPointOnMove from (0,0) to (0.6,0) → dist=0.6 >= 0.5 → emits via distance
    emitTrailPointOnMove(state, 'o1', 'dog', 0.6, 0, 0, 350, profile);
    // Both should emit → 2 points
    expect(state.trailPoints).toHaveLength(2);
  });

  it('handles multiple emitters independently', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile();
    emitTrailPointOnMove(state, 'o1', 'dog', 0, 0, 0, 100, profile);
    emitTrailPointOnMove(state, 'o2', 'cow', 0, 0, 0, 100, profile);
    emitTrailPointOnMove(state, 'o1', 'dog', 0.6, 0, 0, 200, profile);
    emitTrailPointOnMove(state, 'o2', 'cow', 0.6, 0, 0, 200, profile);
    expect(state.trailPoints).toHaveLength(2);
    expect(state.trailPoints[0].ownerId).toBe('o1');
    expect(state.trailPoints[1].ownerId).toBe('o2');
  });

  it('uses per-profile tauDecayMin/Max for point tauDecay', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const state = createEmptyState();
    const profile = makeDogProfile(); // tauDecayMin=6000, tauDecayMax=10000
    emitTrailPointOnMove(state, 'o1', 'dog', 0, 0, 0, 100, profile);
    emitTrailPointOnMove(state, 'o1', 'dog', 0.6, 0, 0, 200, profile);
    expect(state.trailPoints[0].tauDecay).toBeCloseTo(8000, 5);
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
      scentSpreadSigma: 2.0,
      tauDecayMin: 6000,
      tauDecayMax: 10000,
      emitSpacing: 1.0
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
      scentSpreadSigma: 2.0,
      tauDecayMin: 6000,
      tauDecayMax: 10000,
      emitSpacing: 1.0
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
      scentSpreadSigma: 2.0,
      tauDecayMin: 6000,
      tauDecayMax: 10000,
      emitSpacing: 1.0
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
      scentSpreadSigma: 2.0,
      tauDecayMin: 6000,
      tauDecayMax: 10000,
      emitSpacing: 1.0
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
      scentSpreadSigma: 2.0,
      tauDecayMin: 6000,
      tauDecayMax: 10000,
      emitSpacing: 1.0
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
      scentSpreadSigma: 2.0,
      tauDecayMin: 6000,
      tauDecayMax: 10000,
      emitSpacing: 1.0
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
      scentSpreadSigma: 2.0,
      tauDecayMin: 6000,
      tauDecayMax: 10000,
      emitSpacing: 1.0
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
      scentSpreadSigma: 2.0,
      tauDecayMin: 6000,
      tauDecayMax: 10000,
      emitSpacing: 1.0
    });
    expect(state.trailPoints).toHaveLength(1);
  });
});
