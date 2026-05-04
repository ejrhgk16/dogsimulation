export interface MapConfig {
  width: number;
  depth: number;
  cellSize: number;
  baseHeight: number;
  hillHeight: number;
  obstacleRatio: number;
  seed: number;
}

export const defaultMapConfig: MapConfig = {
  width: 50,
  depth: 30,
  cellSize: 1,
  baseHeight: 0,
  hillHeight: 2,
  obstacleRatio: 0.1,
  seed: 42
};
