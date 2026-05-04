export type TerrainType = 'flat' | 'hill' | 'obstacle';

export type ObstacleShape = 'L' | 'reverse-L' | 'single';

export interface ObstaclePattern {
  shape: ObstacleShape;
  cells: { rowOffset: number; colOffset: number }[];
}

export interface MapCell {
  x: number;
  z: number;
  height: number;
  terrain: TerrainType;
  shape?: ObstacleShape;
}

export interface MapZoneConfig {
  flatRatio: number;
}

export interface MapData {
  grid: MapCell[][];
  cellSize: number;
  width: number;
  depth: number;
}

export const OBSTACLE_PATTERNS: Record<Exclude<ObstacleShape, 'single'>, ObstaclePattern> = {
  L: {
    shape: 'L',
    cells: [
      { rowOffset: 0, colOffset: 0 },
      { rowOffset: 1, colOffset: 0 },
      { rowOffset: 1, colOffset: 1 }
    ]
  },
  'reverse-L': {
    shape: 'reverse-L',
    cells: [
      { rowOffset: 0, colOffset: 1 },
      { rowOffset: 1, colOffset: 0 },
      { rowOffset: 1, colOffset: 1 }
    ]
  }
};
