import { describe, it, expect } from 'vitest';
import { createAnimal, moveAnimal } from '../../src/services/animalService';
import { getHeightAt } from '../../src/services/mapService';
import type { MapData, MapCell } from '../../src/types/map';
import type { AnimalState } from '../../src/types/animal';
import { getAnimalSpeed, ANIMAL_HEIGHT_OFFSET } from '../../src/config/animalConfig';
import { HEIGHT_SPEED_FACTOR } from '../../src/config/animalConfig';

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

describe('moveAnimal — basic movement (no map obstacles)', () => {
  it('moves right on key d', () => {
    const map = createFlatMap();
    const animal = animalAt(-5, -5);
    moveAnimal(animal, new Set(['d']), 1, map);
    expect(animal.x).toBeCloseTo(-5 + getAnimalSpeed() * 1);
    expect(animal.y).toBeCloseTo(-5);
  });

  it('moves left on key a', () => {
    const map = createFlatMap();
    const animal = animalAt(5, -5);
    moveAnimal(animal, new Set(['a']), 1, map);
    expect(animal.x).toBeCloseTo(5 - getAnimalSpeed() * 1);
    expect(animal.y).toBeCloseTo(-5);
  });

  it('moves down on key s', () => {
    const map = createFlatMap();
    const animal = animalAt(-5, -5);
    moveAnimal(animal, new Set(['s']), 1, map);
    expect(animal.x).toBeCloseTo(-5);
    expect(animal.y).toBeCloseTo(-5 + getAnimalSpeed() * 1);
  });

  it('moves up on key w', () => {
    const map = createFlatMap();
    const animal = animalAt(-5, 5);
    moveAnimal(animal, new Set(['w']), 1, map);
    expect(animal.x).toBeCloseTo(-5);
    expect(animal.y).toBeCloseTo(5 - getAnimalSpeed() * 1);
  });

  it('normalizes diagonal movement', () => {
    const map = createFlatMap();
    const animal = animalAt(-5, -5);
    moveAnimal(animal, new Set(['d', 's']), 1, map);
    const len = Math.SQRT1_2;
    expect(animal.x).toBeCloseTo(-5 + len * getAnimalSpeed() * 1);
    expect(animal.y).toBeCloseTo(-5 + len * getAnimalSpeed() * 1);
  });

  it('does not move when no key pressed', () => {
    const map = createFlatMap();
    const animal = animalAt(-5, -5);
    moveAnimal(animal, new Set(), 1, map);
    expect(animal.x).toBeCloseTo(-5);
    expect(animal.y).toBeCloseTo(-5);
  });

  it('updates direction when moving', () => {
    const map = createFlatMap();
    const animal = animalAt(-5, -5);
    moveAnimal(animal, new Set(['a']), 1, map);
    expect(animal.directionX).toBeCloseTo(-1);
    expect(animal.directionY).toBeCloseTo(0);
  });

  it('does not change rotationAngle when direction changes', () => {
    const map = createFlatMap();
    const animal = animalAt(-5, -5);
    const initialAngle = animal.rotationAngle;
    moveAnimal(animal, new Set(['w']), 1, map);
    expect(animal.directionX).toBe(0);
    expect(animal.directionY).toBe(-1);
    expect(animal.rotationAngle).toBe(initialAngle);
  });
});

