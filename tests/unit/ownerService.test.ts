import { describe, it, expect } from 'vitest';
import { createOwner, moveOwner } from '../../src/services/ownerService';
import { getHeightAt } from '../../src/services/mapService';
import type { MapData, MapCell } from '../../src/types/map';
import type { OwnerState } from '../../src/types/owner';
import { OWNER_SPEED, OWNER_HEIGHT_OFFSET } from '../../src/config/ownerConfig';
import { HEIGHT_SPEED_FACTOR } from '../../src/config/ownerConfig';

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

function ownerAt(x: number, y: number, mapData?: MapData): OwnerState {
  const map = mapData ?? createFlatMap();
  return createOwner('test', 'dog', x, y, map);
}

describe('createOwner', () => {
  it('returns owner with given props and default direction', () => {
    const map = createFlatMap();
    const o = createOwner('o1', 'cow', 10, 20, map);
    expect(o.id).toBe('o1');
    expect(o.ownerType).toBe('cow');
    expect(o.x).toBe(10);
    expect(o.y).toBe(20);
    expect(o.height).toBeCloseTo(OWNER_HEIGHT_OFFSET);
    expect(o.directionX).toBe(1);
    expect(o.directionY).toBe(0);
  });

  it('initializes height from terrain height plus offset', () => {
    const map = createFlatMap();
    // Set all 4 cells to same height so bilinear interpolation is uniform
    map.grid[0][0] = { ...map.grid[0][0], height: 3 };
    map.grid[0][1] = { ...map.grid[0][1], height: 3 };
    map.grid[1][0] = { ...map.grid[1][0], height: 3 };
    map.grid[1][1] = { ...map.grid[1][1], height: 3 };
    const o = createOwner('test', 'dog', -5, -5, map);
    expect(o.height).toBeCloseTo(3 + OWNER_HEIGHT_OFFSET);
  });
});

describe('moveOwner — basic movement (no map obstacles)', () => {
  it('moves right on key d', () => {
    const map = createFlatMap();
    const owner = ownerAt(-5, -5);
    moveOwner(owner, new Set(['d']), 1, map);
    expect(owner.x).toBeCloseTo(-5 + OWNER_SPEED * 1);
    expect(owner.y).toBeCloseTo(-5);
  });

  it('moves left on key a', () => {
    const map = createFlatMap();
    const owner = ownerAt(5, -5);
    moveOwner(owner, new Set(['a']), 1, map);
    expect(owner.x).toBeCloseTo(5 - OWNER_SPEED * 1);
    expect(owner.y).toBeCloseTo(-5);
  });

  it('moves down on key s', () => {
    const map = createFlatMap();
    const owner = ownerAt(-5, -5);
    moveOwner(owner, new Set(['s']), 1, map);
    expect(owner.x).toBeCloseTo(-5);
    expect(owner.y).toBeCloseTo(-5 + OWNER_SPEED * 1);
  });

  it('moves up on key w', () => {
    const map = createFlatMap();
    const owner = ownerAt(-5, 5);
    moveOwner(owner, new Set(['w']), 1, map);
    expect(owner.x).toBeCloseTo(-5);
    expect(owner.y).toBeCloseTo(5 - OWNER_SPEED * 1);
  });

  it('normalizes diagonal movement', () => {
    const map = createFlatMap();
    const owner = ownerAt(-5, -5);
    moveOwner(owner, new Set(['d', 's']), 1, map);
    const len = Math.SQRT1_2;
    expect(owner.x).toBeCloseTo(-5 + len * OWNER_SPEED * 1);
    expect(owner.y).toBeCloseTo(-5 + len * OWNER_SPEED * 1);
  });

  it('does not move when no key pressed', () => {
    const map = createFlatMap();
    const owner = ownerAt(-5, -5);
    moveOwner(owner, new Set(), 1, map);
    expect(owner.x).toBeCloseTo(-5);
    expect(owner.y).toBeCloseTo(-5);
  });

  it('updates direction when moving', () => {
    const map = createFlatMap();
    const owner = ownerAt(-5, -5);
    moveOwner(owner, new Set(['a']), 1, map);
    expect(owner.directionX).toBeCloseTo(-1);
    expect(owner.directionY).toBeCloseTo(0);
  });
});

