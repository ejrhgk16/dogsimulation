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
vi.mock('three', () => ({
  Group: vi.fn().mockImplementation(() => mockGroup)
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
