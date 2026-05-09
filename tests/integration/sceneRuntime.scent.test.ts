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

import { createSceneRuntime } from '../../src/runtime/sceneRuntime';
import type { ScentWorldState } from '../../src/types/scent';
import { generateMap } from '../../src/services/mapService';
import { createAnimal } from '../../src/services/animalService';
import { defaultSceneConfig } from '../../src/config/sceneConfig';
import { emitTrailPointOnMove } from '../../src/services/scentService';
import {
  getAnimalProfile,
  setTauDecayMultiplier,
  getEmitRateMultiplier,
  setEmitRateMultiplier
} from '../../src/config/scentConfig';
import { ANIMAL_HEIGHT_OFFSET } from '../../src/config/animalConfig';

describe('sceneRuntime scent integration', () => {
  it('returns updateScent function when no scentState provided', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = createSceneRuntime(canvas, mapData);
    expect(runtime).toHaveProperty('updateScent');
    expect(typeof runtime.updateScent).toBe('function');
  });

  it('returns updateScent function when scentState provided', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const scentState: ScentWorldState = { trailPoints: [], emitters: new Map() };
    const runtime = createSceneRuntime(canvas, mapData, scentState);
    expect(runtime).toHaveProperty('updateScent');
    expect(typeof runtime.updateScent).toBe('function');
  });

  it('updateScent does not throw when no scentState', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = createSceneRuntime(canvas, mapData);
    expect(() => runtime.updateScent(1000)).not.toThrow();
  });

  it('updateScent trims expired trail points when scentState provided', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const scentState: ScentWorldState = { trailPoints: [], emitters: new Map() };
    // An expired point: t=0, no per-point tauDecay → uses params tauDecay=8000, threshold=40000, age=200000 > 40000 → removed
    scentState.trailPoints.push({
      animalId: 'test',
      animalType: 'dog',
      x: 0,
      y: 0,
      height: 0,
      t: 0
    });
    const runtime = createSceneRuntime(canvas, mapData, scentState);
    runtime.updateScent(200000);
    expect(scentState.trailPoints).toHaveLength(0);
  });

  it('keeps fresh trail points after updateScent', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const scentState: ScentWorldState = { trailPoints: [], emitters: new Map() };
    // Fresh point: t=9000, now=10000 → age=1000 <= tauDecay*5=40000
    scentState.trailPoints.push({
      animalId: 'test',
      animalType: 'dog',
      x: 0,
      y: 0,
      height: 0,
      t: 9000
    });
    const runtime = createSceneRuntime(canvas, mapData, scentState);
    runtime.updateScent(10000);
    expect(scentState.trailPoints).toHaveLength(1);
  });

  it('keeps point with per-point tauDecay after updateScent', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const scentState: ScentWorldState = { trailPoints: [], emitters: new Map() };
    // Point with explicit tauDecay=12000 → threshold=60000, age=1000 <= 60000
    scentState.trailPoints.push({
      animalId: 'test',
      animalType: 'dog',
      x: 0,
      y: 0,
      height: 0,
      t: 9000,
      tauDecay: 12000
    });
    const runtime = createSceneRuntime(canvas, mapData, scentState);
    runtime.updateScent(10000);
    expect(scentState.trailPoints).toHaveLength(1);
    expect(scentState.trailPoints[0].tauDecay).toBe(12000);
  });

  it('handles empty trailPoints in updateScent', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const scentState: ScentWorldState = { trailPoints: [], emitters: new Map() };
    const runtime = createSceneRuntime(canvas, mapData, scentState);
    expect(() => runtime.updateScent(5000)).not.toThrow();
  });

  describe('sceneRuntime animal rotation', () => {
    it('updateAnimal does not throw when animal provided', () => {
      const canvas = document.createElement('canvas');
      const mapData = generateMap(defaultSceneConfig.mapConfig);
      const animal = createAnimal('a1', 'dog', 0, 0, mapData);
      const runtime = createSceneRuntime(canvas, mapData, undefined, animal);
      expect(() => runtime.updateAnimal(animal)).not.toThrow();
    });

    it('updateAnimal handles direction change without error', () => {
      const canvas = document.createElement('canvas');
      const mapData = generateMap(defaultSceneConfig.mapConfig);
      const animal = createAnimal('a1', 'dog', 0, 0, mapData);
      const runtime = createSceneRuntime(canvas, mapData, undefined, animal);
      animal.directionX = 0;
      animal.directionY = -1;
      expect(() => runtime.updateAnimal(animal)).not.toThrow();
    });

    it('updateAnimal works with fallback mesh when no model loaded', () => {
      const canvas = document.createElement('canvas');
      const mapData = generateMap(defaultSceneConfig.mapConfig);
      const animal = createAnimal('a1', 'pig', 0, 0, mapData);
      const runtime = createSceneRuntime(canvas, mapData, undefined, animal);
      expect(() => runtime.updateAnimal(animal)).not.toThrow();
    });

    it('updateAnimal positions fallback at height using scale-based offset', () => {
      const canvas = document.createElement('canvas');
      const mapData = generateMap(defaultSceneConfig.mapConfig);
      const animal = createAnimal('a1', 'dog', 0, 0, mapData);
      // height should include ANIMAL_HEIGHT_OFFSET on top of terrain height
      expect(animal.height - ANIMAL_HEIGHT_OFFSET).toBeGreaterThanOrEqual(0);
      const runtime = createSceneRuntime(canvas, mapData, undefined, animal);
      expect(() => runtime.updateAnimal(animal)).not.toThrow();
    });
  });

  it('emitTrailPointOnMove is importable and callable', () => {
    const scentState: ScentWorldState = { trailPoints: [], emitters: new Map() };
    const profile = getAnimalProfile('dog');
    expect(() =>
      emitTrailPointOnMove(scentState, 'a1', 'dog', 0, 0, 0, 100, profile)
    ).not.toThrow();
    expect(scentState.emitters.has('a1')).toBe(true);
    // distanceSinceLast initialized to 0
    expect(scentState.emitters.get('a1')!.distanceSinceLast).toBe(0);
  });
});

