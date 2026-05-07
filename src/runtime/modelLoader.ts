import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Group } from 'three';

export interface LoadedModel {
  group: Group;
  mixer?: undefined;
}

export function loadModel(path: string): Promise<LoadedModel | null> {
  const loader = new GLTFLoader();
  return new Promise((resolve) => {
    loader.load(
      path,
      (gltf) => {
        resolve({ group: gltf.scene });
      },
      undefined,
      () => {
        console.warn(`Failed to load model: ${path}`);
        resolve(null);
      }
    );
  });
}
