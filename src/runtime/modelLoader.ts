import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationMixer } from 'three';
import type { Group, AnimationClip } from 'three';

export interface LoadedModel {
  group: Group;
  mixer: AnimationMixer;
  animations: AnimationClip[];
}

export function loadModel(path: string): Promise<LoadedModel | null> {
  const loader = new GLTFLoader();
  return new Promise((resolve) => {
    loader.load(
      path,
      (gltf) => {
        const mixer = new AnimationMixer(gltf.scene);
        gltf.animations.forEach((clip: AnimationClip) => mixer.clipAction(clip));

        // Debug: log animation clip names for development
        if (gltf.animations.length > 0) {
          const names = gltf.animations.map((c: AnimationClip) => c.name).join(', ');
          console.debug(`Model animations: [${names}]`);
        } else {
          console.debug('Model has no animations');
        }

        resolve({ group: gltf.scene, mixer, animations: gltf.animations });
      },
      undefined,
      () => {
        console.warn(`Failed to load model: ${path}`);
        resolve(null);
      }
    );
  });
}