describe('sceneRuntime camera controls', () => {
  it('exposes resetCamera method', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = createSceneRuntime(canvas, mapData);
    expect(runtime).toHaveProperty('resetCamera');
    expect(typeof runtime.resetCamera).toBe('function');
  });

  it('resetCamera does not throw', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = createSceneRuntime(canvas, mapData);
    expect(() => runtime.resetCamera()).not.toThrow();
  });

  it('start does not throw after resetCamera', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = createSceneRuntime(canvas, mapData);
    runtime.resetCamera();
    expect(() => runtime.start()).not.toThrow();
    runtime.stop();
  });

  it('calling resetCamera multiple times does not throw', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = createSceneRuntime(canvas, mapData);
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
    const runtime = createSceneRuntime(canvas, mapData);
    expect(runtime).toHaveProperty('setAnimalScale');
    expect(typeof runtime.setAnimalScale).toBe('function');
  });

  it('setAnimalScale does not throw with animal provided', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const animal = createAnimal('a1', 'dog', 0, 0, mapData);
    const runtime = createSceneRuntime(canvas, mapData, undefined, animal);
    expect(() => runtime.setAnimalScale(0.5)).not.toThrow();
  });

  it('setAnimalScale does not throw without animal', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = createSceneRuntime(canvas, mapData);
    expect(() => runtime.setAnimalScale(0.5)).not.toThrow();
  });

  it('setAnimalScale accepts value 0.1 and 1.0 edge cases', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const animal = createAnimal('a1', 'dog', 0, 0, mapData);
    const runtime = createSceneRuntime(canvas, mapData, undefined, animal);
    expect(() => runtime.setAnimalScale(0.1)).not.toThrow();
    expect(() => runtime.setAnimalScale(1.0)).not.toThrow();
  });

  it('setAnimalScale does not throw with scentState present', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const animal = createAnimal('a1', 'dog', 0, 0, mapData);
    const scentState: ScentWorldState = { trailPoints: [], emitters: new Map() };
    const runtime = createSceneRuntime(canvas, mapData, scentState, animal);
    expect(() => runtime.setAnimalScale(0.5)).not.toThrow();
  });

  it('setAnimalScale does not throw with scentState and scale 0.1', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const animal = createAnimal('a1', 'dog', 0, 0, mapData);
    const scentState: ScentWorldState = { trailPoints: [], emitters: new Map() };
    const runtime = createSceneRuntime(canvas, mapData, scentState, animal);
    expect(() => runtime.setAnimalScale(0.1)).not.toThrow();
  });

  it('setAnimalScale does not throw with scentState and no animal', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const scentState: ScentWorldState = { trailPoints: [], emitters: new Map() };
    const runtime = createSceneRuntime(canvas, mapData, scentState);
    expect(() => runtime.setAnimalScale(0.5)).not.toThrow();
  });
});

describe('sceneRuntime setScentDecayRate', () => {
  beforeEach(() => {
    setTauDecayMultiplier(1.0);
  });

  it('exposes setScentDecayRate method', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = createSceneRuntime(canvas, mapData);
    expect(runtime).toHaveProperty('setScentDecayRate');
    expect(typeof runtime.setScentDecayRate).toBe('function');
  });

  it('setScentDecayRate does not throw', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = createSceneRuntime(canvas, mapData);
    expect(() => runtime.setScentDecayRate(2.0)).not.toThrow();
  });

  it('setScentDecayRate affects emitted tauDecay via config', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = createSceneRuntime(canvas, mapData);
    runtime.setScentDecayRate(3.0);
    expect(setTauDecayMultiplier).toBeDefined();
    // Verify via emitTrailPointOnMove that the multiplier is applied
    const scentState: ScentWorldState = { trailPoints: [], emitters: new Map() };
    const profile = getAnimalProfile('dog');
    // mock Math.random for deterministic tauDecay
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    emitTrailPointOnMove(scentState, 'a1', 'dog', 0, 0, 0, 100, profile);
    emitTrailPointOnMove(scentState, 'a1', 'dog', 0.6, 0, 0, 200, profile);
    // base 8000 * 3.0 = 24000
    expect(scentState.trailPoints[0].tauDecay).toBeCloseTo(24000, 5);
  });
});

