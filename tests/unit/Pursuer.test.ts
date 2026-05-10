import { describe, it, expect } from 'vitest';
import { Pursuer } from '../../src/services/Pursuer';
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

function createWideFlatMap(): MapData {
  const cellSize = 10;
  const size = 5;
  const grid: MapCell[][] = [];
  for (let row = 0; row < size; row++) {
    const rowCells: MapCell[] = [];
    for (let col = 0; col < size; col++) {
      rowCells.push({ x: col * cellSize, z: row * cellSize, height: 0, terrain: 'flat' });
    }
    grid.push(rowCells);
  }
  return { grid, cellSize, width: size, depth: size };
}

describe('Pursuer constructor', () => {
  it('creates Pursuer with given id, position and defaults', () => {
    const map = createFlatMap();
    const p = new Pursuer('pu1', 10, 20, map);
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
    const p = new Pursuer('pu1', 0, 0, map, 3.0, 9.0);
    expect(p.speed).toBe(3.0);
    expect(p.chaseSpeed).toBe(9.0);
  });

  it('initializes height from terrain height plus offset', () => {
    const map = createFlatMap();
    map.grid[0][0] = { ...map.grid[0][0], height: 5 };
    map.grid[0][1] = { ...map.grid[0][1], height: 5 };
    map.grid[1][0] = { ...map.grid[1][0], height: 5 };
    map.grid[1][1] = { ...map.grid[1][1], height: 5 };
    const p = new Pursuer('pu1', -5, -5, map);
    expect(p.height).toBeCloseTo(5 + ANIMAL_HEIGHT_OFFSET);
  });
});

describe('Pursuer.chase', () => {
  it('moves pursuer toward target and updates direction and rotation', () => {
    const map = createWideFlatMap();
    const p = new Pursuer('dog', 0, 0, map, 5.0, 10.0);
    p.targetId = 'target1';
    p.chase({ x: 10, y: 0 }, 1, map);
    expect(p.directionX).toBeCloseTo(1);
    expect(p.directionY).toBeCloseTo(0);
    expect(p.rotationAngle).toBeCloseTo(0);
    expect(p.x).toBeCloseTo(10, 0);
    expect(p.y).toBeCloseTo(0, 0);
  });

  it('stays in place when target is within 0.01 distance', () => {
    const map = createWideFlatMap();
    const p = new Pursuer('dog', 0, 0, map);
    p.targetId = 'target1';
    p.chase({ x: 0.001, y: 0 }, 1, map);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });

  it('uses chaseSpeed when targetId is not null', () => {
    const map = createWideFlatMap();
    const p = new Pursuer('dog', 0, 0, map, 5.0, 20.0);
    p.targetId = 'target1';
    p.chase({ x: 25, y: 0 }, 1, map);
    expect(p.x).toBeCloseTo(20, 0);
    expect(p.y).toBeCloseTo(0, 0);
  });

  it('uses base speed when targetId is null', () => {
    const map = createWideFlatMap();
    const p = new Pursuer('dog', 0, 0, map, 5.0, 20.0);
    p.chase({ x: 10, y: 0 }, 1, map);
    expect(p.x).toBeCloseTo(5, 0);
    expect(p.y).toBeCloseTo(0, 0);
  });

  it('moves diagonally toward target at (dx, dy)', () => {
    const map = createWideFlatMap();
    const p = new Pursuer('dog', 0, 0, map, 5.0, 10.0);
    p.targetId = 'target1';
    p.chase({ x: 10, y: 10 }, 1, map);
    const expectedDir = 1 / Math.SQRT2;
    expect(p.directionX).toBeCloseTo(expectedDir);
    expect(p.directionY).toBeCloseTo(expectedDir);
    expect(p.rotationAngle).toBeCloseTo(Math.PI / 4);
    const expectedMove = 10 * expectedDir;
    expect(p.x).toBeCloseTo(expectedMove, 0);
    expect(p.y).toBeCloseTo(expectedMove, 0);
  });

  it('stops when otherEntities block the path', () => {
    const map = createWideFlatMap();
    const p = new Pursuer('dog', 0, 0, map, 5.0, 5.0);
    p.targetId = 'target1';
    p.chase({ x: 5, y: 0 }, 1, map, [{ x: 4.6, y: 0 }]);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('slides along clear axis when otherEntity blocks one axis', () => {
    const map = createWideFlatMap();
    const p = new Pursuer('dog', 0, 0, map, 5.0, 1.0);
    p.targetId = 'target1';
    p.chase({ x: 1, y: 1 }, 1, map, [{ x: 0.6, y: 1.2 }]);
    const expected = 1 / Math.SQRT2;
    expect(p.x).toBeCloseTo(expected);
    expect(p.y).toBeCloseTo(0);
  });

  it('moves normally with empty otherEntities', () => {
    const map = createWideFlatMap();
    const p = new Pursuer('dog', 0, 0, map, 5.0, 5.0);
    p.targetId = 'target1';
    p.chase({ x: 5, y: 0 }, 1, map, []);
    expect(p.x).toBeCloseTo(5, 0);
    expect(p.y).toBeCloseTo(0, 0);
  });

  it('stops before obstacle', () => {
    const map = createWideFlatMap();
    map.grid[2][3] = { ...map.grid[2][3], terrain: 'obstacle' };
    const p = new Pursuer('dog', 0, 0, map, 5.0);
    p.chase({ x: 1, y: 0 }, 1, map);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('normalizes direction vector for diagonal target', () => {
    const map = createWideFlatMap();
    const p = new Pursuer('dog', 0, 0, map);
    p.chase({ x: 3, y: 4 }, 1, map);
    expect(p.directionX).toBeCloseTo(0.6);
    expect(p.directionY).toBeCloseTo(0.8);
  });
});
