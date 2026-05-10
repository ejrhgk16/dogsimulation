export interface PursuedState {
  id: string;
  animalType: string; // 'alpaca', 'pig', etc — model/scent lookup key
  x: number;
  y: number; // map Z coordinate
  height: number; // world Y (elevation)
  speed: number; // movement speed
  directionX: number;
  directionY: number;
  rotationAngle: number; // radians
}
