import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ScentWorldState, ScentPoint } from '../../src/types/scent';
import {
  DEFAULT_SCENT_PARAMS,
  getAnimalProfile,
  setTauDecayMultiplier,
  setEmitRateMultiplier
} from '../../src/config/scentConfig';
import {
  emitTrailPoint,
  emitTrailPointOnMove,
  trimExpiredTrails
} from '../../src/services/scentService';

function createEmptyState(): ScentWorldState {
  return { trailPoints: [], emitters: new Map() };
}

function makeScentPoint(overrides: Partial<ScentPoint> = {}): ScentPoint {
  return {
    animalId: 'test-animal',
    animalType: 'dog',
    x: 0,
    y: 0,
    height: 0,
    t: 0,
    tauDecay: 8000,
    ...overrides
  };
}

function makeDogProfile() {
  return getAnimalProfile('dog');
}

describe('emitTrailPoint', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates accumulator and does not emit on first call (dt < emitInterval)', () => {
    const state = createEmptyState();
    emitTrailPoint(state, 'animal-1', 'dog', 10, 20, 1.5, 50, 100, makeDogProfile());
    expect(state.trailPoints).toHaveLength(0);
    expect(state.emitters.has('animal-1')).toBe(true);
    const acc = state.emitters.get('animal-1')!;
    expect(acc.lastX).toBe(10);
    expect(acc.lastY).toBe(20);
    expect(acc.lastHeight).toBe(1.5);
    expect(acc.timeSinceLastEmit).toBe(50);
  });

  it('does not emit when accumulated dt < emitInterval', () => {
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitInterval = 200
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 100, 100, profile);
    emitTrailPoint(state, 'a1', 'dog', 1, 0, 0, 50, 200, profile);
    expect(state.trailPoints).toHaveLength(0);
    expect(state.emitters.get('a1')!.timeSinceLastEmit).toBe(150);
  });

  it('emits when accumulated dt >= emitInterval', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitInterval = 200
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 250, 350, profile);
    expect(state.trailPoints).toHaveLength(1);
    expect(state.trailPoints[0].t).toBe(350);
    expect(state.trailPoints[0].animalId).toBe('a1');
    expect(state.trailPoints[0].animalType).toBe('dog');
  });

  it('resets timeSinceLastEmit to 0 after emitting', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile();
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 250, 350, profile);
    expect(state.emitters.get('a1')!.timeSinceLastEmit).toBe(0);
  });

  it('updates lastX/lastY/lastHeight after emitting', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile();
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'a1', 'dog', 4, 5, 1.2, 250, 350, profile);
    const acc = state.emitters.get('a1')!;
    expect(acc.lastX).toBe(4);
    expect(acc.lastY).toBe(5);
    expect(acc.lastHeight).toBe(1.2);
  });

  it('emits at stationary position when dt accumulates without movement', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile();
    // Animal stays at (10, 20), dt accumulates over frames
    emitTrailPoint(state, 'a1', 'dog', 10, 20, 1.0, 100, 100, profile);
    emitTrailPoint(state, 'a1', 'dog', 10, 20, 1.0, 150, 250, profile);
    expect(state.trailPoints).toHaveLength(1);
    // Point is spread by gaussian around animal position
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
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 250, 350, profile);
    expect(state.trailPoints).toHaveLength(0);
    expect(state.emitters.get('a1')!.timeSinceLastEmit).toBe(0);
  });

  it('emits when Math.random() <= emitProbability', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2);
    const state = createEmptyState();
    const profile = makeDogProfile();
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 250, 350, profile);
    expect(state.trailPoints).toHaveLength(1);
  });

  it('accumulates dt over multiple frames before emitting', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitInterval = 200
    // dt=50 → acc=50 < 200
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 50, 100, profile);
    expect(state.trailPoints).toHaveLength(0);
    // dt=100 → acc=150 < 200
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 100, 200, profile);
    expect(state.trailPoints).toHaveLength(0);
    // dt=100 → acc=250 >= 200 → emit
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 100, 300, profile);
    expect(state.trailPoints).toHaveLength(1);
    // After emit: acc=0 → dt=50 → acc=50 < 200
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 50, 350, profile);
    expect(state.trailPoints).toHaveLength(1);
  });

  it('stores animalHeight in ScentPoint.height', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile();
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 2.5, 0, 100, profile);
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 2.5, 250, 350, profile);
    expect(state.trailPoints[0].height).toBe(2.5);
  });

  it('spreads points in circular pattern around animal', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile(); // spreadRadius = 0.75
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 250, 350, profile);
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
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 250, 350, profile);
    // Math.random()=0.5 => 6000 + 0.5*(10000-6000) = 8000
    expect(state.trailPoints[0].tauDecay).toBeCloseTo(8000, 5);
  });

  it('applies tauDecayMultiplier to emitted tauDecay', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const state = createEmptyState();
    const profile = makeDogProfile(); // tauDecayMin=6000, tauDecayMax=10000
    // multiplier=2.0 => base 8000 * 2 = 16000
    setTauDecayMultiplier(2.0);
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 250, 350, profile);
    expect(state.trailPoints[0].tauDecay).toBeCloseTo(16000, 5);
    setTauDecayMultiplier(1.0); // restore
  });

  it('applies emitRateMultiplier — multiplier 2.0 causes emit even when random > emitProbability', () => {
    // emitProbability=0.8, multiplier=2.0 → effective=1.6 → Math.random() < 1 always, so always emit
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const state = createEmptyState();
    const profile = makeDogProfile();
    setEmitRateMultiplier(2.0);
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 250, 350, profile);
    expect(state.trailPoints).toHaveLength(1);
    setEmitRateMultiplier(1.0);
  });

  it('applies emitRateMultiplier — multiplier 0.1 causes skip when random > effective probability', () => {
    // emitProbability=0.8, multiplier=0.1 → effective=0.08, random=0.1 > 0.08 → skip
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile();
    setEmitRateMultiplier(0.1);
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 250, 350, profile);
    expect(state.trailPoints).toHaveLength(0);
    setEmitRateMultiplier(1.0);
  });

  it('handles multiple emitters independently', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile();
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'a2', 'cow', 0, 0, 0, 0, 100, profile);
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 250, 350, profile);
    emitTrailPoint(state, 'a2', 'cow', 0, 0, 0, 250, 350, profile);
    expect(state.trailPoints).toHaveLength(2);
    expect(state.trailPoints[0].animalId).toBe('a1');
    expect(state.trailPoints[1].animalId).toBe('a2');
  });
});

