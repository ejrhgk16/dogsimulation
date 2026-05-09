import { describe, it, expect } from 'vitest';
import { createAnimal, moveAnimal } from '../../src/services/animalService';
import type { MapData, MapCell } from '../../src/types/map';
import type { AnimalState } from '../../src/types/animal';
import { ANIMAL_HEIGHT_OFFSET } from '../../src/config/animalConfig';

/**
 * Helper: 2×2 map, cellSize=10.
 * grid[0][0]: x∈[-10,0), z∈[-10,0)
 * grid[0][1]: x∈[0,10),  z∈[-10,0)
 * grid[1][0]: x∈[-10,0), z∈[0,10)
 * grid[1][1]: x∈[0,10),  z∈[0,10)
 */
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

function animalAt(x: number, y: number, mapData?: MapData): AnimalState {
  const map = mapData ?? createFlatMap();
  return createAnimal('test', 'dog', x, y, map);
}

describe('createAnimal', () => {
  it('returns animal with given props and default direction', () => {
    const map = createFlatMap();
    const a = createAnimal('a1', 'cow', 10, 20, map);
    expect(a.id).toBe('a1');
    expect(a.animalType).toBe('cow');
    expect(a.x).toBe(10);
    expect(a.y).toBe(20);
    expect(a.height).toBeCloseTo(ANIMAL_HEIGHT_OFFSET);
    expect(a.directionX).toBe(1);
    expect(a.directionY).toBe(0);
  });

  it('initializes rotationAngle from initial direction (1,0)', () => {
    const map = createFlatMap();
    const a = createAnimal('a1', 'dog', 0, 0, map);
    expect(a.rotationAngle).toBeCloseTo(Math.atan2(1, 0));
  });

  it('initializes height from terrain height plus offset', () => {
    const map = createFlatMap();
    // Set all 4 cells to same height so bilinear interpolation is uniform
    map.grid[0][0] = { ...map.grid[0][0], height: 3 };
    map.grid[0][1] = { ...map.grid[0][1], height: 3 };
    map.grid[1][0] = { ...map.grid[1][0], height: 3 };
    map.grid[1][1] = { ...map.grid[1][1], height: 3 };
    const a = createAnimal('test', 'dog', -5, -5, map);
    expect(a.height).toBeCloseTo(3 + ANIMAL_HEIGHT_OFFSET);
  });
});

describe('moveAnimal — keyboard-driven movement', () => {
  it('moves right on ArrowRight', () => {
    const map = createFlatMap();
    const animal = animalAt(-5, -5);
    moveAnimal(animal, new Set(['ArrowRight']), 1, map);
    expect(animal.x).toBeCloseTo(0);
    expect(animal.y).toBeCloseTo(-5);
    expect(animal.directionX).toBe(1);
    expect(animal.directionY).toBe(0);
  });

  it('moves left on ArrowLeft', () => {
    const map = createFlatMap();
    const animal = animalAt(-5, -5);
    moveAnimal(animal, new Set(['ArrowLeft']), 0.5, map);
    expect(animal.x).toBeCloseTo(-7.5);
    expect(animal.y).toBeCloseTo(-5);
    expect(animal.directionX).toBe(-1);
    expect(animal.directionY).toBe(0);
  });

  it('moves up on ArrowUp, rotationAngle unchanged', () => {
    const map = createFlatMap();
    const animal = animalAt(-5, -5);
    const initialAngle = animal.rotationAngle;
    moveAnimal(animal, new Set(['ArrowUp']), 0.5, map);
    expect(animal.x).toBeCloseTo(-5);
    expect(animal.y).toBeCloseTo(-7.5);
    expect(animal.directionX).toBe(0);
    expect(animal.directionY).toBe(-1);
    expect(animal.rotationAngle).toBe(initialAngle);
  });

  it('does not move when no key pressed', () => {
    const map = createFlatMap();
    const animal = animalAt(-5, -5);
    moveAnimal(animal, new Set(), 1, map);
    expect(animal.x).toBeCloseTo(-5);
    expect(animal.y).toBeCloseTo(-5);
    expect(animal.directionX).toBe(0);
    expect(animal.directionY).toBe(0);
  });

  it('supports arrow keys (ArrowRight)', () => {
    const map = createFlatMap();
    const animal = animalAt(-5, -5);
    moveAnimal(animal, new Set(['ArrowRight']), 1, map);
    expect(animal.x).toBeCloseTo(0);
    expect(animal.y).toBeCloseTo(-5);
    expect(animal.directionX).toBe(1);
    expect(animal.directionY).toBe(0);
  });

  it('supports arrow keys (ArrowDown + ArrowLeft)', () => {
    const map = createFlatMap();
    const animal = animalAt(-5, -5);
    moveAnimal(animal, new Set(['ArrowDown', 'ArrowLeft']), 1, map);
    const expectedDx = -1 / Math.SQRT2;
    const expectedDy = 1 / Math.SQRT2;
    expect(animal.directionX).toBeCloseTo(expectedDx);
    expect(animal.directionY).toBeCloseTo(expectedDy);
    expect(animal.x).toBeGreaterThan(-9);
    expect(animal.x).toBeLessThan(-7);
    expect(animal.y).toBeGreaterThan(-2);
    expect(animal.y).toBeLessThan(0);
  });
});

