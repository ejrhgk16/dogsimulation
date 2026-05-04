import { OBSTACLE_PATTERNS } from '../types/map';
import type { MapCell, MapData } from '../types/map';
import type { MapConfig } from '../config/mapConfig';

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(48271, s) | 0) % 2147483647;
    return (s & 0x7fffffff) / 0x7fffffff;
  };
}

export function generateMap(config: MapConfig): MapData {
  const { width, depth, cellSize, baseHeight, hillHeight, obstacleRatio, seed } = config;

  const zones = config.zones ?? { flatRatio: 0 };
  const obstacleShapes = config.obstacleShapes ?? ['single'];

  const rng = seededRandom(seed);
  const grid: MapCell[][] = [];
  const flatStartCol = Math.floor(width * (1 - zones.flatRatio));

  for (let row = 0; row < depth; row++) {
    const rowCells: MapCell[] = [];
    for (let col = 0; col < width; col++) {
      const isFlatZone = col >= flatStartCol && zones.flatRatio > 0;

      if (isFlatZone) {
        rowCells.push({
          x: col * cellSize,
          z: row * cellSize,
          height: baseHeight,
          terrain: 'flat'
        });
      } else {
        const terrainRand = rng();
        const terrain = terrainRand < obstacleRatio + 0.3 ? 'hill' : 'flat';
        const heightRand = rng();
        rowCells.push({
          x: col * cellSize,
          z: row * cellSize,
          height: terrain === 'flat' ? baseHeight : baseHeight + heightRand * hillHeight,
          terrain
        });
      }
    }
    grid.push(rowCells);
  }

  const maxObstacleCells = Math.round(width * depth * obstacleRatio);

  if (maxObstacleCells <= 0) {
    return { grid, cellSize, width, depth };
  }

  if (obstacleRatio >= 1) {
    for (let row = 0; row < depth; row++) {
      for (let col = 0; col < width; col++) {
        grid[row][col] = {
          ...grid[row][col],
          terrain: 'obstacle',
          shape: 'single',
          height: baseHeight
        };
      }
    }
    return { grid, cellSize, width, depth };
  }

  let placedCells = 0;
  let patternIndex = 0;
  const maxAttempts = width * depth * 10;
  let attempts = 0;
  const hasFlatZone = zones.flatRatio > 0 && flatStartCol < width;

  while (placedCells < maxObstacleCells && attempts < maxAttempts) {
    attempts++;
    const shapeName = obstacleShapes[patternIndex % obstacleShapes.length];
    patternIndex++;

    const anchorRow = Math.floor(rng() * depth);
    const anchorCol = hasFlatZone
      ? flatStartCol + Math.floor(rng() * (width - flatStartCol))
      : Math.floor(rng() * width);

    if (shapeName === 'single') {
      if (grid[anchorRow][anchorCol].terrain !== 'obstacle') {
        grid[anchorRow][anchorCol] = {
          ...grid[anchorRow][anchorCol],
          terrain: 'obstacle',
          shape: 'single',
          height: baseHeight
        };
        placedCells++;
      }
    } else {
      const pattern = OBSTACLE_PATTERNS[shapeName];
      if (!pattern) continue;

      const cells = pattern.cells.map((c) => ({
        row: anchorRow + c.rowOffset,
        col: anchorCol + c.colOffset
      }));

      const valid = cells.every(
        (c) =>
          c.row >= 0 &&
          c.row < depth &&
          c.col >= 0 &&
          c.col < width &&
          grid[c.row][c.col].terrain !== 'obstacle'
      );

      if (!valid) continue;

      cells.forEach((c) => {
        grid[c.row][c.col] = {
          ...grid[c.row][c.col],
          terrain: 'obstacle',
          shape: shapeName,
          height: baseHeight
        };
      });
      placedCells += cells.length;
    }
  }

  return { grid, cellSize, width, depth };
}
