export interface PursuerState {
  id: string;
  x: number;
  y: number; // map Z coordinate
  height: number; // world Y (elevation)
  speed: number; // base movement speed
  chaseSpeed: number; // speed when chasing target
  directionX: number; // normalized direction
  directionY: number; // normalized direction
  rotationAngle: number; // radians
  targetId: string | null;
}
