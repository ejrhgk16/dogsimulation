import { describe, it, expect } from 'vitest';
import { generateMap, getHeightAt, getTerrainNormal } from '../../src/services/mapService';
import type { MapConfig } from '../../src/config/mapConfig';

const baseConfig: MapConfig = {
  width: 10,
  depth: 10,
  cellSize: 1,
  baseHeight: 0,
  hillHeight: 2,
  obstacleRatio: 0.1,
  seed: 42,
  zones: { flatRatio: 0 },
  obstacleShapes: ['single']
};

describe('generateMap', () => {
  it('same seed produces identical map', () => {
    const a = generateMap(baseConfig);
    const b = generateMap(baseConfig);
    for (let row = 0; row < a.depth; row++) {
      for (let col = 0; col < a.width; col++) {
        expect(a.grid[row][col].terrain).toBe(b.grid[row][col].terrain);
        expect(a.grid[row][col].height).toBe(b.grid[row][col].height);
      }
    }
  });

  it('different seed produces different map', () => {
    const a = generateMap(baseConfig);
    const b = generateMap({ ...baseConfig, seed: 99 });
    let same = 0;
    let total = a.width * a.depth;
    for (let row = 0; row < a.depth; row++) {
      for (let col = 0; col < a.width; col++) {
        if (a.grid[row][col].terrain === b.grid[row][col].terrain) same++;
      }
    }
    expect(same).toBeLessThan(total);
  });

  it('obstacleRatio 0 produces no obstacle cells', () => {
    const map = generateMap({ ...baseConfig, obstacleRatio: 0 });
    for (const row of map.grid) {
      for (const cell of row) {
        expect(cell.terrain).not.toBe('obstacle');
      }
    }
  });

  it('obstacleRatio 1 makes all cells obstacle', () => {
    const map = generateMap({ ...baseConfig, obstacleRatio: 1 });
    for (const row of map.grid) {
      for (const cell of row) {
        expect(cell.terrain).toBe('obstacle');
      }
    }
  });

  it('grid dimensions match width and depth', () => {
    const map = generateMap(baseConfig);
    expect(map.grid.length).toBe(10);
    expect(map.grid[0].length).toBe(10);
  });

  it('cell coordinates are cellSize apart', () => {
    const config = { ...baseConfig, cellSize: 2, width: 3, depth: 3 };
    const map = generateMap(config);
    expect(map.grid[0][0].x).toBe(0);
    expect(map.grid[0][0].z).toBe(0);
    expect(map.grid[0][1].x).toBe(2);
    expect(map.grid[1][0].z).toBe(2);
  });

  it('flat cells have baseHeight and exist when ratio < 1', () => {
    const map = generateMap({ ...baseConfig, baseHeight: 5, seed: 1 });
    let flatCount = 0;
    for (const row of map.grid) {
      for (const cell of row) {
        if (cell.terrain === 'flat') {
          expect(cell.height).toBe(5);
          flatCount++;
        }
      }
    }
    expect(flatCount).toBeGreaterThan(0);
  });

  it('hill cells have height above baseHeight', () => {
    const map = generateMap(baseConfig);
    for (const row of map.grid) {
      for (const cell of row) {
        if (cell.terrain === 'hill') {
          expect(cell.height).toBeGreaterThan(0);
          expect(cell.height).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('right flat zone has no hill cells', () => {
    const map = generateMap({ ...baseConfig, zones: { flatRatio: 0.3 } });
    const flatStartCol = Math.floor(10 * (1 - 0.3));
    for (let r = 0; r < map.depth; r++) {
      for (let c = flatStartCol; c < map.width; c++) {
        expect(map.grid[r][c].terrain).not.toBe('hill');
      }
    }
  });

  it('L-shape obstacles are placed in groups of 3', () => {
    const map = generateMap({
      ...baseConfig,
      zones: { flatRatio: 0.5 },
      obstacleShapes: ['L'],
      obstacleRatio: 0.5
    });
    let lCount = 0;
    for (const row of map.grid) {
      for (const cell of row) {
        if (cell.shape === 'L') lCount++;
      }
    }
    expect(lCount).toBeGreaterThanOrEqual(3);
    expect(lCount % 3).toBe(0);
  });

  it('reverse-L obstacles are placed in groups of 3', () => {
    const map = generateMap({
      ...baseConfig,
      zones: { flatRatio: 0.5 },
      obstacleShapes: ['reverse-L'],
      obstacleRatio: 0.5
    });
    let rlCount = 0;
    for (const row of map.grid) {
      for (const cell of row) {
        if (cell.shape === 'reverse-L') rlCount++;
      }
    }
    expect(rlCount).toBeGreaterThanOrEqual(3);
    expect(rlCount % 3).toBe(0);
  });

  it('obstacles are concentrated in flat zone when flatRatio > 0', () => {
    const map = generateMap({
      ...baseConfig,
      zones: { flatRatio: 0.5 },
      obstacleShapes: ['single'],
      obstacleRatio: 0.1
    });
    const flatStartCol = Math.floor(10 * 0.5);
    let flatObs = 0;
    let leftObs = 0;
    for (let r = 0; r < map.depth; r++) {
      for (let c = 0; c < flatStartCol; c++) {
        if (map.grid[r][c].terrain === 'obstacle') leftObs++;
      }
      for (let c = flatStartCol; c < map.width; c++) {
        if (map.grid[r][c].terrain === 'obstacle') flatObs++;
      }
    }
    expect(leftObs).toBe(0);
    expect(flatObs).toBeGreaterThan(0);
  });

  it('flatRatio 0 makes entire grid mixed terrain', () => {
    const map = generateMap({ ...baseConfig, zones: { flatRatio: 0 } });
    let hillCount = 0;
    for (const row of map.grid) {
      for (const cell of row) {
        if (cell.terrain === 'hill') hillCount++;
      }
    }
    expect(hillCount).toBeGreaterThan(0);
  });

  it('obstacle count with default config stays below 15%', () => {
    const map = generateMap({ ...baseConfig, obstacleRatio: 0.1 });
    let count = 0;
    const total = map.width * map.depth;
    for (const row of map.grid) {
      for (const cell of row) {
        if (cell.terrain === 'obstacle') count++;
      }
    }
    expect(count).toBeLessThanOrEqual(Math.round(total * 0.15));
  });
});

describe('getHeightAt', () => {
  it('flat terrain returns baseHeight everywhere', () => {
    const map = generateMap({ ...baseConfig, baseHeight: 5, hillHeight: 0, obstacleRatio: 0 });
    // At various positions, interpolation should give baseHeight
    expect(getHeightAt(map, 0, 0)).toBe(5);
    expect(getHeightAt(map, -3.2, 1.7)).toBe(5);
    expect(getHeightAt(map, 4.5, -4.5)).toBe(5);
  });

  it('returns 0 for out-of-bounds coordinates', () => {
    const map = generateMap(baseConfig);
    expect(getHeightAt(map, 100, 0)).toBe(0);
    expect(getHeightAt(map, 0, 100)).toBe(0);
  });

  it('interpolation at vertex equals average of adjacent cell heights', () => {
    const map = generateMap({
      ...baseConfig,
      width: 3,
      depth: 3,
      cellSize: 2,
      baseHeight: 0,
      hillHeight: 0,
      obstacleRatio: 0
    });
    // Set known heights for 4 cells around vertex (1,1)
    map.grid[0][0].height = 10;
    map.grid[0][1].height = 20;
    map.grid[1][0].height = 30;
    map.grid[1][1].height = 40;
    // Vertex (1,1) world: x = 1*2 - 3 = -1, z = 1*2 - 3 = -1
    // Vertex height = (10+20+30+40)/4 = 25
    expect(getHeightAt(map, -1, -1)).toBe(25);
    // Corner vertex (0,0) world: x = -3, z = -3
    // Only adjacent cell: grid[0][0].height = 10
    expect(getHeightAt(map, -3, -3)).toBe(10);
  });

  it('interpolation at cell center is close to cell height on varied terrain', () => {
    const map = generateMap({
      ...baseConfig,
      width: 3,
      depth: 3,
      cellSize: 2,
      baseHeight: 10,
      hillHeight: 0,
      obstacleRatio: 0
    });
    // Set controlled heights
    map.grid[0][0].height = 10;
    map.grid[0][1].height = 12;
    map.grid[1][0].height = 14;
    map.grid[1][1].height = 16;
    // Cell (0,0) center: gx=0.5, gz=0.5
    // world: x = 0.5*2 - 3 = -2, z = 0.5*2 - 3 = -2
    // The bilinear interpolation at this point should be close to grid[0][0].height = 10
    const h = getHeightAt(map, -2, -2);
    // Vertex heights: v(0,0)=10, v(0,1)=(10+12)/2=11, v(1,0)=(10+14)/2=12, v(1,1)=(10+12+14+16)/4=13
    // top = lerp(10, 11, 0.5) = 10.5
    // bottom = lerp(12, 13, 0.5) = 12.5
    // h = lerp(10.5, 12.5, 0.5) = 11.5
    expect(h).toBe(11.5);
  });

  it('interpolation is continuous at cell boundaries', () => {
    const map = generateMap({
      ...baseConfig,
      width: 3,
      depth: 3,
      cellSize: 2,
      baseHeight: 0,
      hillHeight: 5,
      obstacleRatio: 0,
      seed: 42
    });
    const mapWidth = map.width * map.cellSize;
    const mapDepth = map.depth * map.cellSize;
    // Boundary between cell (0,0) and cell (0,1): gx = 1
    const z = 0.5 * map.cellSize - mapDepth / 2; // gz = 0.5 (center between rows)
    const boundaryX = 1 * map.cellSize - mapWidth / 2;
    const left = getHeightAt(map, boundaryX - 1e-8, z);
    const right = getHeightAt(map, boundaryX + 1e-8, z);
    // Values should match to high precision (floating point difference < 1e-7)
    expect(Math.abs(left - right)).toBeLessThan(1e-7);
  });
});

describe('getTerrainNormal', () => {
  it('returns normal pointing up on flat terrain', () => {
    const map = generateMap({
      ...baseConfig,
      baseHeight: 5,
      hillHeight: 0,
      obstacleRatio: 0
    });
    const result = getTerrainNormal(map, 0, 0);
    expect(result.nx).toBeCloseTo(0, 5);
    expect(result.ny).toBeCloseTo(1, 5);
    expect(result.nz).toBeCloseTo(0, 5);
  });

  it('returns normal with negative nx when terrain slopes up in +x', () => {
    const map = generateMap({
      ...baseConfig,
      width: 5,
      depth: 5,
      cellSize: 2,
      baseHeight: 0,
      hillHeight: 0,
      obstacleRatio: 0
    });
    // Height increases with column index: slopes up in +x direction
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        map.grid[r][c].height = c * 2;
      }
    }
    const result = getTerrainNormal(map, 0, 0);
    expect(result.nx).toBeLessThan(0);
    expect(result.ny).toBeGreaterThan(0);
    const len = Math.sqrt(result.nx ** 2 + result.ny ** 2 + result.nz ** 2);
    expect(len).toBeCloseTo(1, 5);
  });

  it('returns normal with negative nz when terrain slopes up in +z', () => {
    const map = generateMap({
      ...baseConfig,
      width: 5,
      depth: 5,
      cellSize: 2,
      baseHeight: 0,
      hillHeight: 0,
      obstacleRatio: 0
    });
    // Height increases with row index: slopes up in +z direction
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        map.grid[r][c].height = r * 2;
      }
    }
    const result = getTerrainNormal(map, 0, 0);
    expect(result.nz).toBeLessThan(0);
    expect(result.ny).toBeGreaterThan(0);
    const len = Math.sqrt(result.nx ** 2 + result.ny ** 2 + result.nz ** 2);
    expect(len).toBeCloseTo(1, 5);
  });

  it('uses custom sampleDist parameter', () => {
    const map = generateMap({
      ...baseConfig,
      width: 5,
      depth: 5,
      cellSize: 2,
      baseHeight: 0,
      hillHeight: 0,
      obstacleRatio: 0
    });
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        map.grid[r][c].height = c * 2;
      }
    }
    const resultSmall = getTerrainNormal(map, 0, 0, 0.5);
    const resultLarge = getTerrainNormal(map, 0, 0, 2);
    // Different sample distances should give consistent direction
    expect(resultSmall.nx).toBeLessThan(0);
    expect(resultLarge.nx).toBeLessThan(0);
  });

  it('returns object with correct shape', () => {
    const map = generateMap(baseConfig);
    const result = getTerrainNormal(map, 0, 0);
    expect(result).toHaveProperty('nx');
    expect(result).toHaveProperty('ny');
    expect(result).toHaveProperty('nz');
  });
});
