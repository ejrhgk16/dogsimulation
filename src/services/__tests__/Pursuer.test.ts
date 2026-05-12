import { describe, it, expect } from 'vitest';
import { Pursuer } from '../Pursuer';
import type { ScentSample } from '../../types/pursuer';
import type { ScentPoint } from '../../types/scent';
import type { MapData } from '../../types/map';
import { DEFAULT_TRACKING_PARAMS } from '../../config/trackingConfig';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createFlatMapData(size = 20): MapData {
  const grid = [];
  for (let row = 0; row < size; row++) {
    const rowCells = [];
    for (let col = 0; col < size; col++) {
      rowCells.push({ x: col, z: row, height: 0, terrain: 'flat' as const });
    }
    grid.push(rowCells);
  }
  return { grid, cellSize: 1, width: size, depth: size };
}

function makePoint(
  x: number,
  y: number,
  t: number,
  animalId = 'test',
  animalType = 'dog',
  height = 0,
  tauDecay = 8000
): ScentPoint {
  return { animalId, animalType, x, y, height, t, tauDecay };
}

function createPursuer(x = 0, y = 0): Pursuer {
  const mapData = createFlatMapData();
  return new Pursuer('test-dog', x, y, mapData, 5, 7, DEFAULT_TRACKING_PARAMS);
}

// ---------------------------------------------------------------------------
// Test 1: getDogSensorPositions() left/right accuracy
// ---------------------------------------------------------------------------
describe('getDogSensorPositions()', () => {
  it('left is +Y and right is -Y when dog faces +X (rotationAngle=0)', () => {
    const pursuer = createPursuer(0, 0);
    // Override rotationAngle — constructor sets it to atan2(1,0)=PI/2
    pursuer.rotationAngle = 0;
    pursuer.x = 0;
    pursuer.y = 0;

    const sensors = pursuer.getDogSensorPositions();
    // left should have larger Y than center (left = lateral +Y direction)
    expect(sensors.left.y).toBeGreaterThan(sensors.center.y);
    // right should have smaller Y than center (right = lateral -Y direction)
    expect(sensors.right.y).toBeLessThan(sensors.center.y);
    // left and right should be symmetric around center Y
    expect(sensors.left.y - sensors.center.y).toBeCloseTo(sensors.center.y - sensors.right.y, 10);
  });
});

