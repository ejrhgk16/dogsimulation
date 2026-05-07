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
  AnimationMixer: vi.fn().mockImplementation(() => mockMixer)
}));

import { loadModel } from '../../src/runtime/modelLoader';

describe('loadModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a Promise', () => {
    // Make the load callback never fire (promise stays pending)
    mockLoad.mockImplementation(() => {
      // no-op — never calls any callback
    });
    const result = loadModel('/models/ShibaInu.gltf');
    expect(result).toBeInstanceOf(Promise);
  });

  it('resolves with LoadedModel on success', async () => {
    const fakeGltf = { scene: mockGroup, animations: [] };
    mockLoad.mockImplementation((_path: string, onLoad: (gltf: unknown) => void) => {
      onLoad(fakeGltf);
    });

    const result = await loadModel('/models/ShibaInu.gltf');
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

    const result = await loadModel('/models/ShibaInu.gltf');
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

    await loadModel('/models/ShibaInu.gltf');
    expect(debugSpy).toHaveBeenCalledWith('Model animations: [Walk, Idle]');
    debugSpy.mockRestore();
  });

  it('logs no animations when gltf has no clips', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const fakeGltf = { scene: mockGroup, animations: [] };
    mockLoad.mockImplementation((_path: string, onLoad: (gltf: unknown) => void) => {
      onLoad(fakeGltf);
    });

    await loadModel('/models/ShibaInu.gltf');
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

    const result = await loadModel('/models/bad.gltf');
    expect(result).toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });
});
