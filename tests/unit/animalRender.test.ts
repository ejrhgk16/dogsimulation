import { describe, it, expect, vi } from 'vitest';
import { Scene } from 'three';

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn().mockImplementation(() => ({
    load: vi.fn()
  }))
}));

import { createAnimalRender } from '../../src/runtime/animalRender';
import type { MapData } from '../../src/types/map';
import type { PursuerState } from '../../src/types/pursuer';
import type { PursuedState } from '../../src/types/pursued';
import { generateMap } from '../../src/services/mapService';
import { defaultSceneConfig } from '../../src/config/sceneConfig';

function makeMapData(): MapData {
  return generateMap(defaultSceneConfig.mapConfig);
}

function makePursuer(id = 'ch1', x = 0, y = 0): PursuerState {
  return {
    id,
    x,
    y,
    height: 0.5,
    speed: 5.0,
    chaseSpeed: 7.0,
    directionX: 1,
    directionY: 0,
    rotationAngle: 0,
    targetId: null
  };
}

function makePursued(id = 'p1', animalType = 'alpaca', x = 0, y = 0): PursuedState {
  return {
    id,
    animalType,
    x,
    y,
    height: 0.5,
    speed: 5.0,
    directionX: 1,
    directionY: 0,
    rotationAngle: 0
  };
}

describe('createAnimalRender', () => {
  it('returns AnimalRender interface with all expected methods (dog type)', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const render = createAnimalRender(scene, mapData, 'dog');
    expect(render).toHaveProperty('update');
    expect(render).toHaveProperty('setScale');
    expect(render).toHaveProperty('setRotationSpeed');
    expect(render).toHaveProperty('getObject');
    expect(render).toHaveProperty('getLoadedModel');
    expect(typeof render.update).toBe('function');
    expect(typeof render.setScale).toBe('function');
    expect(typeof render.setRotationSpeed).toBe('function');
    expect(typeof render.getObject).toBe('function');
    expect(typeof render.getLoadedModel).toBe('function');
  });

  it('returns AnimalRender interface with all expected methods (non-dog type)', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const render = createAnimalRender(scene, mapData, 'alpaca');
    expect(render).toHaveProperty('update');
    expect(render).toHaveProperty('setScale');
    expect(render).toHaveProperty('setRotationSpeed');
    expect(render).toHaveProperty('getObject');
    expect(render).toHaveProperty('getLoadedModel');
    expect(typeof render.update).toBe('function');
    expect(typeof render.setScale).toBe('function');
    expect(typeof render.setRotationSpeed).toBe('function');
    expect(typeof render.getObject).toBe('function');
    expect(typeof render.getLoadedModel).toBe('function');
  });

  it('does NOT have playAnimation or setHeadFrameRanges', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const render = createAnimalRender(scene, mapData, 'alpaca');
    expect(render).not.toHaveProperty('playAnimation');
    expect(render).not.toHaveProperty('setHeadFrameRanges');
  });

  it('getObject returns null when no state provided (dog type)', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const render = createAnimalRender(scene, mapData, 'dog');
    expect(render.getObject()).toBeNull();
  });

  it('getLoadedModel returns null when no state provided (dog type)', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const render = createAnimalRender(scene, mapData, 'dog');
    expect(render.getLoadedModel()).toBeNull();
  });

  it('getObject returns null when no state provided (non-dog type)', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const render = createAnimalRender(scene, mapData, 'alpaca');
    expect(render.getObject()).toBeNull();
  });

  it('getLoadedModel returns null when no state provided (non-dog type)', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const render = createAnimalRender(scene, mapData, 'alpaca');
    expect(render.getLoadedModel()).toBeNull();
  });

  it('getObject returns an Object3D when pursuer state provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const state = makePursuer();
    const render = createAnimalRender(scene, mapData, 'dog', state);
    expect(render.getObject()).not.toBeNull();
  });

  it('getObject returns an Object3D when pursued state provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const state = makePursued();
    const render = createAnimalRender(scene, mapData, 'alpaca', state);
    expect(render.getObject()).not.toBeNull();
  });

  it('adds fallback mesh to scene when state provided', () => {
    const scene = new Scene();
    const initialCount = scene.children.length;
    const mapData = makeMapData();
    const state = makePursued();
    createAnimalRender(scene, mapData, 'alpaca', state);
    expect(scene.children.length).toBeGreaterThan(initialCount);
  });

  it('update does not throw when pursuer state provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const state = makePursuer();
    const render = createAnimalRender(scene, mapData, 'dog', state);
    expect(() => render.update(state)).not.toThrow();
  });

  it('update does not throw when pursued state provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const state = makePursued();
    const render = createAnimalRender(scene, mapData, 'alpaca', state);
    expect(() => render.update(state)).not.toThrow();
  });

  it('update does not throw without state (dog type)', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const render = createAnimalRender(scene, mapData, 'dog');
    const state = makePursuer();
    expect(() => render.update(state)).not.toThrow();
  });

  it('update does not throw without state (non-dog type)', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const render = createAnimalRender(scene, mapData, 'alpaca');
    const state = makePursued();
    expect(() => render.update(state)).not.toThrow();
  });

  it('setScale does not throw when state provided (dog type)', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const state = makePursuer();
    const render = createAnimalRender(scene, mapData, 'dog', state);
    expect(() => render.setScale(0.5)).not.toThrow();
  });

  it('setScale does not throw without state (dog type)', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const render = createAnimalRender(scene, mapData, 'dog');
    expect(() => render.setScale(0.5)).not.toThrow();
  });

  it('setScale accepts edge values 0.1 and 1.0', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const state = makePursuer();
    const render = createAnimalRender(scene, mapData, 'dog', state);
    expect(() => render.setScale(0.1)).not.toThrow();
    expect(() => render.setScale(1.0)).not.toThrow();
  });

  it('setRotationSpeed does not throw', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const render = createAnimalRender(scene, mapData, 'dog');
    expect(() => render.setRotationSpeed(4.0)).not.toThrow();
  });

  it('multiple update calls do not throw (dog type)', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const state = makePursuer();
    const render = createAnimalRender(scene, mapData, 'dog', state);
    expect(() => {
      render.update(state);
      render.update(state);
      render.update(state);
    }).not.toThrow();
  });

  it('multiple update calls do not throw (non-dog type)', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const state = makePursued();
    const render = createAnimalRender(scene, mapData, 'alpaca', state);
    expect(() => {
      render.update(state);
      render.update(state);
      render.update(state);
    }).not.toThrow();
  });
});
