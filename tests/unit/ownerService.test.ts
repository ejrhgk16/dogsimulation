import { describe, it, expect } from 'vitest';
import { createOwner, moveOwner } from '../../src/services/ownerService';
import type { MapData, MapCell } from '../../src/types/map';
import type { OwnerState } from '../../src/types/owner';
import { OWNER_SPEED } from '../../src/config/ownerConfig';
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

function ownerAt(x: number, y: number): OwnerState {
  return createOwner('test', 'dog', x, y);
}

describe('createOwner', () => {
  it('returns owner with given props and default direction', () => {
    const o = createOwner('o1', 'cow', 10, 20);
    expect(o.id).toBe('o1');
    expect(o.ownerType).toBe('cow');
    expect(o.x).toBe(10);
    expect(o.y).toBe(20);
    expect(o.directionX).toBe(1);
    expect(o.directionY).toBe(0);
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
    // grid[0][1] has height=2, not obstacle
    map.grid[0][1] = { ...map.grid[0][1], height: 2, terrain: 'hill' };
    const owner = ownerAt(-5, -5);
    moveOwner(owner, new Set(['d']), 1, map);
    const heightDiff = 2;
    const factor = Math.max(0.2, 1 - heightDiff * HEIGHT_SPEED_FACTOR);
    expect(owner.x).toBeCloseTo(-5 + OWNER_SPEED * 1 * factor);
    expect(owner.y).toBeCloseTo(-5);
  });

  it('caps speed reduction at 0.2 for very large height diff', () => {
    const map = createFlatMap();
    map.grid[0][1] = { ...map.grid[0][1], height: 10, terrain: 'hill' };
    const owner = ownerAt(-5, -5);
    moveOwner(owner, new Set(['d']), 1, map);
    const heightDiff = 10;
    const factor = Math.max(0.2, 1 - heightDiff * HEIGHT_SPEED_FACTOR);
    expect(factor).toBe(0.2);
    expect(owner.x).toBeCloseTo(-5 + OWNER_SPEED * 1 * 0.2);
    expect(owner.y).toBeCloseTo(-5);
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
    const heightDiff = 3;
    const factor = Math.max(0.2, 1 - heightDiff * HEIGHT_SPEED_FACTOR);
    // Only y movement, reduced by height factor
    expect(owner.x).toBeCloseTo(-5);
    expect(owner.y).toBeCloseTo(-5 + len * OWNER_SPEED * dt * factor);
  });
});
