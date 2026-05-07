import { OBSTACLE_PATTERNS } from '../config/mapConfig';
import type { MapCell, MapData } from '../types/map';
import type { MapConfig } from '../config/mapConfig';
import { ANIMAL_HALF_EXTENT } from '../config/animalConfig';

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

export function getCellAt(mapData: MapData, x: number, z: number): MapCell | null {
  const mapWidth = mapData.width * mapData.cellSize;
  const mapDepth = mapData.depth * mapData.cellSize;
  const col = Math.floor((x + mapWidth / 2) / mapData.cellSize);
  const row = Math.floor((z + mapDepth / 2) / mapData.cellSize);
  if (row < 0 || row >= mapData.depth || col < 0 || col >= mapData.width) {
    return null;
  }
  return mapData.grid[row][col];
}

export function isObstacleAt(mapData: MapData, x: number, z: number): boolean {
  const cell = getCellAt(mapData, x, z);
  if (cell === null) return true;
  return cell.terrain === 'obstacle';
}

export function isObstacleInFootprint(
  mapData: MapData,
  cx: number,
  cz: number,
  halfExtent = ANIMAL_HALF_EXTENT
): boolean {
  const mapWidth = mapData.width * mapData.cellSize;
  const mapDepth = mapData.depth * mapData.cellSize;
  const minCol = Math.floor((cx - halfExtent + mapWidth / 2) / mapData.cellSize);
  const maxCol = Math.floor((cx + halfExtent - 1e-9 + mapWidth / 2) / mapData.cellSize);
  const minRow = Math.floor((cz - halfExtent + mapDepth / 2) / mapData.cellSize);
  const maxRow = Math.floor((cz + halfExtent - 1e-9 + mapDepth / 2) / mapData.cellSize);

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (
        row < 0 ||
        row >= mapData.depth ||
        col < 0 ||
        col >= mapData.width ||
        mapData.grid[row][col].terrain === 'obstacle'
      ) {
        return true;
      }
    }
  }
  return false;
}

function getVertexHeight(mapData: MapData, vRow: number, vCol: number): number {
  const { grid, width, depth } = mapData;
  let h = 0;
  let count = 0;
  if (vRow > 0 && vCol > 0) {
    h += grid[vRow - 1][vCol - 1].height;
    count++;
  }
  if (vRow > 0 && vCol < width) {
    h += grid[vRow - 1][vCol].height;
    count++;
  }
  if (vRow < depth && vCol > 0) {
    h += grid[vRow][vCol - 1].height;
    count++;
  }
  if (vRow < depth && vCol < width) {
    h += grid[vRow][vCol].height;
    count++;
  }
  return count > 0 ? h / count : 0;
}

export function getHeightAt(mapData: MapData, x: number, z: number): number {
  const mapWidth = mapData.width * mapData.cellSize;
  const mapDepth = mapData.depth * mapData.cellSize;

  const gx = (x + mapWidth / 2) / mapData.cellSize;
  const gz = (z + mapDepth / 2) / mapData.cellSize;

  if (gx < 0 || gx >= mapData.width || gz < 0 || gz >= mapData.depth) return 0;

  const gCol = Math.floor(gx);
  const gRow = Math.floor(gz);
  const fx = gx - gCol;
  const fz = gz - gRow;

  const h00 = getVertexHeight(mapData, gRow, gCol);
  const h10 = getVertexHeight(mapData, gRow, gCol + 1);
  const h01 = getVertexHeight(mapData, gRow + 1, gCol);
  const h11 = getVertexHeight(mapData, gRow + 1, gCol + 1);

  const top = h00 + (h10 - h00) * fx;
  const bottom = h01 + (h11 - h01) * fx;
  return top + (bottom - top) * fz;
}
