import type { MapZoneConfig, ObstacleShape, ObstaclePattern } from '../types/map';

export interface MapConfig {
  width: number;
  depth: number;
  cellSize: number;
  baseHeight: number;
  hillHeight: number;
  obstacleRatio: number;
  seed: number;
  zones: MapZoneConfig;
  obstacleShapes: ObstacleShape[];
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

export const defaultMapConfig: MapConfig = {
  width: 100,
  depth: 60,
  cellSize: 1,
  baseHeight: 0,
  hillHeight: 2,
  obstacleRatio: 0,
  seed: 42,
  zones: { flatRatio: 0.5 },
  obstacleShapes: []
};
