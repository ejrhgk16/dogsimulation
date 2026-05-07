import type { AnimalTypeConfig } from '../types/animal';

export const ANIMAL_SPEED = 5.0;

export const HEIGHT_SPEED_FACTOR = 0.3;

export const ANIMAL_HEIGHT_OFFSET = 0.5;

export const ANIMAL_HALF_EXTENT = 0.5;

export const ANIMAL_TYPES: Record<string, AnimalTypeConfig> = {
  dog: { modelPath: '/models/ShibaInu.gltf', color: 0xff9933 },
  alpaca: { modelPath: '/models/Alpaca.gltf', color: 0x44aa44 },
  pig: { modelPath: '/models/Pig.gltf', color: 0xff6688 }
};
