import { defaultMapConfig } from './mapConfig';
import type { MapConfig } from './mapConfig';

export interface SceneConfig {
  gravity: number;
  groundSize: number;
  mapConfig: MapConfig;
}

export const defaultSceneConfig: SceneConfig = {
  gravity: -9.81,
  groundSize: 20,
  mapConfig: defaultMapConfig
};
