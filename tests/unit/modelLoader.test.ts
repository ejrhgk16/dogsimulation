import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock GLTFLoader
const mockLoad = vi.fn();
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn().mockImplementation(() => ({
    load: mockLoad
  }))
}));

// Mock Group
const mockGroup = { children: [], position: { set: vi.fn() } };

// Mock AnimationMixer
const mockClipAction = vi.fn().mockReturnValue({});
const mockMixer = {
  clipAction: mockClipAction,
  update: vi.fn()
};

vi.mock('three', () => ({
  Group: vi.fn().mockImplementation(() => mockGroup),
  AnimationClip: class {
    name: string;
    duration: number;
    tracks: unknown[];
    uuid: string;
    constructor(name: string, duration: number, tracks: unknown[]) {
      this.name = name;
      this.duration = duration;
      this.tracks = tracks;
      this.uuid = 'mock-' + Math.random().toString(36).slice(2);
    }
  },
  AnimationMixer: vi.fn().mockImplementation(() => mockMixer)
}));

import { loadModel, createSubClip } from '../../src/runtime/modelLoader';

describe('loadModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a Promise', () => {
    // Make the load callback never fire (promise stays pending)
    mockLoad.mockImplementation(() => {
      // no-op — never calls any callback
    });
    const result = loadModel('/models/ShibaInu.gltf', 'dog');
    expect(result).toBeInstanceOf(Promise);
  });

  it('resolves with LoadedModel on success', async () => {
    const fakeGltf = { scene: mockGroup, animations: [] };
    mockLoad.mockImplementation((_path: string, onLoad: (gltf: unknown) => void) => {
      onLoad(fakeGltf);
    });

    const result = await loadModel('/models/ShibaInu.gltf', 'dog');
    expect(result).not.toBeNull();
    expect(result!.group).toBe(mockGroup);
    expect(result!.mixer).toBeDefined();
    expect(result!.animations).toEqual([]);
  });

  it('creates AnimationMixer and caches clips via clipAction', async () => {
    const fakeClips = [{ name: 'Walk' }, { name: 'Idle' }, { name: 'Run' }];
    const fakeGltf = { scene: mockGroup, animations: fakeClips };
    mockLoad.mockImplementation((_path: string, onLoad: (gltf: unknown) => void) => {
      onLoad(fakeGltf);
    });

    const result = await loadModel('/models/ShibaInu.gltf', 'dog');
    expect(result).not.toBeNull();
    expect(result!.animations).toBe(fakeClips);
    // AnimationMixer constructor was called
    const AnimationMixerMock = (await import('three')).AnimationMixer as ReturnType<typeof vi.fn>;
    expect(AnimationMixerMock).toHaveBeenCalledWith(mockGroup);
    // clipAction called for each animation clip
    expect(mockClipAction).toHaveBeenCalledTimes(3);
    expect(mockClipAction).toHaveBeenCalledWith(fakeClips[0]);
    expect(mockClipAction).toHaveBeenCalledWith(fakeClips[1]);
    expect(mockClipAction).toHaveBeenCalledWith(fakeClips[2]);
  });

  it('logs animation clip names via console.debug', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const fakeClips = [{ name: 'Walk' }, { name: 'Idle' }];
    const fakeGltf = { scene: mockGroup, animations: fakeClips };
    mockLoad.mockImplementation((_path: string, onLoad: (gltf: unknown) => void) => {
      onLoad(fakeGltf);
    });

    await loadModel('/models/ShibaInu.gltf', 'dog');
    expect(debugSpy).toHaveBeenCalledWith('Model animations: [Walk, Idle]');
    debugSpy.mockRestore();
  });

  it('logs no animations when gltf has no clips', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const fakeGltf = { scene: mockGroup, animations: [] };
    mockLoad.mockImplementation((_path: string, onLoad: (gltf: unknown) => void) => {
      onLoad(fakeGltf);
    });

    await loadModel('/models/ShibaInu.gltf', 'dog');
    expect(debugSpy).toHaveBeenCalledWith('Model has no animations');
    debugSpy.mockRestore();
  });

  it('resolves with null on error and warns', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockLoad.mockImplementation(
      (_path: string, _onLoad: unknown, _onProgress: unknown, onError: (err: unknown) => void) => {
        onError(new Error('Failed to load'));
      }
    );

    const result = await loadModel('/models/bad.gltf', 'dog');
    expect(result).toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });
});

function makeMockTrack(name: string, times: number[], values: number[]): Record<string, unknown> {
  const valueSize = times.length > 0 ? values.length / times.length : 3;
  return {
    name,
    times: [...times],
    values: [...values],
    getValueSize: () => valueSize,
    constructor: function MockTrack(n: string, t: number[], v: number[]) {
      return makeMockTrack(n, t, v);
    }
  };
}

