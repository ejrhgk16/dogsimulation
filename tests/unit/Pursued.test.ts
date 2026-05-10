import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pursued } from '../../src/services/Pursued';
import type { MapData, MapCell } from '../../src/types/map';
import { ANIMAL_HEIGHT_OFFSET } from '../../src/config/animalConfig';

function createFlatMap(): MapData {
  const cellSize = 10;
  const grid: MapCell[][] = [
    [
      { x: 0, z: 0, height: 0, terrain: 'flat' },
      { x: 10, z: 0, height: 0, terrain: 'flat' }
    ],
    [
      { x: 0, z: 10, height: 0, terrain: 'flat' },
      { x: 10, z: 10, height: 0, terrain: 'flat' }
    ]
  ];
  return { grid, cellSize, width: 2, depth: 2 };
}

describe('Pursued constructor', () => {
  it('creates Pursued with given id, animalType, position and defaults', () => {
    const map = createFlatMap();
    const p = new Pursued('p1', 'alpaca', 10, 20, map);
    expect(p.id).toBe('p1');
    expect(p.animalType).toBe('alpaca');
    expect(p.x).toBe(10);
    expect(p.y).toBe(20);
    expect(p.height).toBeCloseTo(ANIMAL_HEIGHT_OFFSET);
    expect(p.speed).toBe(5.0);
    expect(p.directionX).toBe(1);
    expect(p.directionY).toBe(0);
    expect(p.rotationAngle).toBeCloseTo(Math.atan2(1, 0));
  });

  it('accepts custom speed', () => {
    const map = createFlatMap();
    const p = new Pursued('p1', 'dog', 0, 0, map, 3.0);
    expect(p.speed).toBe(3.0);
  });

  it('initializes height from terrain height plus offset', () => {
    const map = createFlatMap();
    map.grid[0][0] = { ...map.grid[0][0], height: 5 };
    map.grid[0][1] = { ...map.grid[0][1], height: 5 };
    map.grid[1][0] = { ...map.grid[1][0], height: 5 };
    map.grid[1][1] = { ...map.grid[1][1], height: 5 };
    const p = new Pursued('p1', 'dog', -5, -5, map);
    expect(p.height).toBeCloseTo(5 + ANIMAL_HEIGHT_OFFSET);
  });
});

