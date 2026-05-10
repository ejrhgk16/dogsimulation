import { describe, it, expect, vi } from 'vitest';
import { Scene } from 'three';

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn().mockImplementation(() => ({
    load: vi.fn()
  }))
}));

import { createPursuedController } from '../../src/runtime/pursuedController';
import type { MapData } from '../../src/types/map';
import type { PursuedState } from '../../src/types/pursued';
import { generateMap } from '../../src/services/mapService';
import { defaultSceneConfig } from '../../src/config/sceneConfig';

function makeMapData(): MapData {
  return generateMap(defaultSceneConfig.mapConfig);
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

describe('createPursuedController', () => {
  it('returns PursuedController interface with all expected methods', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createPursuedController(scene, mapData);
    expect(controller).toHaveProperty('updatePursued');
    expect(controller).toHaveProperty('setScale');
    expect(controller).toHaveProperty('setRotationSpeed');
    expect(controller).toHaveProperty('getObject');
    expect(controller).toHaveProperty('getLoadedModel');
    expect(typeof controller.updatePursued).toBe('function');
    expect(typeof controller.setScale).toBe('function');
    expect(typeof controller.setRotationSpeed).toBe('function');
    expect(typeof controller.getObject).toBe('function');
    expect(typeof controller.getLoadedModel).toBe('function');
  });

  it('does NOT have playAnimation or setHeadFrameRanges', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createPursuedController(scene, mapData);
    expect(controller).not.toHaveProperty('playAnimation');
    expect(controller).not.toHaveProperty('setHeadFrameRanges');
  });

  it('getObject returns null when no pursued provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createPursuedController(scene, mapData);
    expect(controller.getObject()).toBeNull();
  });

  it('getLoadedModel returns null when no pursued provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createPursuedController(scene, mapData);
    expect(controller.getLoadedModel()).toBeNull();
  });

  it('getObject returns an Object3D when pursued provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const pursued = makePursued();
    const controller = createPursuedController(scene, mapData, pursued);
    expect(controller.getObject()).not.toBeNull();
  });

  it('adds fallback mesh to scene when pursued provided', () => {
    const scene = new Scene();
    const initialCount = scene.children.length;
    const mapData = makeMapData();
    const pursued = makePursued();
    createPursuedController(scene, mapData, pursued);
    expect(scene.children.length).toBeGreaterThan(initialCount);
  });

  it('updatePursued does not throw when pursued provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const pursued = makePursued();
    const controller = createPursuedController(scene, mapData, pursued);
    expect(() => controller.updatePursued(pursued)).not.toThrow();
  });

  it('updatePursued does not throw without pursued', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createPursuedController(scene, mapData);
    const pursued = makePursued();
    expect(() => controller.updatePursued(pursued)).not.toThrow();
  });

  it('setScale does not throw when pursued provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const pursued = makePursued();
    const controller = createPursuedController(scene, mapData, pursued);
    expect(() => controller.setScale(0.5)).not.toThrow();
  });

  it('setScale does not throw without pursued', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createPursuedController(scene, mapData);
    expect(() => controller.setScale(0.5)).not.toThrow();
  });

  it('setScale accepts edge values 0.1 and 1.0', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const pursued = makePursued();
    const controller = createPursuedController(scene, mapData, pursued);
    expect(() => controller.setScale(0.1)).not.toThrow();
    expect(() => controller.setScale(1.0)).not.toThrow();
  });

  it('setRotationSpeed does not throw', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createPursuedController(scene, mapData);
    expect(() => controller.setRotationSpeed(4.0)).not.toThrow();
  });

  it('multiple updatePursued calls do not throw', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const pursued = makePursued();
    const controller = createPursuedController(scene, mapData, pursued);
    expect(() => {
      controller.updatePursued(pursued);
      controller.updatePursued(pursued);
      controller.updatePursued(pursued);
    }).not.toThrow();
  });
});
