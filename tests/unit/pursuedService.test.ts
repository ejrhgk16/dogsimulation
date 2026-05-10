import { describe, it, expect } from 'vitest';
import { createPursued, movePursued_keyevent } from '../../src/services/pursuedService';
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

function pursuedAt(x: number, y: number, mapData?: MapData) {
  const map = mapData ?? createFlatMap();
  return createPursued('test', 'dog', x, y, map);
}

describe('createPursued', () => {
  it('returns pursued with given props and default direction', () => {
    const map = createFlatMap();
    const p = createPursued('p1', 'alpaca', 10, 20, map);
    expect(p.id).toBe('p1');
    expect(p.animalType).toBe('alpaca');
    expect(p.x).toBe(10);
    expect(p.y).toBe(20);
    expect(p.height).toBeCloseTo(ANIMAL_HEIGHT_OFFSET);
    expect(p.directionX).toBe(1);
    expect(p.directionY).toBe(0);
  });

  it('initializes rotationAngle from initial direction', () => {
    const map = createFlatMap();
    const p = createPursued('p1', 'dog', 0, 0, map);
    expect(p.rotationAngle).toBeCloseTo(Math.atan2(1, 0));
  });

  it('initializes height from terrain height plus offset', () => {
    const map = createFlatMap();
    map.grid[0][0] = { ...map.grid[0][0], height: 3 };
    map.grid[0][1] = { ...map.grid[0][1], height: 3 };
    map.grid[1][0] = { ...map.grid[1][0], height: 3 };
    map.grid[1][1] = { ...map.grid[1][1], height: 3 };
    const p = createPursued('test', 'dog', -5, -5, map);
    expect(p.height).toBeCloseTo(3 + ANIMAL_HEIGHT_OFFSET);
  });
});

describe('movePursued_keyevent', () => {
  it('moves right on ArrowRight', () => {
    const map = createFlatMap();
    const p = pursuedAt(-5, -5);
    movePursued_keyevent(p, new Set(['ArrowRight']), 1, map);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(-5);
    expect(p.directionX).toBe(1);
    expect(p.directionY).toBe(0);
  });

  it('moves left on ArrowLeft', () => {
    const map = createFlatMap();
    const p = pursuedAt(-5, -5);
    movePursued_keyevent(p, new Set(['ArrowLeft']), 0.5, map);
    expect(p.x).toBeCloseTo(-7.5);
    expect(p.y).toBeCloseTo(-5);
    expect(p.directionX).toBe(-1);
    expect(p.directionY).toBe(0);
  });

  it('moves up on ArrowUp', () => {
    const map = createFlatMap();
    const p = pursuedAt(-5, -5);
    movePursued_keyevent(p, new Set(['ArrowUp']), 0.5, map);
    expect(p.x).toBeCloseTo(-5);
    expect(p.y).toBeCloseTo(-7.5);
    expect(p.directionX).toBe(0);
    expect(p.directionY).toBe(-1);
  });

  it('does not move when no key pressed', () => {
    const map = createFlatMap();
    const p = pursuedAt(-5, -5);
    movePursued_keyevent(p, new Set(), 1, map);
    expect(p.x).toBeCloseTo(-5);
    expect(p.y).toBeCloseTo(-5);
    expect(p.directionX).toBe(0);
    expect(p.directionY).toBe(0);
  });

  it('supports diagonal movement', () => {
    const map = createFlatMap();
    const p = pursuedAt(-5, -5);
    movePursued_keyevent(p, new Set(['ArrowDown', 'ArrowLeft']), 1, map);
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
    const p = pursuedAt(-5, -5);
    movePursued_keyevent(p, new Set(['ArrowRight']), 1, map);
    expect(p.x).toBeCloseTo(-5);
    expect(p.y).toBeCloseTo(-5);
    expect(p.directionX).toBe(1);
    expect(p.directionY).toBe(0);
  });

  it('slides along clear axis when diagonal partially blocked', () => {
    const map = createFlatMap();
    map.grid[0][1] = { ...map.grid[0][1], terrain: 'obstacle', height: 0 };
    map.grid[1][1] = { ...map.grid[1][1], terrain: 'obstacle', height: 0 };
    const p = pursuedAt(-5, -5);
    movePursued_keyevent(p, new Set(['ArrowDown', 'ArrowRight']), 2, map);
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
    const p = pursuedAt(-5, -5);
    movePursued_keyevent(p, new Set(['ArrowDown', 'ArrowRight']), 2, map);
    expect(p.x).toBeCloseTo(-5);
    expect(p.y).toBeCloseTo(-5);
  });

  it('stays in place when moving out of bounds', () => {
    const map = createFlatMap();
    const p = pursuedAt(-5, -5);
    movePursued_keyevent(p, new Set(['ArrowLeft']), 2, map);
    expect(p.x).toBeCloseTo(-5);
    expect(p.y).toBeCloseTo(-5);
  });

  it('moves slower when height diff is large', () => {
    const map = createFlatMap();
    map.grid[0][1] = { ...map.grid[0][1], height: 8, terrain: 'hill' };
    const p = pursuedAt(-5, -5);
    movePursued_keyevent(p, new Set(['ArrowRight']), 1, map);
    expect(p.x).toBeGreaterThan(-5);
    expect(p.x).toBeLessThan(0);
    expect(p.y).toBeCloseTo(-5);
  });

  it('height changes when moving onto hill', () => {
    const map = createFlatMap();
    map.grid[0][0] = { ...map.grid[0][0], height: 0, terrain: 'flat' };
    map.grid[0][1] = { ...map.grid[0][1], height: 4, terrain: 'hill' };
    const p = createPursued('test', 'dog', -1, -5, map);
    const origHeight = p.height;
    movePursued_keyevent(p, new Set(['ArrowRight']), 2, map);
    expect(p.height).not.toBe(origHeight);
    expect(p.x).toBeGreaterThan(-1);
  });
});

describe('movePursued_keyevent with entity collision', () => {
  it('moves right when no pursuer blocks', () => {
    const map = createFlatMap();
    const p = pursuedAt(-5, -5);
    movePursued_keyevent(p, new Set(['ArrowRight']), 1, map, []);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(-5);
  });

  it('stops when pursuer blocks the path', () => {
    const map = createFlatMap();
    const p = pursuedAt(-5, -5);
    // Start at (-5,-5), move right, speed=5, dt=1 → combined=(0,-5)
    // Pursuer at (-0.4, -5): dist to (0,-5)=0.4<1 → blocked
    movePursued_keyevent(p, new Set(['ArrowRight']), 1, map, [{ x: -0.4, y: -5 }]);
    expect(p.x).toBeCloseTo(-5);
    expect(p.y).toBeCloseTo(-5);
  });
});