describe('moveAnimal — obstacle collision', () => {
  it('stays in place when moving into obstacle (x-axis blocked)', () => {
    const map = createFlatMap();
    map.grid[0][1] = { ...map.grid[0][1], terrain: 'obstacle', height: 0 };
    const animal = animalAt(-5, -5);
    moveAnimal(animal, new Set(['ArrowRight']), 1, map);
    expect(animal.x).toBeCloseTo(-5);
    expect(animal.y).toBeCloseTo(-5);
    expect(animal.directionX).toBe(1);
    expect(animal.directionY).toBe(0);
  });

  it('slides along clear axis when diagonal partially blocked', () => {
    const map = createFlatMap();
    map.grid[0][1] = { ...map.grid[0][1], terrain: 'obstacle', height: 0 };
    map.grid[1][1] = { ...map.grid[1][1], terrain: 'obstacle', height: 0 };
    const animal = animalAt(-5, -5);
    const dt = 2;
    moveAnimal(animal, new Set(['ArrowDown', 'ArrowRight']), dt, map);
    // x blocked (grid[0][1] obstacle), y clear (grid[1][0] flat) → slides down
    expect(animal.x).toBeCloseTo(-5);
    expect(animal.y).toBeGreaterThan(0);
    expect(animal.directionX).toBeCloseTo(1 / Math.SQRT2);
    expect(animal.directionY).toBeCloseTo(1 / Math.SQRT2);
  });

  it('stays in place when both axes blocked', () => {
    const map = createFlatMap();
    map.grid[0][1] = { ...map.grid[0][1], terrain: 'obstacle', height: 0 };
    map.grid[1][0] = { ...map.grid[1][0], terrain: 'obstacle', height: 0 };
    map.grid[1][1] = { ...map.grid[1][1], terrain: 'obstacle', height: 0 };
    const animal = animalAt(-5, -5);
    const dt = 2;
    moveAnimal(animal, new Set(['ArrowDown', 'ArrowRight']), dt, map);
    expect(animal.x).toBeCloseTo(-5);
    expect(animal.y).toBeCloseTo(-5);
  });
});

describe('moveAnimal — boundary collision', () => {
  it('stays in place when moving out of bounds', () => {
    const map = createFlatMap();
    const animal = animalAt(-5, -5);
    moveAnimal(animal, new Set(['ArrowLeft']), 2, map);
    expect(animal.x).toBeCloseTo(-5);
    expect(animal.y).toBeCloseTo(-5);
    expect(animal.directionX).toBe(-1);
    expect(animal.directionY).toBe(0);
  });
});

describe('moveAnimal — height effects on movement', () => {
  it('moves slower uphill on flat terrain (no height diff)', () => {
    const map = createFlatMap();
    const animal = animalAt(-5, -5);
    moveAnimal(animal, new Set(['ArrowRight']), 1, map);
    expect(animal.x).toBeCloseTo(0);
    expect(animal.y).toBeCloseTo(-5);
  });

  it('moves slower when height diff is large', () => {
    const map = createFlatMap();
    map.grid[0][1] = { ...map.grid[0][1], height: 8, terrain: 'hill' };
    const animal = animalAt(-5, -5);
    moveAnimal(animal, new Set(['ArrowRight']), 1, map);
    // Height diff between hill cell and start reduces speed factor
    expect(animal.x).toBeGreaterThan(-5);
    expect(animal.x).toBeLessThan(0);
    expect(animal.y).toBeCloseTo(-5);
  });

  it('height changes when moving onto hill', () => {
    const map = createFlatMap();
    map.grid[0][0] = { ...map.grid[0][0], height: 0, terrain: 'flat' };
    map.grid[0][1] = { ...map.grid[0][1], height: 4, terrain: 'hill' };
    const animal = createAnimal('test', 'dog', -1, -5, map);
    const origHeight = animal.height;
    moveAnimal(animal, new Set(['ArrowRight']), 2, map);
    expect(animal.height).not.toBe(origHeight);
    expect(animal.x).toBeGreaterThan(-1);
  });
});
