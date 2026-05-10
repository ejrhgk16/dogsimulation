import { describe, it, expect } from 'vitest';
import { createPursuer, chaseTarget } from '../../src/services/pursuerService';
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

describe('createPursuer', () => {
  it('returns pursuer with given props and defaults', () => {
    const map = createFlatMap();
    const p = createPursuer('pu1', 10, 20, map);
    expect(p.id).toBe('pu1');
    expect(p.x).toBe(10);
    expect(p.y).toBe(20);
    expect(p.height).toBeCloseTo(ANIMAL_HEIGHT_OFFSET);
    expect(p.speed).toBe(5.0);
    expect(p.chaseSpeed).toBe(7.0);
    expect(p.directionX).toBe(1);
    expect(p.directionY).toBe(0);
    expect(p.rotationAngle).toBeCloseTo(Math.atan2(1, 0));
    expect(p.targetId).toBeNull();
  });

  it('accepts custom speed and chaseSpeed', () => {
    const map = createFlatMap();
    const p = createPursuer('pu1', 0, 0, map, 3.0, 9.0);
    expect(p.speed).toBe(3.0);
    expect(p.chaseSpeed).toBe(9.0);
  });

  it('initializes height from terrain height plus offset', () => {
    const map = createFlatMap();
    map.grid[0][0] = { ...map.grid[0][0], height: 5 };
    map.grid[0][1] = { ...map.grid[0][1], height: 5 };
    map.grid[1][0] = { ...map.grid[1][0], height: 5 };
    map.grid[1][1] = { ...map.grid[1][1], height: 5 };
    const p = createPursuer('pu1', -5, -5, map);
    expect(p.height).toBeCloseTo(5 + ANIMAL_HEIGHT_OFFSET);
  });
});

describe('chaseTarget', () => {
  it('returns pursuer unchanged (stub for future algorithm)', () => {
    const map = createFlatMap();
    const pursuer = createPursuer('dog', -5, -5, map);
    const result = chaseTarget(pursuer);
    expect(result).toBe(pursuer);
    expect(result.x).toBe(-5);
    expect(result.y).toBe(-5);
  });
});
