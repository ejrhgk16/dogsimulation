import type { PursuerState } from '../types/pursuer';
import type { MapData } from '../types/map';
import { ANIMAL_HEIGHT_OFFSET } from '../config/animalConfig';
import { getHeightAt } from './mapService';

export function createPursuer(
  id: string,
  x: number,
  y: number,
  mapData: MapData,
  speed: number = 5.0,
  chaseSpeed: number = 7.0
): PursuerState {
  const height = getHeightAt(mapData, x, y) + ANIMAL_HEIGHT_OFFSET;
  return {
    id,
    x,
    y,
    height,
    speed,
    chaseSpeed,
    directionX: 1,
    directionY: 0,
    rotationAngle: Math.atan2(1, 0),
    targetId: null
  };
}

export function chaseTarget(pursuer: PursuerState): PursuerState {
  return pursuer;
}