// ---------------------------------------------------------------------------
// Test 2: center freshest → netBias ≈ 0, confidence ≈ 0
// ---------------------------------------------------------------------------
describe('buildDogScentSample() center-relative bias', () => {
  it('center freshest → netBias ≈ 0, directionConfidence ≈ 0, signalDirection ≈ trailHeading', () => {
    const pursuer = createPursuer(0, 0);
    pursuer.rotationAngle = 0; // face +X → center=(1,0), left=(1,1), right=(1,-1)
    pursuer.estimatedHeading = 1.0; // arbitrary trail heading
    // trailMemory with 2 points so trailHeading can be computed
    pursuer.trailMemory = [
      { x: -1, y: 0 },
      { x: 0, y: 0 }
    ];
    // trailHeading from trailMemory: dx=1, dy=0 → atan2(0,1)=0
    // But that differs from estimatedHeading… let's make them consistent
    pursuer.trailMemory = [
      { x: 0, y: 0 },
      { x: 10, y: Math.tan(1.0) * 10 } // approx (10, 15.57) → atan2≈1.0
    ];

    const now = 10000;
    // Fresh point at center, old points symmetric on both sides
    const trailPoints: ScentPoint[] = [
      makePoint(1, 0, now), // fresh at center
      makePoint(1, 1, 0), // old at left
      makePoint(1, -1, 0) // old at right (symmetric to left)
    ];

    const sample = (pursuer as any)['buildDogScentSample'](trailPoints, now) as ScentSample;

    // center is freshest → both sides staler → leftAdv≈rightAdv → netBias≈0
    expect(sample.directionConfidence).toBeLessThan(1e-3);
    // Since confidence < 1e-3, signalDirection equals trailHeading (not blended)
    // trailHeading from trailMemory: atan2(dy,dx) ≈ 1.0
    expect(sample.signalDirection).toBeCloseTo(1.0, 2);
    // totalSignal > 0 (we have points)
    expect(sample.totalSignal).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Test 3: left fresher than center → left-turn bias (netBias < 0)
// ---------------------------------------------------------------------------
describe('left-side bias', () => {
  it('left fresher than center → signalDirection < trailHeading (left turn)', () => {
    const pursuer = createPursuer(0, 0);
    pursuer.rotationAngle = 0;
    pursuer.estimatedHeading = 1.0;
    pursuer.trailMemory = [
      { x: 0, y: 0 },
      { x: 10, y: 10 * Math.tan(1.0) }
    ];

    const now = 10000;
    // Fresh point at left, old points at center and right
    const trailPoints: ScentPoint[] = [
      makePoint(1, 1, now), // fresh at left
      makePoint(1, 0, 0), // old at center
      makePoint(1, -1, 0) // old at right
    ];

    const sample = (pursuer as any)['buildDogScentSample'](trailPoints, now) as ScentSample;

    // netBias < 0 → confidence > 0 and signalDirection < trailHeading
    expect(sample.directionConfidence).toBeGreaterThan(1e-3);
    expect(sample.signalDirection).toBeLessThan(1.0);
    expect(sample.totalSignal).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Test 4: right fresher than center → right-turn bias (netBias > 0)
// ---------------------------------------------------------------------------
describe('right-side bias', () => {
  it('right fresher than center → signalDirection > trailHeading (right turn)', () => {
    const pursuer = createPursuer(0, 0);
    pursuer.rotationAngle = 0;
    pursuer.estimatedHeading = 1.0;
    pursuer.trailMemory = [
      { x: 0, y: 0 },
      { x: 10, y: 10 * Math.tan(1.0) }
    ];

    const now = 10000;
    // Fresh point at right, old points at center and left
    const trailPoints: ScentPoint[] = [
      makePoint(1, -1, now), // fresh at right
      makePoint(1, 0, 0), // old at center
      makePoint(1, 1, 0) // old at left
    ];

    const sample = (pursuer as any)['buildDogScentSample'](trailPoints, now) as ScentSample;

    // netBias > 0 → confidence > 0 and signalDirection > trailHeading
    expect(sample.directionConfidence).toBeGreaterThan(1e-3);
    expect(sample.signalDirection).toBeGreaterThan(1.0);
    expect(sample.totalSignal).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Test 5: one-side detection → bias works
// ---------------------------------------------------------------------------
describe('one-side-only detection', () => {
  it('left only isFinite, right=∞ → netBias < 0, confidence > 0 (left turn)', () => {
    const pursuer = createPursuer(0, 0);
    pursuer.rotationAngle = 0;
    pursuer.estimatedHeading = 1.0;
    pursuer.trailMemory = [
      { x: 0, y: 0 },
      { x: 10, y: 10 * Math.tan(1.0) }
    ];
    // Use large sensorRadius so right sensor is far from the scent point
    pursuer.trackingParams = { ...DEFAULT_TRACKING_PARAMS, sensorRadius: 10 };

    const now = 10000;
    // Point right at left sensor → right sensor too far to detect
    // left sensor: distance 0; right sensor: distance 20
    const trailPoints: ScentPoint[] = [
      makePoint(1, 10, now), // at left sensor position (sensorRadius=10)
      makePoint(1, 0, 0) // old at center (distance 10 from left, 0 from center, 10 from right)
    ];

    const sample = (pursuer as any)['buildDogScentSample'](trailPoints, now) as ScentSample;

    // right avgAge should be Infinity (undetected), left finite → bias left
    expect(sample.directionConfidence).toBeGreaterThan(1e-3);
    expect(sample.signalDirection).toBeLessThan(1.0);
  });
});

// ---------------------------------------------------------------------------
// Test 6: trailMemory save condition (confidence < 1e-3)
// ---------------------------------------------------------------------------
describe('trailMemory save condition', () => {
  it('pushes to trailMemory only when confidence < 1e-3 and center isFinite', () => {
    const pursuer = createPursuer(0, 0);
    pursuer.rotationAngle = 0;
    pursuer.estimatedHeading = 1.0;
    // trailMemory with 2 points far from (0,0) so distance > 0.1 triggers push
    pursuer.trailMemory = [
      { x: 100, y: 0 },
      { x: 200, y: 200 * Math.tan(1.0) }
    ];

    const now = 10000;
    // Symmetric ScentPoints relative to sensors at (1,0),(1,1),(1,-1)
    // → center freshest, leftAdv≈rightAdv → netBias≈0 → confidence<1e-3
    const trailPoints: ScentPoint[] = [
      makePoint(1, 0, now), // fresh center
      makePoint(1, 1, 0), // old left
      makePoint(1, -1, 0) // old right
    ];

    const memoryBefore = pursuer.trailMemory.length;

    (pursuer as any)['buildDogScentSample'](trailPoints, now) as ScentSample;

    // trailMemory should have grown by 1 (push happened because confidence < 1e-3)
    expect(pursuer.trailMemory.length).toBe(memoryBefore + 1);
    // last entry should be current dog position
    const lastEntry = pursuer.trailMemory[pursuer.trailMemory.length - 1];
    expect(lastEntry.x).toBe(0);
    expect(lastEntry.y).toBe(0);
  });

  it('does NOT push to trailMemory when confidence >= 1e-3', () => {
    const pursuer = createPursuer(0, 0);
    pursuer.rotationAngle = 0;
    pursuer.estimatedHeading = 1.0;
    pursuer.trailMemory = [
      { x: 0, y: 0 },
      { x: 10, y: 10 * Math.tan(1.0) }
    ];

    const now = 10000;
    // Only left-side fresh → confidence > 1e-3 → no push
    const trailPoints: ScentPoint[] = [
      makePoint(1, 1, now), // fresh left only
      makePoint(1, 0, 0) // old center
    ];

    const memoryBefore = pursuer.trailMemory.length;

    (pursuer as any)['buildDogScentSample'](trailPoints, now) as ScentSample;

    // trailMemory should NOT have grown
    expect(pursuer.trailMemory.length).toBe(memoryBefore);
  });
});
