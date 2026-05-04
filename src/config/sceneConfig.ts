import type { DogPosition } from '../types/dog';

export interface SceneConfig {
  gravity: number;
  groundSize: number;
  initialDogPosition: DogPosition;
  initialDogSpeed: number;
}

export const defaultSceneConfig: SceneConfig = {
  gravity: -9.81,
  groundSize: 20,
  initialDogPosition: { x: 0, y: 0, z: 0 },
  initialDogSpeed: 2
};