describe('Pursued.moveByKeys', () => {
  it('moves right on ArrowRight', () => {
    const map = createFlatMap();
    const p = new Pursued('p1', 'dog', -5, -5, map);
    p.moveByKeys(new Set(['ArrowRight']), 1, map);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(-5);
    expect(p.directionX).toBe(1);
    expect(p.directionY).toBe(0);
  });

  it('moves left on ArrowLeft', () => {
    const map = createFlatMap();
    const p = new Pursued('p1', 'dog', -5, -5, map);
    p.moveByKeys(new Set(['ArrowLeft']), 0.5, map);
    expect(p.x).toBeCloseTo(-7.5);
    expect(p.y).toBeCloseTo(-5);
    expect(p.directionX).toBe(-1);
    expect(p.directionY).toBe(0);
  });

  it('moves up on ArrowUp', () => {
    const map = createFlatMap();
    const p = new Pursued('p1', 'dog', -5, -5, map);
    p.moveByKeys(new Set(['ArrowUp']), 0.5, map);
    expect(p.x).toBeCloseTo(-5);
    expect(p.y).toBeCloseTo(-7.5);
    expect(p.directionX).toBe(0);
    expect(p.directionY).toBe(-1);
  });

  it('moves down on ArrowDown', () => {
    const map = createFlatMap();
    const p = new Pursued('p1', 'dog', -5, -5, map);
    p.moveByKeys(new Set(['ArrowDown']), 0.5, map);
    expect(p.x).toBeCloseTo(-5);
    expect(p.y).toBeCloseTo(-2.5);
    expect(p.directionX).toBe(0);
    expect(p.directionY).toBe(1);
  });

  it('does not move when no key pressed', () => {
    const map = createFlatMap();
    const p = new Pursued('p1', 'dog', -5, -5, map);
    p.moveByKeys(new Set(), 1, map);
    expect(p.x).toBeCloseTo(-5);
    expect(p.y).toBeCloseTo(-5);
    expect(p.directionX).toBe(0);
    expect(p.directionY).toBe(0);
  });

  it('supports diagonal movement', () => {
    const map = createFlatMap();
    const p = new Pursued('p1', 'dog', -5, -5, map);
    p.moveByKeys(new Set(['ArrowDown', 'ArrowLeft']), 1, map);
    const expectedDx = -1 / Math.SQRT2;
    const expectedDy = 1 / Math.SQRT2;
    expect(p.directionX).toBeCloseTo(expectedDx);
    expect(p.directionY).toBeCloseTo(expectedDy);
    expect(p.x).toBeGreaterThan(-9);
    expect(p.x).toBeLessThan(-7);
    expect(p.y).toBeGreaterThan(-2);
    expect(p.y).toBeLessThan(0);
  });

  it('stays in place when moving into obstacle', () => {
    const map = createFlatMap();
    map.grid[0][1] = { ...map.grid[0][1], terrain: 'obstacle', height: 0 };
    const p = new Pursued('p1', 'dog', -5, -5, map);
    p.moveByKeys(new Set(['ArrowRight']), 1, map);
    expect(p.x).toBeCloseTo(-5);
    expect(p.y).toBeCloseTo(-5);
    expect(p.directionX).toBe(1);
    expect(p.directionY).toBe(0);
  });

  it('slides along clear axis when diagonal partially blocked', () => {
    const map = createFlatMap();
    map.grid[0][1] = { ...map.grid[0][1], terrain: 'obstacle', height: 0 };
    map.grid[1][1] = { ...map.grid[1][1], terrain: 'obstacle', height: 0 };
    const p = new Pursued('p1', 'dog', -5, -5, map);
    p.moveByKeys(new Set(['ArrowDown', 'ArrowRight']), 2, map);
    // x blocked (grid[0][1] obstacle), y clear (grid[1][0] flat) → slides down
    expect(p.x).toBeCloseTo(-5);
    expect(p.y).toBeGreaterThan(0);
    expect(p.directionX).toBeCloseTo(1 / Math.SQRT2);
    expect(p.directionY).toBeCloseTo(1 / Math.SQRT2);
  });

  it('stays in place when both axes blocked', () => {
    const map = createFlatMap();
    map.grid[0][1] = { ...map.grid[0][1], terrain: 'obstacle', height: 0 };
    map.grid[1][0] = { ...map.grid[1][0], terrain: 'obstacle', height: 0 };
    map.grid[1][1] = { ...map.grid[1][1], terrain: 'obstacle', height: 0 };
    const p = new Pursued('p1', 'dog', -5, -5, map);
    p.moveByKeys(new Set(['ArrowDown', 'ArrowRight']), 2, map);
    expect(p.x).toBeCloseTo(-5);
    expect(p.y).toBeCloseTo(-5);
  });

  it('stays in place when moving out of bounds', () => {
    const map = createFlatMap();
    const p = new Pursued('p1', 'dog', -5, -5, map);
    p.moveByKeys(new Set(['ArrowLeft']), 2, map);
    expect(p.x).toBeCloseTo(-5);
    expect(p.y).toBeCloseTo(-5);
  });

  it('moves slower when height diff is large', () => {
    const map = createFlatMap();
    map.grid[0][1] = { ...map.grid[0][1], height: 8, terrain: 'hill' };
    const p = new Pursued('p1', 'dog', -5, -5, map);
    p.moveByKeys(new Set(['ArrowRight']), 1, map);
    expect(p.x).toBeGreaterThan(-5);
    expect(p.x).toBeLessThan(0);
    expect(p.y).toBeCloseTo(-5);
  });

  it('height changes when moving onto hill', () => {
    const map = createFlatMap();
    map.grid[0][0] = { ...map.grid[0][0], height: 0, terrain: 'flat' };
    map.grid[0][1] = { ...map.grid[0][1], height: 4, terrain: 'hill' };
    const p = new Pursued('p1', 'dog', -1, -5, map);
    const origHeight = p.height;
    p.moveByKeys(new Set(['ArrowRight']), 2, map);
    expect(p.height).not.toBe(origHeight);
    expect(p.x).toBeGreaterThan(-1);
  });
});

describe('Pursued.moveByKeys with entity collision', () => {
  it('moves right when no pursuer blocks', () => {
    const map = createFlatMap();
    const p = new Pursued('p1', 'dog', -5, -5, map);
    p.moveByKeys(new Set(['ArrowRight']), 1, map, []);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(-5);
  });

  it('stops when pursuer blocks the path', () => {
    const map = createFlatMap();
    const p = new Pursued('p1', 'dog', -5, -5, map);
    p.moveByKeys(new Set(['ArrowRight']), 1, map, [{ x: -0.4, y: -5 }]);
    expect(p.x).toBeCloseTo(-5);
    expect(p.y).toBeCloseTo(-5);
  });
});

