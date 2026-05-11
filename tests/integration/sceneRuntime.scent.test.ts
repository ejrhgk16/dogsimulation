import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn().mockImplementation(() => ({
    load: vi.fn()
  }))
}));

vi.mock('three', async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  return {
    ...actual,
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
      domElement: document.createElement('canvas')
    }))
  };
});

import { SceneRuntime } from '../../src/runtime/sceneRuntime';
import { Pursued } from '../../src/services/Pursued';
import { generateMap } from '../../src/services/mapService';
import { defaultSceneConfig } from '../../src/config/sceneConfig';
import {
  setTauDecayMultiplier,
  getEmitRateMultiplier,
  setEmitRateMultiplier
} from '../../src/config/scentConfig';
import { ANIMAL_HEIGHT_OFFSET } from '../../src/config/animalConfig';

describe('sceneRuntime scent integration', () => {
  describe('sceneRuntime animal rotation', () => {
    it('updateAnimal does not throw when animal provided', () => {
      const canvas = document.createElement('canvas');
      const mapData = generateMap(defaultSceneConfig.mapConfig);
      const animal = new Pursued('a1', 'dog', 0, 0, mapData);
      const runtime = new SceneRuntime(canvas, mapData, [], [animal]);
      expect(() => {
        runtime.start();
        runtime.stop();
      }).not.toThrow();
    });

    it('updateAnimal handles direction change without error', () => {
      const canvas = document.createElement('canvas');
      const mapData = generateMap(defaultSceneConfig.mapConfig);
      const animal = new Pursued('a1', 'dog', 0, 0, mapData);
      const runtime = new SceneRuntime(canvas, mapData, [], [animal]);
      animal.directionX = 0;
      animal.directionY = -1;
      expect(() => {
        runtime.start();
        runtime.stop();
      }).not.toThrow();
    });

    it('updateAnimal works with fallback mesh when no model loaded', () => {
      const canvas = document.createElement('canvas');
      const mapData = generateMap(defaultSceneConfig.mapConfig);
      const animal = new Pursued('a1', 'pig', 0, 0, mapData);
      const runtime = new SceneRuntime(canvas, mapData, [], [animal]);
      expect(() => {
        runtime.start();
        runtime.stop();
      }).not.toThrow();
    });

    it('updateAnimal positions fallback at height using scale-based offset', () => {
      const canvas = document.createElement('canvas');
      const mapData = generateMap(defaultSceneConfig.mapConfig);
      const animal = new Pursued('a1', 'dog', 0, 0, mapData);
      expect(animal.height - ANIMAL_HEIGHT_OFFSET).toBeGreaterThanOrEqual(0);
      const runtime = new SceneRuntime(canvas, mapData, [], [animal]);
      expect(() => {
        runtime.start();
        runtime.stop();
      }).not.toThrow();
    });
  });
});

describe('sceneRuntime camera controls', () => {
  it('exposes resetCamera method', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = new SceneRuntime(canvas, mapData);
    expect(runtime).toHaveProperty('resetCamera');
    expect(typeof runtime.resetCamera).toBe('function');
  });

  it('resetCamera does not throw', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = new SceneRuntime(canvas, mapData);
    expect(() => runtime.resetCamera()).not.toThrow();
  });

  it('start does not throw after resetCamera', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = new SceneRuntime(canvas, mapData);
    runtime.resetCamera();
    expect(() => runtime.start()).not.toThrow();
    runtime.stop();
  });

  it('calling resetCamera multiple times does not throw', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = new SceneRuntime(canvas, mapData);
    runtime.resetCamera();
    runtime.resetCamera();
    expect(() => runtime.start()).not.toThrow();
    runtime.stop();
  });
});

describe('sceneRuntime setAnimalScale', () => {
  it('exposes setAnimalScale method', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = new SceneRuntime(canvas, mapData);
    expect(runtime).toHaveProperty('setAnimalScale');
    expect(typeof runtime.setAnimalScale).toBe('function');
  });

  it('setAnimalScale does not throw with animal provided', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const animal = new Pursued('a1', 'dog', 0, 0, mapData);
    const runtime = new SceneRuntime(canvas, mapData, [], [animal]);
    expect(() => runtime.setAnimalScale(animal.id, 0.5)).not.toThrow();
  });

  it('setAnimalScale does not throw without animal', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = new SceneRuntime(canvas, mapData);
    expect(() => runtime.setAnimalScale('none', 0.5)).not.toThrow();
  });

  it('setAnimalScale accepts value 0.1 and 1.0 edge cases', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const animal = new Pursued('a1', 'dog', 0, 0, mapData);
    const runtime = new SceneRuntime(canvas, mapData, [], [animal]);
    expect(() => runtime.setAnimalScale(animal.id, 0.1)).not.toThrow();
    expect(() => runtime.setAnimalScale(animal.id, 1.0)).not.toThrow();
  });

  it('setAnimalScale does not throw without animal and with pursuers', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = new SceneRuntime(canvas, mapData);
    expect(() => runtime.setAnimalScale('none', 0.5)).not.toThrow();
  });
});

describe('sceneRuntime setScentDecayRate', () => {
  beforeEach(() => {
    setTauDecayMultiplier(1.0);
  });

  it('exposes setScentDecayRate method', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = new SceneRuntime(canvas, mapData);
    expect(runtime).toHaveProperty('setScentDecayRate');
    expect(typeof runtime.setScentDecayRate).toBe('function');
  });

  it('setScentDecayRate does not throw', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = new SceneRuntime(canvas, mapData);
    expect(() => runtime.setScentDecayRate(2.0)).not.toThrow();
  });

  it('setScentDecayRate affects emitted tauDecay via config', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = new SceneRuntime(canvas, mapData);
    runtime.setScentDecayRate(3.0);
    expect(setTauDecayMultiplier).toBeDefined();
    const animal = new Pursued('a1', 'dog', 0, 0, mapData);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    animal.emitScent(100);
    // Math.random=0.5 → base tauDecay = 8000, *3.0 multiplier = 24000
    expect(animal.trailPoints[0].tauDecay).toBeCloseTo(24000, 5);
  });
});

describe('sceneRuntime setEmitRate', () => {
  beforeEach(() => {
    setEmitRateMultiplier(1.0);
  });

  it('exposes setEmitRate method', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = new SceneRuntime(canvas, mapData);
    expect(runtime).toHaveProperty('setEmitRate');
    expect(typeof runtime.setEmitRate).toBe('function');
  });

  it('setEmitRate does not throw', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = new SceneRuntime(canvas, mapData);
    expect(() => runtime.setEmitRate(2.0)).not.toThrow();
  });

  it('setEmitRate updates config multiplier', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = new SceneRuntime(canvas, mapData);
    runtime.setEmitRate(0.5);
    expect(getEmitRateMultiplier()).toBe(0.5);
  });
});
