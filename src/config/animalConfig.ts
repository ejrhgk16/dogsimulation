import type { AnimalTypeConfig } from '../types/animal';

export const ANIMAL_SCALE = 0.2;

export const HEIGHT_SPEED_FACTOR = 0.3;

export const ANIMAL_HEIGHT_OFFSET = ANIMAL_SCALE * 1.25;

export const ANIMAL_HALF_EXTENT = 0.5;

export const ANIMAL_TYPES: Record<string, AnimalTypeConfig> = {
  dog: { modelPath: '/models/ShibaInu.gltf', color: 0xff9933, scale: ANIMAL_SCALE },
  alpaca: { modelPath: '/models/Alpaca.gltf', color: 0x44aa44, scale: ANIMAL_SCALE },
  pig: { modelPath: '/models/Pig.gltf', color: 0xff6688, scale: ANIMAL_SCALE }
};