describe('sceneRuntime setEmitRate', () => {
  beforeEach(() => {
    setEmitRateMultiplier(1.0);
  });

  it('exposes setEmitRate method', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = createSceneRuntime(canvas, mapData);
    expect(runtime).toHaveProperty('setEmitRate');
    expect(typeof runtime.setEmitRate).toBe('function');
  });

  it('setEmitRate does not throw', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = createSceneRuntime(canvas, mapData);
    expect(() => runtime.setEmitRate(2.0)).not.toThrow();
  });

  it('setEmitRate updates config multiplier', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = createSceneRuntime(canvas, mapData);
    runtime.setEmitRate(0.5);
    expect(getEmitRateMultiplier()).toBe(0.5);
  });
});

describe('sceneRuntime setHeadFrameRanges', () => {
  it('exposes setHeadFrameRanges method', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = createSceneRuntime(canvas, mapData);
    expect(runtime).toHaveProperty('setHeadFrameRanges');
    expect(typeof runtime.setHeadFrameRanges).toBe('function');
  });

  it('accepts default values (0, 20, 20, 60, 60, 80) without throw', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = createSceneRuntime(canvas, mapData);
    expect(() => runtime.setHeadFrameRanges(0, 20, 20, 60, 60, 80)).not.toThrow();
  });

  it('accepts default values with animal provided without throw', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const animal = createAnimal('a1', 'dog', 0, 0, mapData);
    const runtime = createSceneRuntime(canvas, mapData, undefined, animal);
    expect(() => runtime.setHeadFrameRanges(0, 20, 20, 60, 60, 80)).not.toThrow();
  });

  it('rejects negative start values gracefully', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = createSceneRuntime(canvas, mapData);
    expect(() => runtime.setHeadFrameRanges(-1, 20, 20, 60, 60, 80)).not.toThrow();
  });
});

describe('sceneRuntime playAnimation', () => {
  it('exposes playAnimation method', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = createSceneRuntime(canvas, mapData);
    expect(runtime).toHaveProperty('playAnimation');
    expect(typeof runtime.playAnimation).toBe('function');
  });

  it('playAnimation does not throw with valid name', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = createSceneRuntime(canvas, mapData);
    expect(() => runtime.playAnimation('HeadDown')).not.toThrow();
  });

  it('playAnimation does not throw with unknown name', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = createSceneRuntime(canvas, mapData);
    expect(() => runtime.playAnimation('Unknown')).not.toThrow();
  });

  it('playAnimation does not throw when animal provided', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const animal = createAnimal('a1', 'dog', 0, 0, mapData);
    const runtime = createSceneRuntime(canvas, mapData, undefined, animal);
    expect(() => runtime.playAnimation('HeadDown')).not.toThrow();
  });

  it('playAnimation does not throw with all head animation names', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const animal = createAnimal('a1', 'dog', 0, 0, mapData);
    const runtime = createSceneRuntime(canvas, mapData, undefined, animal);
    expect(() => runtime.playAnimation('HeadDown')).not.toThrow();
    expect(() => runtime.playAnimation('HeadBobbing')).not.toThrow();
    expect(() => runtime.playAnimation('HeadRaise')).not.toThrow();
  });

  it('HeadDown on flat terrain (height <= HEAD_DOWN_MAX_TERRAIN) does not throw', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    // Flat terrain → animal.height = ANIMAL_HEIGHT_OFFSET → terrainHeight = 0 ≤ 0.5
    const animal = createAnimal('a1', 'dog', 0, 0, mapData);
    const runtime = createSceneRuntime(canvas, mapData, undefined, animal);
    expect(() => runtime.playAnimation('HeadDown')).not.toThrow();
  });

  it('HeadDown on high terrain (height > HEAD_DOWN_MAX_TERRAIN) redirects to HeadRaise without throw', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const animal = createAnimal('a1', 'dog', 0, 0, mapData);
    // Simulate high terrain: set height above HEAD_DOWN_MAX_TERRAIN + ANIMAL_HEIGHT_OFFSET
    animal.height = 1.0;
    const runtime = createSceneRuntime(canvas, mapData, undefined, animal);
    // Should redirect to HeadRaise internally, still no throw
    expect(() => runtime.playAnimation('HeadDown')).not.toThrow();
  });

  it('HeadDown without animal provided does not throw', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const runtime = createSceneRuntime(canvas, mapData);
    expect(() => runtime.playAnimation('HeadDown')).not.toThrow();
  });
});
