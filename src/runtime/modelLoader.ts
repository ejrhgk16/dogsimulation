import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationClip, AnimationMixer } from 'three';
import type { Group, KeyframeTrack } from 'three';

const HEAD_BONES = [
  'Head',
  'Neck1',
  'Neck2',
  'Neck3',
  'Torso3',
  'Ear1.L',
  'Ear2.L',
  'Ear3.L',
  'Ear4.L',
  'Ear1.R',
  'Ear2.R',
  'Ear3.R',
  'Ear4.R'
];

function isHeadBoneTrack(trackName: string): boolean {
  return HEAD_BONES.some((bone) => trackName === bone || trackName.startsWith(bone + '.'));
}

export interface LoadedModel {
  group: Group;
  mixer: AnimationMixer;
  animations: AnimationClip[];
  eatingClip?: AnimationClip;
  headDownClip?: AnimationClip;
  headBobbingClip?: AnimationClip;
  headRaiseClip?: AnimationClip;
}

export function createSubClip(
  source: AnimationClip,
  name: string,
  startTime: number,
  endTime: number
): AnimationClip {
  const tracks: KeyframeTrack[] = [];

  for (const track of source.tracks) {
    if (!isHeadBoneTrack(track.name)) continue;

    const times = track.times as unknown as number[];
    const values = track.values as unknown as number[];
    const valueSize = track.getValueSize();

    if (times.length === 0 || startTime >= endTime) continue;

    const indices: number[] = [];
    for (let i = 0; i < times.length; i++) {
      if (times[i] >= startTime && times[i] <= endTime) {
        indices.push(i);
      }
    }

    if (indices.length === 0) continue;

    const subTimes = indices.map((i) => times[i] - startTime);
    const subValues: number[] = [];
    for (const idx of indices) {
      const offset = idx * valueSize;
      for (let j = 0; j < valueSize; j++) {
        subValues.push(values[offset + j]);
      }
    }

    const TrackConstructor = track.constructor as new (
      name: string,
      times: number[],
      values: number[]
    ) => KeyframeTrack;

    tracks.push(new TrackConstructor(track.name, subTimes, subValues));
  }

  return new AnimationClip(name, endTime - startTime, tracks);
}

export function loadModel(path: string, animalType?: string): Promise<LoadedModel | null> {
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

        const result: LoadedModel = { group: gltf.scene, mixer, animations: gltf.animations };

        // Extract Eating animation sub-clips for head controls (dog only)
        if (animalType === 'dog') {
          const eatingClip = gltf.animations.find((clip: AnimationClip) => clip.name === 'Eating');
          if (eatingClip) {
            result.eatingClip = eatingClip;
            const fps = 30;
            // Based on actual Eating animation data:
            // Frame 0: deep eating (Torso3=34.8°, Neck1=17.7°)
            // Frame 10: neutral (Torso3=0.9°, Neck1=2.7°)
            // Frames 15-60: moderate eating (Torso3=5.6°, Neck1=12.3°)
            // Frame 65: neutral (Torso3=0.1°, Neck1=9.4°)
            // Frame 80: deep eating (Torso3=34.8°, Neck1=17.7°)
            const t1 = 0 / fps; // HeadDown start: deep eating
            const t2 = 10 / fps; // HeadDown end / HeadBobbing start: neutral
            const t3 = 60 / fps; // HeadBobbing end / HeadRaise start: moderate eating
            const t4 = 70 / fps; // HeadRaise end: going back down
            result.headDownClip = createSubClip(eatingClip, 'HeadDown', t1, t2);
            result.headBobbingClip = createSubClip(eatingClip, 'HeadBobbing', t2, t3);
            result.headRaiseClip = createSubClip(eatingClip, 'HeadRaise', t3, t4);

            // Debug: verify subclip content
            console.debug(
              `[SubClips] HeadDown: ${result.headDownClip.tracks.length} tracks, HeadBobbing: ${result.headBobbingClip.tracks.length} tracks, HeadRaise: ${result.headRaiseClip.tracks.length} tracks`
            );
            // Show sample track names (max 5) to verify bone filter
            console.debug(
              `[BoneFilter] first 3 Eating track names: ${eatingClip.tracks
                .slice(0, 3)
                .map((t: KeyframeTrack) => t.name)
                .join(' | ')}`
            );
            console.debug(
              `[BoneFilter] matched by isHeadBoneTrack: ${
                eatingClip.tracks.filter((t: KeyframeTrack) => isHeadBoneTrack(t.name)).length
              }/${eatingClip.tracks.length}`
            );
          }
        }

        resolve(result);
      },
      undefined,
      () => {
        console.warn(`Failed to load model: ${path}`);
        resolve(null);
      }
    );
  });
}