describe('moveAnimal — obstacle collision', () => {
  it('stops when moving into obstacle cell', () => {
    const map = createFlatMap();
    map.grid[0][1] = { ...map.grid[0][1], terrain: 'obstacle', height: 0 };
    const animal = animalAt(-5, -5); // grid[0][0]
    moveAnimal(animal, new Set(['d']), 1, map);
    // newX=0 would be grid[0][1] obstacle → blocked
    expect(animal.x).toBeCloseTo(-5);
    expect(animal.y).toBeCloseTo(-5);
  });

  it('slides along y-axis when x is blocked (diagonal)', () => {
    const map = createFlatMap();
    // grid[0][1]=obstacle → x-check fails, grid[1][0]=flat → y-check passes
    map.grid[0][1] = { ...map.grid[0][1], terrain: 'obstacle', height: 0 };
    map.grid[1][1] = { ...map.grid[1][1], terrain: 'obstacle', height: 0 };
    // grid[1][0] stays flat
    const animal = animalAt(-5, -5);
    const dt = 2; // speed = 10, so new pos hits grid[1][1] obstacle
    moveAnimal(animal, new Set(['s', 'd']), dt, map);
    // x blocked → only y movement
    const len = Math.SQRT1_2;
    expect(animal.x).toBeCloseTo(-5);
    expect(animal.y).toBeCloseTo(-5 + len * getAnimalSpeed() * dt);
  });

  it('slides along x-axis when y is blocked (diagonal)', () => {
    const map = createFlatMap();
    map.grid[1][0] = { ...map.grid[1][0], terrain: 'obstacle', height: 0 };
    map.grid[1][1] = { ...map.grid[1][1], terrain: 'obstacle', height: 0 };
    const animal = animalAt(-5, -5);
    const dt = 2;
    moveAnimal(animal, new Set(['s', 'd']), dt, map);
    const len = Math.SQRT1_2;
    expect(animal.x).toBeCloseTo(-5 + len * getAnimalSpeed() * dt);
    expect(animal.y).toBeCloseTo(-5);
  });

  it('slides along x when diagonal cell is obstacle but both axes individually clear', () => {
    const map = createFlatMap();
    // grid[1][1] is obstacle, grid[0][1] and grid[1][0] stay flat
    map.grid[1][1] = { ...map.grid[1][1], terrain: 'obstacle', height: 0 };
    const animal = animalAt(-5, -5, map);
    const dt = 2;
    moveAnimal(animal, new Set(['s', 'd']), dt, map);
    const len = Math.SQRT1_2;
    expect(animal.x).toBeCloseTo(-5 + len * getAnimalSpeed() * dt);
    expect(animal.y).toBeCloseTo(-5);
  });

  it('stops when both axes blocked', () => {
    const map = createFlatMap();
    map.grid[0][1] = { ...map.grid[0][1], terrain: 'obstacle', height: 0 };
    map.grid[1][0] = { ...map.grid[1][0], terrain: 'obstacle', height: 0 };
    map.grid[1][1] = { ...map.grid[1][1], terrain: 'obstacle', height: 0 };
    const animal = animalAt(-5, -5);
    const dt = 2;
    moveAnimal(animal, new Set(['s', 'd']), dt, map);
    expect(animal.x).toBeCloseTo(-5);
    expect(animal.y).toBeCloseTo(-5);
  });
});

describe('moveAnimal — map boundary as wall', () => {
  it('stops when moving beyond left edge', () => {
    const map = createFlatMap();
    const animal = animalAt(-5, -5);
    // dt=2 → speed=10 → newX=-15, out of bounds → obstacle
    moveAnimal(animal, new Set(['a']), 2, map);
    expect(animal.x).toBeCloseTo(-5);
    expect(animal.y).toBeCloseTo(-5);
  });

  it('stops when moving beyond right edge', () => {
    const map = createFlatMap();
    const animal = animalAt(5, -5);
    // dt=2 → speed=10 → newX=15, out of bounds → obstacle
    moveAnimal(animal, new Set(['d']), 2, map);
    expect(animal.x).toBeCloseTo(5);
    expect(animal.y).toBeCloseTo(-5);
  });
});

