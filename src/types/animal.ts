export interface AnimalTypeConfig {
  modelPath: string;
  color: number;
  scale: number;
}

export interface AnimalState {
  id: string;
  animalType: string;
  x: number;
  y: number; // z좌표 (맵 좌표)
  height: number; // worldY (고도)
  directionX: number;
  directionY: number;
  rotationAngle: number; // radians, 현재 회전각
}