describe('moveOwner — obstacle collision', () => {
  it('stops when moving into obstacle cell', () => {
    const map = createFlatMap();
    map.grid[0][1] = { ...map.grid[0][1], terrain: 'obstacle', height: 0 };
    const owner = ownerAt(-5, -5); // grid[0][0]
    moveOwner(owner, new Set(['d']), 1, map);
    // newX=0 would be grid[0][1] obstacle → blocked
    expect(owner.x).toBeCloseTo(-5);
    expect(owner.y).toBeCloseTo(-5);
  });

  it('slides along y-axis when x is blocked (diagonal)', () => {
    const map = createFlatMap();
    // grid[0][1]=obstacle → x-check fails, grid[1][0]=flat → y-check passes
    map.grid[0][1] = { ...map.grid[0][1], terrain: 'obstacle', height: 0 };
    map.grid[1][1] = { ...map.grid[1][1], terrain: 'obstacle', height: 0 };
    // grid[1][0] stays flat
    const owner = ownerAt(-5, -5);
    const dt = 2; // speed = 10, so new pos hits grid[1][1] obstacle
    moveOwner(owner, new Set(['s', 'd']), dt, map);
    // x blocked → only y movement
    const len = Math.SQRT1_2;
    expect(owner.x).toBeCloseTo(-5);
    expect(owner.y).toBeCloseTo(-5 + len * OWNER_SPEED * dt);
  });

  it('slides along x-axis when y is blocked (diagonal)', () => {
    const map = createFlatMap();
    map.grid[1][0] = { ...map.grid[1][0], terrain: 'obstacle', height: 0 };
    map.grid[1][1] = { ...map.grid[1][1], terrain: 'obstacle', height: 0 };
    const owner = ownerAt(-5, -5);
    const dt = 2;
    moveOwner(owner, new Set(['s', 'd']), dt, map);
    const len = Math.SQRT1_2;
    expect(owner.x).toBeCloseTo(-5 + len * OWNER_SPEED * dt);
    expect(owner.y).toBeCloseTo(-5);
  });

  it('slides along x when diagonal cell is obstacle but both axes individually clear', () => {
    const map = createFlatMap();
    // grid[1][1] is obstacle, grid[0][1] and grid[1][0] stay flat
    map.grid[1][1] = { ...map.grid[1][1], terrain: 'obstacle', height: 0 };
    const owner = ownerAt(-5, -5, map);
    const dt = 2;
    moveOwner(owner, new Set(['s', 'd']), dt, map);
    const len = Math.SQRT1_2;
    expect(owner.x).toBeCloseTo(-5 + len * OWNER_SPEED * dt);
    expect(owner.y).toBeCloseTo(-5);
  });

  it('stops when both axes blocked', () => {
    const map = createFlatMap();
    map.grid[0][1] = { ...map.grid[0][1], terrain: 'obstacle', height: 0 };
    map.grid[1][0] = { ...map.grid[1][0], terrain: 'obstacle', height: 0 };
    map.grid[1][1] = { ...map.grid[1][1], terrain: 'obstacle', height: 0 };
    const owner = ownerAt(-5, -5);
    const dt = 2;
    moveOwner(owner, new Set(['s', 'd']), dt, map);
    expect(owner.x).toBeCloseTo(-5);
    expect(owner.y).toBeCloseTo(-5);
  });
});

describe('moveOwner — map boundary as wall', () => {
  it('stops when moving beyond left edge', () => {
    const map = createFlatMap();
    const owner = ownerAt(-5, -5);
    // dt=2 → speed=10 → newX=-15, out of bounds → obstacle
    moveOwner(owner, new Set(['a']), 2, map);
    expect(owner.x).toBeCloseTo(-5);
    expect(owner.y).toBeCloseTo(-5);
  });

  it('stops when moving beyond right edge', () => {
    const map = createFlatMap();
    const owner = ownerAt(5, -5);
    // dt=2 → speed=10 → newX=15, out of bounds → obstacle
    moveOwner(owner, new Set(['d']), 2, map);
    expect(owner.x).toBeCloseTo(5);
    expect(owner.y).toBeCloseTo(-5);
  });
});