describe('emitTrailPointOnMove', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates accumulator with distanceSinceLast=0 on first call', () => {
    const state = createEmptyState();
    emitTrailPointOnMove(state, 'animal-1', 'dog', 10, 20, 1.5, 100, makeDogProfile());
    expect(state.trailPoints).toHaveLength(0);
    expect(state.emitters.has('animal-1')).toBe(true);
    const acc = state.emitters.get('animal-1')!;
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
    emitTrailPointOnMove(state, 'a1', 'dog', 0, 0, 0, 100, profile);
    // Move 0.3 units, below threshold
    emitTrailPointOnMove(state, 'a1', 'dog', 0.3, 0, 0, 200, profile);
    expect(state.trailPoints).toHaveLength(0);
    expect(state.emitters.get('a1')!.distanceSinceLast).toBeCloseTo(0.3, 5);
  });

  it('accumulates distance over multiple moves before emitting', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitSpacing = 0.5
    emitTrailPointOnMove(state, 'a1', 'dog', 0, 0, 0, 100, profile);
    // Move 0.2 → acc=0.2 < 0.5
    emitTrailPointOnMove(state, 'a1', 'dog', 0.2, 0, 0, 200, profile);
    expect(state.trailPoints).toHaveLength(0);
    // Move 0.2 → acc=0.4 < 0.5
    emitTrailPointOnMove(state, 'a1', 'dog', 0.4, 0, 0, 300, profile);
    expect(state.trailPoints).toHaveLength(0);
    // Move 0.2 → acc=0.6 >= 0.5 → emit
    emitTrailPointOnMove(state, 'a1', 'dog', 0.6, 0, 0, 400, profile);
    expect(state.trailPoints).toHaveLength(1);
    // After emit: acc=0 → next 0.2 < 0.5
    emitTrailPointOnMove(state, 'a1', 'dog', 0.8, 0, 0, 500, profile);
    expect(state.trailPoints).toHaveLength(1);
  });

  it('resets distanceSinceLast to 0 after emitting', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitSpacing = 0.5
    emitTrailPointOnMove(state, 'a1', 'dog', 0, 0, 0, 100, profile);
    emitTrailPointOnMove(state, 'a1', 'dog', 0.6, 0, 0, 200, profile);
    expect(state.emitters.get('a1')!.distanceSinceLast).toBe(0);
  });

  it('updates lastX/lastY/lastHeight after emitting', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile();
    emitTrailPointOnMove(state, 'a1', 'dog', 0, 0, 0, 100, profile);
    emitTrailPointOnMove(state, 'a1', 'dog', 4, 5, 1.2, 200, profile);
    const acc = state.emitters.get('a1')!;
    expect(acc.lastX).toBe(4);
    expect(acc.lastY).toBe(5);
    expect(acc.lastHeight).toBe(1.2);
  });

  it('updates lastX/lastY/lastHeight even when not emitting', () => {
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitSpacing = 0.5
    emitTrailPointOnMove(state, 'a1', 'dog', 0, 0, 0, 100, profile);
    // Move 0.2 → dist=0.2 < 0.5, no emit
    emitTrailPointOnMove(state, 'a1', 'dog', 0.2, 0, 2.0, 200, profile);
    const acc = state.emitters.get('a1')!;
    expect(acc.lastX).toBe(0.2);
    expect(acc.lastY).toBe(0);
    expect(acc.lastHeight).toBe(2.0);
    expect(state.trailPoints).toHaveLength(0);
  });

  it('skips emission when Math.random() > emitProbability', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitProbability = 0.8
    emitTrailPointOnMove(state, 'a1', 'dog', 0, 0, 0, 100, profile);
    emitTrailPointOnMove(state, 'a1', 'dog', 0.6, 0, 0, 200, profile);
    expect(state.trailPoints).toHaveLength(0);
    expect(state.emitters.get('a1')!.distanceSinceLast).toBe(0);
  });

  it('stores animalHeight in ScentPoint.height', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile();
    emitTrailPointOnMove(state, 'a1', 'dog', 0, 0, 2.5, 100, profile);
    emitTrailPointOnMove(state, 'a1', 'dog', 0.6, 0, 2.5, 200, profile);
    expect(state.trailPoints[0].height).toBe(2.5);
  });

  it('spreads points in circular pattern around animal', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile(); // spreadRadius = 0.75
    emitTrailPointOnMove(state, 'a1', 'dog', 0, 0, 0, 100, profile);
    emitTrailPointOnMove(state, 'a1', 'dog', 0.6, 0, 0, 200, profile);
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
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 150, 100, profile);
    expect(state.emitters.get('a1')!.timeSinceLastEmit).toBe(150);
    // emitTrailPointOnMove should not reset timeSinceLastEmit
    emitTrailPointOnMove(state, 'a1', 'dog', 0.6, 0, 0, 200, profile);
    expect(state.emitters.get('a1')!.timeSinceLastEmit).toBe(150);
  });

  it('does not affect distanceSinceLast when emitTrailPoint is called', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitSpacing = 0.5
    // Set up distanceSinceLast via emitTrailPointOnMove (small moves, below emitSpacing)
    emitTrailPointOnMove(state, 'a1', 'dog', 0, 0, 0, 100, profile);
    emitTrailPointOnMove(state, 'a1', 'dog', 0.1, 0, 0, 200, profile);
    expect(state.emitters.get('a1')!.distanceSinceLast).toBeCloseTo(0.1, 5);
    // emitTrailPoint should not reset distanceSinceLast
    emitTrailPoint(state, 'a1', 'dog', 0.1, 0, 0, 50, 250, profile);
    expect(state.emitters.get('a1')!.distanceSinceLast).toBeCloseTo(0.1, 5);
    // emitTrailPointOnMove still accumulates distanceSinceLast after emitTrailPoint call
    emitTrailPointOnMove(state, 'a1', 'dog', 0.2, 0, 0, 300, profile);
    expect(state.emitters.get('a1')!.distanceSinceLast).toBeCloseTo(0.2, 5);
  });

  it('produces dual emission when both functions are called in same frame', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitInterval=200, emitSpacing=0.5
    // Initialize both counters at position (0,0)
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 0, 100, profile);
    emitTrailPointOnMove(state, 'a1', 'dog', 0, 0, 0, 100, profile);
    expect(state.trailPoints).toHaveLength(0);
    // First emitTrailPoint at (0,0) with dt=250 >= 200 → emits via time
    emitTrailPoint(state, 'a1', 'dog', 0, 0, 0, 250, 350, profile);
    // Then emitTrailPointOnMove from (0,0) to (0.6,0) → dist=0.6 >= 0.5 → emits via distance
    emitTrailPointOnMove(state, 'a1', 'dog', 0.6, 0, 0, 350, profile);
    // Both should emit → 2 points
    expect(state.trailPoints).toHaveLength(2);
  });

  it('handles multiple emitters independently', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile();
    emitTrailPointOnMove(state, 'a1', 'dog', 0, 0, 0, 100, profile);
    emitTrailPointOnMove(state, 'a2', 'cow', 0, 0, 0, 100, profile);
    emitTrailPointOnMove(state, 'a1', 'dog', 0.6, 0, 0, 200, profile);
    emitTrailPointOnMove(state, 'a2', 'cow', 0.6, 0, 0, 200, profile);
    expect(state.trailPoints).toHaveLength(2);
    expect(state.trailPoints[0].animalId).toBe('a1');
    expect(state.trailPoints[1].animalId).toBe('a2');
  });

  it('applies emitRateMultiplier in emitTrailPointOnMove — multiplier 2.0 causes emit', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitProbability=0.8
    setEmitRateMultiplier(2.0); // effective=1.6 → always emit
    emitTrailPointOnMove(state, 'a1', 'dog', 0, 0, 0, 100, profile);
    emitTrailPointOnMove(state, 'a1', 'dog', 0.6, 0, 0, 200, profile);
    expect(state.trailPoints).toHaveLength(1);
    setEmitRateMultiplier(1.0);
  });

  it('applies emitRateMultiplier in emitTrailPointOnMove — multiplier 0.1 causes skip', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const state = createEmptyState();
    const profile = makeDogProfile(); // emitProbability=0.8
    setEmitRateMultiplier(0.1); // effective=0.08, random=0.1 > 0.08 → skip
    emitTrailPointOnMove(state, 'a1', 'dog', 0, 0, 0, 100, profile);
    emitTrailPointOnMove(state, 'a1', 'dog', 0.6, 0, 0, 200, profile);
    expect(state.trailPoints).toHaveLength(0);
    setEmitRateMultiplier(1.0);
  });

  it('uses per-profile tauDecayMin/Max for point tauDecay', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const state = createEmptyState();
    const profile = makeDogProfile(); // tauDecayMin=6000, tauDecayMax=10000
    emitTrailPointOnMove(state, 'a1', 'dog', 0, 0, 0, 100, profile);
    emitTrailPointOnMove(state, 'a1', 'dog', 0.6, 0, 0, 200, profile);
    expect(state.trailPoints[0].tauDecay).toBeCloseTo(8000, 5);
  });

  it('applies tauDecayMultiplier to emitted tauDecay in emitTrailPointOnMove', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const state = createEmptyState();
    const profile = makeDogProfile(); // tauDecayMin=6000, tauDecayMax=10000
    // multiplier=2.0 => base 8000 * 2 = 16000
    setTauDecayMultiplier(2.0);
    emitTrailPointOnMove(state, 'a1', 'dog', 0, 0, 0, 100, profile);
    emitTrailPointOnMove(state, 'a1', 'dog', 0.6, 0, 0, 200, profile);
    expect(state.trailPoints[0].tauDecay).toBeCloseTo(16000, 5);
    setTauDecayMultiplier(1.0); // restore
  });
});

