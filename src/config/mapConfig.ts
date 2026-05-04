import type { MapZoneConfig, ObstacleShape } from '../types/map';

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

export const defaultMapConfig: MapConfig = {
  width: 50,
  depth: 30,
  cellSize: 1,
  baseHeight: 0,
  hillHeight: 2,
  obstacleRatio: 0.03,
  seed: 42,
  zones: { flatRatio: 0.5 },
  obstacleShapes: ['L', 'reverse-L', 'single']
};
