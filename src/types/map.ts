export type TerrainType = 'flat' | 'hill' | 'obstacle';

export interface MapCell {
  x: number;
  z: number;
  height: number;
  terrain: TerrainType;
}

export interface MapData {
  grid: MapCell[][];
  cellSize: number;
  width: number;
  depth: number;
}
