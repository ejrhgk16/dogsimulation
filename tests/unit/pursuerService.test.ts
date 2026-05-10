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

describe('chaseTarget', () => {
  it('moves pursuer toward target and updates direction and rotation', () => {
    const map = createWideFlatMap();
    const pursuer = createPursuer('dog', 0, 0, map, 5.0, 10.0);
    pursuer.targetId = 'target1';
    const result = chaseTarget(pursuer, 10, 0, 1, map);
    // direction should be toward (10,0) from (0,0): (1,0)
    expect(result.directionX).toBeCloseTo(1);
    expect(result.directionY).toBeCloseTo(0);
    expect(result.rotationAngle).toBeCloseTo(0);
    // should have moved using chaseSpeed (10) on flat map
    expect(result.x).toBeCloseTo(10, 0);
    expect(result.y).toBeCloseTo(0, 0);
    expect(result).toBe(pursuer);
  });

  it('returns pursuer unchanged when target is within 0.01 distance', () => {
    const map = createWideFlatMap();
    const pursuer = createPursuer('dog', -5, -5, map);
    const result = chaseTarget(pursuer, -5.005, -5, 1, map);
    expect(result).toBe(pursuer);
    expect(result.x).toBe(-5);
    expect(result.y).toBe(-5);
  });

  it('uses chaseSpeed when targetId is not null', () => {
    const map = createWideFlatMap();
    const pursuer = createPursuer('dog', 0, 0, map, 5.0, 20.0);
    pursuer.targetId = 'target1';
    const result = chaseTarget(pursuer, 25, 0, 1, map);
    // chaseSpeed=20, dx=1 → newX ≈ 20
    expect(result.x).toBeCloseTo(20, 0);
    expect(result.y).toBeCloseTo(0, 0);
  });

  it('uses base speed when targetId is null', () => {
    const map = createWideFlatMap();
    const pursuer = createPursuer('dog', 0, 0, map, 5.0, 20.0);
    const result = chaseTarget(pursuer, 10, 0, 1, map);
    // base speed=5, dx=1 → newX ≈ 5
    expect(result.x).toBeCloseTo(5, 0);
    expect(result.y).toBeCloseTo(0, 0);
  });

  it('moves diagonally toward target at (dx, dy)', () => {
    const map = createWideFlatMap();
    const pursuer = createPursuer('dog', 0, 0, map, 5.0, 10.0);
    pursuer.targetId = 'target1';
    const result = chaseTarget(pursuer, 10, 10, 1, map);
    const expectedDir = 1 / Math.SQRT2;
    expect(result.directionX).toBeCloseTo(expectedDir);
    expect(result.directionY).toBeCloseTo(expectedDir);
    expect(result.rotationAngle).toBeCloseTo(Math.PI / 4);
    // should have moved diagonally
    const expectedMove = 10 * expectedDir; // chaseSpeed=10, dt=1, flat map
    expect(result.x).toBeCloseTo(expectedMove, 0);
    expect(result.y).toBeCloseTo(expectedMove, 0);
  });

  it('stops when otherEntities block the path', () => {
    const map = createWideFlatMap();
    const pursuer = createPursuer('dog', 0, 0, map, 5.0, 5.0); // same speed = 5
    pursuer.targetId = 'target1';
    // Entity at (4.6, 0) blocks movement to (5, 0) since dist=0.4 < 1
    const result = chaseTarget(pursuer, 5, 0, 1, map, [{ x: 4.6, y: 0 }]);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });

  it('slides along clear axis when otherEntity blocks one axis', () => {
    const map = createWideFlatMap();
    const pursuer = createPursuer('dog', 0, 0, map, 5.0, 1.0); // chaseSpeed=1
    pursuer.targetId = 'target1';
    // Target at (1,1): direction=(1/√2,1/√2), speedScaled=1, combined=(0.707,0.707)
    // Entity at (0.6, 1.2): blocks y-only (dist=0.78<1), x-only clear (dist=1.21≥1)
    const result = chaseTarget(pursuer, 1, 1, 1, map, [{ x: 0.6, y: 1.2 }]);
    const expected = 1 / Math.SQRT2; // speed=1 * dt=1 * dx=1/√2
    expect(result.x).toBeCloseTo(expected);
    expect(result.y).toBeCloseTo(0);
  });

  it('moves normally with empty otherEntities', () => {
    const map = createWideFlatMap();
    const pursuer = createPursuer('dog', 0, 0, map, 5.0, 5.0);
    pursuer.targetId = 'target1';
    const result = chaseTarget(pursuer, 5, 0, 1, map, []);
    expect(result.x).toBeCloseTo(5, 0);
    expect(result.y).toBeCloseTo(0, 0);
  });

  // --- task-3 new tests below ---

  it('moves toward target (basic horizontal)', () => {
    const map = createWideFlatMap();
    const pursuer = createPursuer('dog', 0, 0, map, 5.0);
    const result = chaseTarget(pursuer, 3, 0, 1, map);
    expect(result.x).toBeGreaterThan(0);
    expect(result.y).toBeCloseTo(0);
  });

  it('stays in place when target is within 0.01 distance', () => {
    const map = createWideFlatMap();
    const pursuer = createPursuer('dog', 0, 0, map);
    const result = chaseTarget(pursuer, 0.001, 0, 1, map);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('stops before obstacle when chasing target', () => {
    const map = createWideFlatMap();
    // grid[2][3] covers x∈[5,15), z∈[-5,5) — blocks x+ movement from (0,0)
    map.grid[2][3] = { ...map.grid[2][3], terrain: 'obstacle' };
    const pursuer = createPursuer('dog', 0, 0, map, 5.0);
    const result = chaseTarget(pursuer, 1, 0, 1, map);
    // obstacle at tentativeX=5 blocks → stays at origin
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });

  it('uses chaseSpeed when targetId is set', () => {
    const map = createWideFlatMap();
    const pursuer = createPursuer('dog', 0, 0, map, 5.0, 7.0);
    pursuer.targetId = 't1';
    const result = chaseTarget(pursuer, 10, 0, 1, map);
    // chaseSpeed=7, dx=1, flat map → newX ≈ 7
    expect(result.x).toBeCloseTo(7, 0);
  });

  it('normalizes direction vector for diagonal target', () => {
    const map = createWideFlatMap();
    const pursuer = createPursuer('dog', 0, 0, map);
    const result = chaseTarget(pursuer, 3, 4, 1, map);
    // distance 5 → (3/5, 4/5) = (0.6, 0.8)
    expect(result.directionX).toBeCloseTo(0.6);
    expect(result.directionY).toBeCloseTo(0.8);
  });
});
