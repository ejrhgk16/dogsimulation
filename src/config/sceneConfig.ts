export interface SceneConfig {
  gravity: number;
  groundSize: number;
}

export const defaultSceneConfig: SceneConfig = {
  gravity: -9.81,
  groundSize: 20
};