describe('moveOwner — height speed adjustment', () => {
  it('moves at full speed when height diff is 0 (flat)', () => {
    const map = createFlatMap();
    const owner = ownerAt(-5, -5);
    moveOwner(owner, new Set(['d']), 1, map);
    expect(owner.x).toBeCloseTo(-5 + OWNER_SPEED * 1);
    expect(owner.y).toBeCloseTo(-5);
  });

  it('reduces speed when moving to a higher cell', () => {
    const map = createFlatMap();
    // All cells flat except grid[0][1] at height 8 → produces clear height diff
    map.grid[0][1] = { ...map.grid[0][1], height: 8, terrain: 'hill' };
    const owner = ownerAt(-5, -5);
    moveOwner(owner, new Set(['d']), 1, map);
    const startH = getHeightAt(map, -5, -5);
    const targetH = getHeightAt(map, 0, -5);
    const heightDiff = Math.abs(targetH - startH);
    const factor = Math.max(0.2, 1 - heightDiff * HEIGHT_SPEED_FACTOR);
    expect(owner.x).toBeCloseTo(-5 + OWNER_SPEED * 1 * factor);
    expect(owner.y).toBeCloseTo(-5);
  });

  it('caps speed reduction at 0.2 for very large height diff', () => {
    const map = createFlatMap();
    // Large height ensures factor reaches the 0.2 cap
    map.grid[0][1] = { ...map.grid[0][1], height: 100, terrain: 'hill' };
    const owner = ownerAt(-5, -5);
    moveOwner(owner, new Set(['d']), 1, map);
    const startH = getHeightAt(map, -5, -5);
    const targetH = getHeightAt(map, 0, -5);
    const heightDiff = Math.abs(targetH - startH);
    const factor = Math.max(0.2, 1 - heightDiff * HEIGHT_SPEED_FACTOR);
    expect(factor).toBe(0.2);
    expect(owner.x).toBeCloseTo(-5 + OWNER_SPEED * 1 * 0.2);
    expect(owner.y).toBeCloseTo(-5);
  });

  it('updates height after moving to a cell with different elevation', () => {
    const map = createFlatMap();
    // Set all cells around start to height 0 so that getHeightAt(-1,-5) ≈ 0
    map.grid[0][0] = { ...map.grid[0][0], height: 0, terrain: 'flat' };
    map.grid[0][1] = { ...map.grid[0][1], height: 4, terrain: 'hill' };
    const startH = getHeightAt(map, -1, -5);
    const owner = createOwner('test', 'dog', -1, -5, map);
    expect(owner.height).toBeCloseTo(startH + OWNER_HEIGHT_OFFSET);
    moveOwner(owner, new Set(['d']), 2, map);
    const targetH = getHeightAt(map, owner.x, owner.y);
    expect(owner.height).toBeCloseTo(targetH + OWNER_HEIGHT_OFFSET);
    expect(owner.x).toBeGreaterThanOrEqual(0);
  });

  it('reduces speed for downhill movement using absolute height diff', () => {
    const map = createFlatMap();
    map.grid[0][0] = { ...map.grid[0][0], height: 2, terrain: 'hill' };
    map.grid[0][1] = { ...map.grid[0][1], height: 1, terrain: 'flat' };
    const owner = createOwner('test', 'dog', -5, -5, map);
    const startH = getHeightAt(map, -5, -5);
    expect(owner.height).toBeCloseTo(startH + OWNER_HEIGHT_OFFSET);
    // Compute expected before move (moveOwner uses target position without height factor for heightDiff)
    const targetX = -5 + OWNER_SPEED * 2; // speed = OWNER_SPEED * dt = 5 * 2 = 10, dx=1
    const targetY = -5; // dy=0
    const targetH = getHeightAt(map, targetX, targetY);
    const heightDiff = Math.abs(targetH - startH);
    const factor = Math.max(0.2, 1 - heightDiff * HEIGHT_SPEED_FACTOR);
    moveOwner(owner, new Set(['d']), 2, map);
    expect(owner.x).toBeCloseTo(-5 + OWNER_SPEED * 2 * factor);
    expect(owner.y).toBeCloseTo(-5);
    expect(owner.height).toBeCloseTo(getHeightAt(map, owner.x, owner.y) + OWNER_HEIGHT_OFFSET);
  });

  it('applies height factor after obstacle sliding', () => {
    const map = createFlatMap();
    // x blocked by obstacle, y goes to hill
    map.grid[0][1] = { ...map.grid[0][1], terrain: 'obstacle', height: 0 };
    map.grid[1][1] = { ...map.grid[1][1], terrain: 'obstacle', height: 0 };
    map.grid[1][0] = { ...map.grid[1][0], height: 3, terrain: 'hill' };
    const owner = ownerAt(-5, -5);
    const dt = 2;
    moveOwner(owner, new Set(['s', 'd']), dt, map);
    const len = Math.SQRT1_2;
    const startH = getHeightAt(map, -5, -5);
    const targetH = getHeightAt(map, -5, -5 + len * OWNER_SPEED * dt);
    const heightDiff = Math.abs(targetH - startH);
    const factor = Math.max(0.2, 1 - heightDiff * HEIGHT_SPEED_FACTOR);
    // Only y movement, reduced by height factor
    expect(owner.x).toBeCloseTo(-5);
    expect(owner.y).toBeCloseTo(-5 + len * OWNER_SPEED * dt * factor);
  });
});
