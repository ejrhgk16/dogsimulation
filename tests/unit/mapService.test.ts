import { describe, it, expect } from 'vitest';
import { generateMap } from '../../src/services/mapService';
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
