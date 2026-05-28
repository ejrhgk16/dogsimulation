import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationClip, AnimationMixer } from 'three';
import type { Group } from 'three';
import { ANIMAL_TYPES } from '../config/animalConfig';

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

/** 본 이름이 머리 뼈대에 속하는지 확인 */
function isHeadBoneTrack(trackName: string): boolean {
  return HEAD_BONES.some((bone) => trackName === bone || trackName.startsWith(bone + '.'));
}

export interface LoadedModel {
  group: Group;
  mixer: AnimationMixer;
  animations: AnimationClip[];
  eatingClip?: AnimationClip;
  gallopClip?: AnimationClip;
  headDownClip?: AnimationClip;
  headBobClip?: AnimationClip;
  headUpClip?: AnimationClip;
}

/** 특정 시간 구간의 머리 애니메이션 트랙만 추출 */
export function createSubClip(
  source: AnimationClip,
  name: string,
  startTime: number,
  endTime: number
): AnimationClip {
  const tracks: typeof source.tracks = [];

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
    ) => typeof track;

    tracks.push(new TrackConstructor(track.name, subTimes, subValues));
  }

  return new AnimationClip(name, endTime - startTime, tracks);
}

/** GLTF 모델 로드 + AnimationMixer 생성 */
export function loadModel(path: string, _animalType?: string): Promise<LoadedModel | null> {
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

        // Find gallop clip
        const gallopClip = gltf.animations.find((c: AnimationClip) =>
          c.name.toLowerCase().includes('gallop')
        );
        if (gallopClip) {
          result.gallopClip = gallopClip;
        }

        // Find eating clip
        const eatingClip = gltf.animations.find((c: AnimationClip) =>
          c.name.toLowerCase().includes('eat')
        );
        if (eatingClip) {
          result.eatingClip = eatingClip;
        }

        // Create head sub-clips from eating clip if headFrameRanges defined
        const headRanges = ANIMAL_TYPES[_animalType || '']?.headFrameRanges;
        if (headRanges && eatingClip) {
          result.headDownClip = createSubClip(
            eatingClip,
            'headDown',
            headRanges.downStart,
            headRanges.downEnd
          );
          result.headBobClip = createSubClip(
            eatingClip,
            'headBob',
            headRanges.bobStart,
            headRanges.bobEnd
          );
          result.headUpClip = createSubClip(
            eatingClip,
            'headUp',
            headRanges.raiseStart,
            headRanges.raiseEnd
          );
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