describe('createSubClip', () => {
  it('returns clip with correct name and duration', () => {
    const tracks = [makeMockTrack('Head.position', [0, 0.5, 1], [0, 0, 0, 1, 1, 1, 2, 2, 2])];
    const clip = { name: 'Eating', duration: 1, tracks } as const;

    const result = createSubClip(clip as never, 'HeadDown', 0, 0.5);

    expect(result.name).toBe('HeadDown');
    expect(result.duration).toBe(0.5);
    expect(result.tracks).toHaveLength(1);
  });

  it('filters keyframes within range and normalizes times', () => {
    const tracks = [
      makeMockTrack('Head.position', [0.25, 0.5, 0.75, 1.0], [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3])
    ];
    const clip = { name: 'Eating', duration: 1, tracks } as const;

    const result = createSubClip(clip as never, 'Test', 0.25, 0.75);

    expect(result.tracks).toHaveLength(1);
    // times [0.25, 0.5, 0.75] normalized to [0, 0.25, 0.5]
    expect(result.tracks[0].times).toEqual([0, 0.25, 0.5]);
    // values for indices 0,1,2 with valueSize=3
    expect(result.tracks[0].values).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2]);
  });

  it('filters multiple tracks', () => {
    const tracks = [
      makeMockTrack('Head.position', [0, 0.5, 1], [0, 0, 0, 1, 1, 1, 2, 2, 2]),
      makeMockTrack('Neck1.quaternion', [0, 0.5, 1], [0, 0, 0, 1, 1, 1, 1, 0, 0, 0])
    ];
    const clip = { name: 'Eating', duration: 1, tracks } as const;

    const result = createSubClip(clip as never, 'HeadDown', 0, 0.5);

    expect(result.tracks).toHaveLength(2);
    expect(result.tracks[0].times).toEqual([0, 0.5]);
    expect(result.tracks[1].times).toEqual([0, 0.5]);
  });

  it('returns empty tracks array when no keyframes in range', () => {
    const tracks = [makeMockTrack('Head.position', [1, 2, 3], [0, 0, 0, 1, 1, 1, 2, 2, 2])];
    const clip = { name: 'Eating', duration: 3, tracks } as const;

    const result = createSubClip(clip as never, 'Empty', 4, 5);

    expect(result.name).toBe('Empty');
    expect(result.duration).toBe(1);
    expect(result.tracks).toHaveLength(0);
  });

  it('handles empty source tracks array', () => {
    const clip = { name: 'Eating', duration: 2, tracks: [] } as const;

    const result = createSubClip(clip as never, 'EmptyClip', 0, 1);

    expect(result.name).toBe('EmptyClip');
    expect(result.duration).toBe(1);
    expect(result.tracks).toHaveLength(0);
  });

  it('filters out non-head bone tracks', () => {
    const tracks = [
      makeMockTrack('Tail.position', [0, 0.5, 1], [0, 0, 0, 1, 1, 1, 2, 2, 2]),
      makeMockTrack('LeftLeg.quaternion', [0, 0.5, 1], [0, 0, 0, 1, 1, 1, 0, 0, 0, 0])
    ];
    const clip = { name: 'Eating', duration: 1, tracks } as const;

    const result = createSubClip(clip as never, 'Filtered', 0, 0.5);

    expect(result.tracks).toHaveLength(0);
  });

  it('keeps head bone tracks and filters non-head tracks', () => {
    const tracks = [
      makeMockTrack('Head.position', [0, 0.5, 1], [0, 0, 0, 1, 1, 1, 2, 2, 2]),
      makeMockTrack('Tail.quaternion', [0, 0.5, 1], [0, 0, 0, 1, 1, 1, 0, 0, 0, 0]),
      makeMockTrack('Neck1.scale', [0, 0.5, 1], [1, 1, 1, 1, 1, 1, 1, 1, 1])
    ];
    const clip = { name: 'Eating', duration: 1, tracks } as const;

    const result = createSubClip(clip as never, 'HeadOnly', 0, 0.5);

    expect(result.tracks).toHaveLength(2);
    expect(result.tracks[0].name).toBe('Head.position');
    expect(result.tracks[1].name).toBe('Neck1.scale');
  });

  it('bone filter is case-sensitive', () => {
    const tracks = [
      makeMockTrack('HEAD.position', [0, 0.5, 1], [0, 0, 0, 1, 1, 1, 2, 2, 2]),
      makeMockTrack('Skull.scale', [0, 0.5, 1], [1, 1, 1, 1, 1, 1, 1, 1, 1])
    ];
    const clip = { name: 'Eating', duration: 1, tracks } as const;

    const result = createSubClip(clip as never, 'CaseSensitive', 0, 0.5);

    expect(result.tracks).toHaveLength(0);
  });

  it('keeps Ear bone tracks', () => {
    const tracks = [
      makeMockTrack('Ear1.L.position', [0, 0.5, 1], [0, 0, 0, 1, 1, 1, 2, 2, 2]),
      makeMockTrack('Ear4.R.quaternion', [0, 0.5, 1], [0, 0, 0, 1, 1, 1, 0, 0, 0, 0])
    ];
    const clip = { name: 'Eating', duration: 1, tracks } as const;

    const result = createSubClip(clip as never, 'EarTracks', 0, 0.5);

    expect(result.tracks).toHaveLength(2);
  });
});