describe('trimExpiredTrails', () => {
  it('removes points older than tauDecay*5', () => {
    const state = createEmptyState();
    // point0: tauDecay=600 → threshold=3000, age=5000 → removed
    state.trailPoints.push(makeScentPoint({ t: 0, tauDecay: 600 }));
    // point1: tauDecay=600 → threshold=3000, age=3000 → kept (boundary)
    state.trailPoints.push(makeScentPoint({ t: 2000, tauDecay: 600 }));
    // point2: tauDecay=600 → threshold=3000, age=1000 → kept
    state.trailPoints.push(makeScentPoint({ t: 4000, tauDecay: 600 }));
    trimExpiredTrails(state, 5000, {
      tauDecay: 600,
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
    // both points: tauDecay=600 → threshold=3000, ages=2000,1000 → kept
    state.trailPoints.push(makeScentPoint({ t: 8000, tauDecay: 600 }));
    state.trailPoints.push(makeScentPoint({ t: 9000, tauDecay: 600 }));
    trimExpiredTrails(state, 10000, {
      tauDecay: 600,
      scentSpreadSigma: 2.0,
      tauDecayMin: 6000,
      tauDecayMax: 10000,
      emitSpacing: 1.0
    });
    expect(state.trailPoints).toHaveLength(2);
  });

  it('removes all points when all are expired', () => {
    const state = createEmptyState();
    // both points: tauDecay=1000 → threshold=5000, ages=10000,9000 → removed
    state.trailPoints.push(makeScentPoint({ t: 0, tauDecay: 1000 }));
    state.trailPoints.push(makeScentPoint({ t: 1000, tauDecay: 1000 }));
    trimExpiredTrails(state, 10000, {
      tauDecay: 1000,
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

  it('keeps point with age exactly equal to tauDecay*5 (boundary)', () => {
    const state = createEmptyState();
    // tauDecay=600 → threshold=3000, age=3000 → kept (boundary)
    state.trailPoints.push(makeScentPoint({ t: 7000, tauDecay: 600 }));
    // tauDecay=600 → threshold=3000, age=4000 → removed (over boundary)
    state.trailPoints.push(makeScentPoint({ t: 6000, tauDecay: 600 }));
    trimExpiredTrails(state, 10000, {
      tauDecay: 600,
      scentSpreadSigma: 2.0,
      tauDecayMin: 6000,
      tauDecayMax: 10000,
      emitSpacing: 1.0
    });
    expect(state.trailPoints).toHaveLength(1);
    expect(state.trailPoints[0].t).toBe(7000);
  });
});