describe('Pursued scent emission', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fresh point emitted when probability passes', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const map = createFlatMap();
    const p = new Pursued('p1', 'dog', 100, 200, map);
    p.emitScent(1000);
    expect(p.trailPoints).toHaveLength(1);
    const pt = p.trailPoints[0];
    expect(pt.animalId).toBe('p1');
    expect(pt.animalType).toBe('dog');
    expect(pt.t).toBe(1000);
    expect(pt.height).toBeGreaterThanOrEqual(0);
    expect(pt.tauDecay).toBeGreaterThan(0);
  });

  it('applies gaussian spread around animal position', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const map = createFlatMap();
    const p = new Pursued('p1', 'dog', 100, 200, map);
    p.emitScent(1000);
    const pt = p.trailPoints[0];
    const dx = pt.x - 100;
    const dy = pt.y - 200;
    const dist = Math.sqrt(dx * dx + dy * dy);
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThan(3);
  });

  it('assigns tauDecay within profile range', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const map = createFlatMap();
    const p = new Pursued('p1', 'dog', 0, 0, map);
    p.emitScent(1000);
    expect(p.trailPoints[0].tauDecay).toBeCloseTo(8000, 5);
  });

  it('emits after emitInterval passes, skips within', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const map = createFlatMap();
    const p = new Pursued('p1', 'dog', 0, 0, map);
    // first call: time throttle passes → 1 point
    p.emitScent(1000);
    expect(p.trailPoints).toHaveLength(1);
    // within interval (1050-1000=50 < 200): skip → 0
    p.emitScent(1050);
    expect(p.trailPoints).toHaveLength(1);
    // after interval (1500-1000=500 >= 200): passes → +1
    p.emitScent(1500);
    expect(p.trailPoints).toHaveLength(2);
  });

  it('skips when probability check fails', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const map = createFlatMap();
    const p = new Pursued('p1', 'dog', 0, 0, map);
    p.emitScent(1000);
    expect(p.trailPoints).toHaveLength(0);
  });

  it('skips when within emitInterval', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const map = createFlatMap();
    const p = new Pursued('p1', 'dog', 0, 0, map);
    p.emitScent(1000);
    expect(p.trailPoints).toHaveLength(1);
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    p.emitScent(1100);
    expect(p.trailPoints).toHaveLength(1);
  });

  it('emit by distance spacing after moving enough', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const map = createFlatMap();
    const p = new Pursued('p1', 'dog', -5, 0, map);
    // first call: time throttle + distance(0.5>=0.5) → 2 points
    p.moveByKeys(new Set(['ArrowRight']), 0.1, map);
    p.emitScent(1000);
    expect(p.trailPoints).toHaveLength(2);
    // within time interval, move more → distance throttle → +1
    p.moveByKeys(new Set(['ArrowRight']), 0.1, map);
    p.emitScent(1100);
    expect(p.trailPoints).toHaveLength(3);
  });

  it('trim removes old trail points on emitScent', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const map = createFlatMap();
    const p = new Pursued('p1', 'dog', 0, 0, map);
    p.trailPoints.push({
      animalId: 'p1',
      animalType: 'dog',
      x: 0,
      y: 0,
      height: 0,
      t: 0,
      tauDecay: 600
    });
    p.emitScent(10000);
    expect(p.trailPoints).toHaveLength(1);
    expect(p.trailPoints[0].t).toBe(10000);
  });

  it('keeps fresh trail points after emitScent trim', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const map = createFlatMap();
    const p = new Pursued('p1', 'dog', 0, 0, map);
    p.trailPoints.push({
      animalId: 'p1',
      animalType: 'dog',
      x: 0,
      y: 0,
      height: 0,
      t: 9000,
      tauDecay: 600
    });
    p.emitScent(10000);
    expect(p.trailPoints).toHaveLength(2);
  });

  it('works with alpaca animal type', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const map = createFlatMap();
    const p = new Pursued('a1', 'alpaca', 0, 0, map);
    p.emitScent(1000);
    expect(p.trailPoints).toHaveLength(1);
    expect(p.trailPoints[0].animalType).toBe('alpaca');
  });

  it('works with pig animal type', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const map = createFlatMap();
    const p = new Pursued('p1', 'pig', 0, 0, map);
    p.emitScent(1000);
    expect(p.trailPoints).toHaveLength(1);
    expect(p.trailPoints[0].animalType).toBe('pig');
  });
});
