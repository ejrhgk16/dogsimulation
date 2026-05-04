import type { MapCell, MapData, TerrainType } from '../types/map';
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
  const rng = seededRandom(seed);

  const grid: MapCell[][] = [];
  for (let row = 0; row < depth; row++) {
    const rowCells: MapCell[] = [];
    for (let col = 0; col < width; col++) {
      const terrainRand = rng();
      const terrain: TerrainType =
        terrainRand < obstacleRatio
          ? 'obstacle'
          : terrainRand < obstacleRatio + 0.3
            ? 'hill'
            : 'flat';

      const heightRand = rng();
      let height: number;
      switch (terrain) {
        case 'flat':
          height = baseHeight;
          break;
        case 'hill':
          height = baseHeight + heightRand * hillHeight;
          break;
        case 'obstacle':
          height = baseHeight + heightRand * hillHeight * 1.5;
          break;
      }

      rowCells.push({
        x: col * cellSize,
        z: row * cellSize,
        height,
        terrain
      });
    }
    grid.push(rowCells);
  }

  return { grid, cellSize, width, depth };
}
