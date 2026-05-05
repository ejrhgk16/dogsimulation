export interface OwnerState {
  id: string;
  ownerType: string;
  x: number;
  y: number; // z좌표 (맵 좌표)
  height: number; // worldY (고도)
  directionX: number;
  directionY: number;
}
