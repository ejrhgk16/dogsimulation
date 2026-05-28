import { OBSTACLE_PATTERNS } from '../config/mapConfig';
import type { MapCell, MapData } from '../types/map';
import type { MapConfig } from '../config/mapConfig';
import { ANIMAL_HALF_EXTENT } from '../config/animalConfig';

/** 시드 기반 선형 합동 난수 생성기 */
function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(48271, s) | 0) % 2147483647;
    return (s & 0x7fffffff) / 0x7fffffff;
  };
}

/** MapConfig → MapData 그리드 생성 (지형·장애물 배치) */
export function generateMap(config: MapConfig): MapData {
  const { width, depth, cellSize, baseHeight, obstacleRatio, seed } = config;

  const zones = config.zones ?? { flatRatio: 0 };
  const obstacleShapes = config.obstacleShapes ?? ['single'];

  const rng = seededRandom(seed);
  const grid: MapCell[][] = [];
  for (let row = 0; row < depth; row++) {
    const rowCells: MapCell[] = [];
    for (let col = 0; col < width; col++) {
      rowCells.push({
        x: col * cellSize,
        z: row * cellSize,
        height: baseHeight,
        terrain: 'flat'
      });
    }
    grid.push(rowCells);
  }

  const maxObstacleCells = Math.round(width * depth * obstacleRatio);

  const flatStartCol = Math.floor(width * (1 - zones.flatRatio));

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

/** 특정 좌표가 장애물 위인지 검사 (footprint 영역) */
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

/** 버텍스 주변 4셀 평균 높이 계산 */
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

/** 지형 법선 벡터 계산 (유한차분) */
export function getTerrainNormal(
  mapData: MapData,
  x: number,
  z: number,
  sampleDist = 0.5
): { nx: number; ny: number; nz: number } {
  const h = getHeightAt(mapData, x, z);
  const dhX = getHeightAt(mapData, x + sampleDist, z) - h;
  const dhZ = getHeightAt(mapData, x, z + sampleDist) - h;

  // Tangent vectors along x and z surface directions
  const xLen = Math.sqrt(1 + dhX * dhX);
  const zLen = Math.sqrt(1 + dhZ * dhZ);
  const xTx = 1 / xLen;
  const xTy = dhX / xLen;
  const xTz = 0;
  const zTx = 0;
  const zTy = dhZ / zLen;
  const zTz = 1 / zLen;

  // Normal = cross(z_tangent, x_tangent)
  let nx = zTy * xTz - zTz * xTy;
  let ny = zTz * xTx - zTx * xTz;
  let nz = zTx * xTy - zTy * xTx;

  // Normalize
  const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (nLen > 0) {
    nx /= nLen;
    ny /= nLen;
    nz /= nLen;
  }

  return { nx, ny, nz };
}

/** 셀 코너 4개 이중선형 보간으로 높이 계산 */
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

/**
 * 두 점 사이 직선 경로상에 장애물(terrain === 'obstacle')이 있는지 검사.
 * DDA grid traversal 알고리즘 사용.
 */
export function hasLineOfSight(
  mapData: MapData,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): boolean {
  const mapWidth = mapData.width * mapData.cellSize;
  const mapDepth = mapData.depth * mapData.cellSize;

  // world 좌표 → grid 실수 좌표
  const gx1 = (x1 + mapWidth / 2) / mapData.cellSize;
  const gy1 = (y1 + mapDepth / 2) / mapData.cellSize;
  const gx2 = (x2 + mapWidth / 2) / mapData.cellSize;
  const gy2 = (y2 + mapDepth / 2) / mapData.cellSize;

  // 시작·끝 셀
  const startCol = Math.floor(gx1);
  const startRow = Math.floor(gy1);
  const endCol = Math.floor(gx2);
  const endRow = Math.floor(gy2);

  // 같은 셀이면 중간 셀 없음
  if (startCol === endCol && startRow === endRow) {
    return true;
  }

  const dx = gx2 - gx1;
  const dy = gy2 - gy1;

  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;

  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;

  let tMaxX: number;
  if (dx > 0) {
    tMaxX = (Math.floor(gx1) + 1 - gx1) * tDeltaX;
  } else if (dx < 0) {
    tMaxX = (gx1 - Math.floor(gx1)) * tDeltaX;
  } else {
    tMaxX = Infinity;
  }

  let tMaxY: number;
  if (dy > 0) {
    tMaxY = (Math.floor(gy1) + 1 - gy1) * tDeltaY;
  } else if (dy < 0) {
    tMaxY = (gy1 - Math.floor(gy1)) * tDeltaY;
  } else {
    tMaxY = Infinity;
  }

  let curCol = startCol;
  let curRow = startRow;

  while (curCol !== endCol || curRow !== endRow) {
    if (tMaxX < tMaxY) {
      tMaxX += tDeltaX;
      curCol += stepX;
    } else {
      tMaxY += tDeltaY;
      curRow += stepY;
    }

    // 종료 셀에 도달했으면 검사 중단 (끝점 셀 제외)
    if (curCol === endCol && curRow === endRow) {
      break;
    }

    // boundary clamp: grid 범위 벗어난 cell은 skip
    if (curRow < 0 || curRow >= mapData.depth || curCol < 0 || curCol >= mapData.width) {
      continue;
    }

    if (mapData.grid[curRow][curCol].terrain === 'obstacle') {
      return false;
    }
  }

  return true;
}
