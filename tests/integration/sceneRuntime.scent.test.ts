import { describe, it, expect, vi } from 'vitest';

// Mock WebGLRenderer — jsdom has no WebGL context
vi.mock('three', async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  return {
    ...actual,
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn()
    }))
  };
});

import { createSceneRuntime } from '../../src/runtime/sceneRuntime';
import type { ScentWorldState } from '../../src/types/scent';
import { generateMap } from '../../src/services/mapService';
import { defaultSceneConfig } from '../../src/config/sceneConfig';
import { emitTrailPointOnMove } from '../../src/services/scentService';
import { getAnimalProfile } from '../../src/config/scentConfig';

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
    // An expired point: t=0, now=30000 → age=30000 > DEFAULT maxTrailAge=25000
    scentState.trailPoints.push({
      animalId: 'test',
      animalType: 'dog',
      x: 0,
      y: 0,
      height: 0,
      t: 0,
      baseIntensity: 1.0
    });
    const runtime = createSceneRuntime(canvas, mapData, scentState);
    runtime.updateScent(30000);
    expect(scentState.trailPoints).toHaveLength(0);
  });

  it('keeps fresh trail points after updateScent', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const scentState: ScentWorldState = { trailPoints: [], emitters: new Map() };
    // Fresh point: t=9000, now=10000 → age=1000 <= maxTrailAge=25000
    scentState.trailPoints.push({
      animalId: 'test',
      animalType: 'dog',
      x: 0,
      y: 0,
      height: 0,
      t: 9000,
      baseIntensity: 1.0
    });
    const runtime = createSceneRuntime(canvas, mapData, scentState);
    runtime.updateScent(10000);
    expect(scentState.trailPoints).toHaveLength(1);
  });

  it('keeps point with per-point tauDecay after updateScent', () => {
    const canvas = document.createElement('canvas');
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const scentState: ScentWorldState = { trailPoints: [], emitters: new Map() };
    // Point with explicit tauDecay: age=1000 <= maxTrailAge=25000
    scentState.trailPoints.push({
      animalId: 'test',
      animalType: 'dog',
      x: 0,
      y: 0,
      height: 0,
      t: 9000,
      baseIntensity: 1.0,
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
});