describe('moveAnimal — height speed adjustment', () => {
  it('moves at full speed when height diff is 0 (flat)', () => {
    const map = createFlatMap();
    const animal = animalAt(-5, -5);
    moveAnimal(animal, new Set(['d']), 1, map);
    expect(animal.x).toBeCloseTo(-5 + getAnimalSpeed() * 1);
    expect(animal.y).toBeCloseTo(-5);
  });

  it('reduces speed when moving to a higher cell', () => {
    const map = createFlatMap();
    // All cells flat except grid[0][1] at height 8 → produces clear height diff
    map.grid[0][1] = { ...map.grid[0][1], height: 8, terrain: 'hill' };
    const animal = animalAt(-5, -5);
    moveAnimal(animal, new Set(['d']), 1, map);
    const startH = getHeightAt(map, -5, -5);
    const targetH = getHeightAt(map, 0, -5);
    const heightDiff = Math.abs(targetH - startH);
    const factor = Math.max(0.2, 1 - heightDiff * HEIGHT_SPEED_FACTOR);
    expect(animal.x).toBeCloseTo(-5 + getAnimalSpeed() * 1 * factor);
    expect(animal.y).toBeCloseTo(-5);
  });

  it('caps speed reduction at 0.2 for very large height diff', () => {
    const map = createFlatMap();
    // Large height ensures factor reaches the 0.2 cap
    map.grid[0][1] = { ...map.grid[0][1], height: 100, terrain: 'hill' };
    const animal = animalAt(-5, -5);
    moveAnimal(animal, new Set(['d']), 1, map);
    const startH = getHeightAt(map, -5, -5);
    const targetH = getHeightAt(map, 0, -5);
    const heightDiff = Math.abs(targetH - startH);
    const factor = Math.max(0.2, 1 - heightDiff * HEIGHT_SPEED_FACTOR);
    expect(factor).toBe(0.2);
    expect(animal.x).toBeCloseTo(-5 + getAnimalSpeed() * 1 * 0.2);
    expect(animal.y).toBeCloseTo(-5);
  });

  it('updates height after moving to a cell with different elevation', () => {
    const map = createFlatMap();
    // Set all cells around start to height 0 so that getHeightAt(-1,-5) ≈ 0
    map.grid[0][0] = { ...map.grid[0][0], height: 0, terrain: 'flat' };
    map.grid[0][1] = { ...map.grid[0][1], height: 4, terrain: 'hill' };
    const startH = getHeightAt(map, -1, -5);
    const animal = createAnimal('test', 'dog', -1, -5, map);
    expect(animal.height).toBeCloseTo(startH + ANIMAL_HEIGHT_OFFSET);
    moveAnimal(animal, new Set(['d']), 2, map);
    const targetH = getHeightAt(map, animal.x, animal.y);
    expect(animal.height).toBeCloseTo(targetH + ANIMAL_HEIGHT_OFFSET);
    expect(animal.x).toBeGreaterThanOrEqual(0);
  });

  it('reduces speed for downhill movement using absolute height diff', () => {
    const map = createFlatMap();
    map.grid[0][0] = { ...map.grid[0][0], height: 2, terrain: 'hill' };
    map.grid[0][1] = { ...map.grid[0][1], height: 1, terrain: 'flat' };
    const animal = createAnimal('test', 'dog', -5, -5, map);
    const startH = getHeightAt(map, -5, -5);
    expect(animal.height).toBeCloseTo(startH + ANIMAL_HEIGHT_OFFSET);
    // Compute expected before move (moveAnimal uses target position without height factor for heightDiff)
    const targetX = -5 + getAnimalSpeed() * 2; // speed = getAnimalSpeed() * dt = 5 * 2 = 10, dx=1
    const targetY = -5; // dy=0
    const targetH = getHeightAt(map, targetX, targetY);
    const heightDiff = Math.abs(targetH - startH);
    const factor = Math.max(0.2, 1 - heightDiff * HEIGHT_SPEED_FACTOR);
    moveAnimal(animal, new Set(['d']), 2, map);
    expect(animal.x).toBeCloseTo(-5 + getAnimalSpeed() * 2 * factor);
    expect(animal.y).toBeCloseTo(-5);
    expect(animal.height).toBeCloseTo(getHeightAt(map, animal.x, animal.y) + ANIMAL_HEIGHT_OFFSET);
  });

  it('applies height factor after obstacle sliding', () => {
    const map = createFlatMap();
    // x blocked by obstacle, y goes to hill
    map.grid[0][1] = { ...map.grid[0][1], terrain: 'obstacle', height: 0 };
    map.grid[1][1] = { ...map.grid[1][1], terrain: 'obstacle', height: 0 };
    map.grid[1][0] = { ...map.grid[1][0], height: 3, terrain: 'hill' };
    const animal = animalAt(-5, -5);
    const dt = 2;
    moveAnimal(animal, new Set(['s', 'd']), dt, map);
    const len = Math.SQRT1_2;
    const startH = getHeightAt(map, -5, -5);
    const targetH = getHeightAt(map, -5, -5 + len * getAnimalSpeed() * dt);
    const heightDiff = Math.abs(targetH - startH);
    const factor = Math.max(0.2, 1 - heightDiff * HEIGHT_SPEED_FACTOR);
    // Only y movement, reduced by height factor
    expect(animal.x).toBeCloseTo(-5);
    expect(animal.y).toBeCloseTo(-5 + len * getAnimalSpeed() * dt * factor);
  });
});
