import { describe, it, expect, vi } from 'vitest';
import { Scene } from 'three';

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn().mockImplementation(() => ({
    load: vi.fn()
  }))
}));

import { createAnimalController } from '../../src/runtime/animalController';
import type { MapData } from '../../src/types/map';
import type { AnimalState } from '../../src/types/animal';
import { generateMap } from '../../src/services/mapService';
import { createAnimal } from '../../src/services/animalService';
import { defaultSceneConfig } from '../../src/config/sceneConfig';

function makeMapData(): MapData {
  return generateMap(defaultSceneConfig.mapConfig);
}

function makeAnimal(id = 'a1', type = 'dog', x = 0, y = 0): AnimalState {
  return createAnimal(id, type, x, y, makeMapData());
}

describe('createAnimalController', () => {
  it('returns AnimalController interface with all methods', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createAnimalController(scene, mapData);
    expect(controller).toHaveProperty('updateAnimal');
    expect(controller).toHaveProperty('playAnimation');
    expect(controller).toHaveProperty('setAnimalScale');
    expect(controller).toHaveProperty('setRotationSpeed');
    expect(controller).toHaveProperty('setHeadFrameRanges');
    expect(controller).toHaveProperty('getAnimalObject');
    expect(controller).toHaveProperty('getAnimalLoadedModel');
    expect(typeof controller.updateAnimal).toBe('function');
    expect(typeof controller.playAnimation).toBe('function');
    expect(typeof controller.setAnimalScale).toBe('function');
    expect(typeof controller.setRotationSpeed).toBe('function');
    expect(typeof controller.setHeadFrameRanges).toBe('function');
    expect(typeof controller.getAnimalObject).toBe('function');
    expect(typeof controller.getAnimalLoadedModel).toBe('function');
  });

  it('getAnimalObject returns null when no animal provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createAnimalController(scene, mapData);
    expect(controller.getAnimalObject()).toBeNull();
  });

  it('getAnimalLoadedModel returns null when no animal provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createAnimalController(scene, mapData);
    expect(controller.getAnimalLoadedModel()).toBeNull();
  });

  it('getAnimalObject returns an Object3D when animal provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const animal = makeAnimal();
    const controller = createAnimalController(scene, mapData, animal);
    expect(controller.getAnimalObject()).not.toBeNull();
  });

  it('adds fallback mesh to scene when animal provided', () => {
    const scene = new Scene();
    const initialCount = scene.children.length;
    const mapData = makeMapData();
    const animal = makeAnimal();
    createAnimalController(scene, mapData, animal);
    // A mesh should have been added
    expect(scene.children.length).toBeGreaterThan(initialCount);
  });

  it('updateAnimal does not throw when animal provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const animal = makeAnimal();
    const controller = createAnimalController(scene, mapData, animal);
    expect(() => controller.updateAnimal(animal)).not.toThrow();
  });

  it('updateAnimal handles direction change without error', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const animal = makeAnimal();
    const controller = createAnimalController(scene, mapData, animal);
    animal.directionX = 0;
    animal.directionY = -1;
    expect(() => controller.updateAnimal(animal)).not.toThrow();
  });

  it('setAnimalScale does not throw when animal provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const animal = makeAnimal();
    const controller = createAnimalController(scene, mapData, animal);
    expect(() => controller.setAnimalScale(0.5)).not.toThrow();
  });

  it('setAnimalScale does not throw without animal', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createAnimalController(scene, mapData);
    expect(() => controller.setAnimalScale(0.5)).not.toThrow();
  });

  it('setAnimalScale accepts edge values 0.1 and 1.0', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const animal = makeAnimal();
    const controller = createAnimalController(scene, mapData, animal);
    expect(() => controller.setAnimalScale(0.1)).not.toThrow();
    expect(() => controller.setAnimalScale(1.0)).not.toThrow();
  });

  it('setRotationSpeed does not throw', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createAnimalController(scene, mapData);
    expect(() => controller.setRotationSpeed(4.0)).not.toThrow();
  });

  it('playAnimation does not throw with valid name (no animal)', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createAnimalController(scene, mapData);
    expect(() => controller.playAnimation('HeadDown')).not.toThrow();
  });

  it('playAnimation does not throw with unknown name', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createAnimalController(scene, mapData);
    expect(() => controller.playAnimation('Unknown')).not.toThrow();
  });

  it('playAnimation does not throw when animal provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const animal = makeAnimal();
    const controller = createAnimalController(scene, mapData, animal);
    expect(() => controller.playAnimation('HeadDown')).not.toThrow();
  });

  it('playAnimation does not throw with all head animation names', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const animal = makeAnimal();
    const controller = createAnimalController(scene, mapData, animal);
    expect(() => controller.playAnimation('HeadDown')).not.toThrow();
    expect(() => controller.playAnimation('HeadBobbing')).not.toThrow();
    expect(() => controller.playAnimation('HeadRaise')).not.toThrow();
  });

  it('playAnimation does nothing for non-dog animal', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const animal = makeAnimal('a1', 'pig');
    const controller = createAnimalController(scene, mapData, animal);
    expect(() => controller.playAnimation('HeadDown')).not.toThrow();
    expect(() => controller.playAnimation('HeadBobbing')).not.toThrow();
    expect(() => controller.playAnimation('HeadRaise')).not.toThrow();
  });

  it('setHeadFrameRanges does not throw (no animal)', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createAnimalController(scene, mapData);
    expect(() => controller.setHeadFrameRanges(0, 10, 10, 60, 65, 70)).not.toThrow();
  });

  it('setHeadFrameRanges does not throw with animal provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const animal = makeAnimal();
    const controller = createAnimalController(scene, mapData, animal);
    expect(() => controller.setHeadFrameRanges(0, 10, 10, 60, 65, 70)).not.toThrow();
  });

  it('setHeadFrameRanges does nothing for non-dog animal', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const animal = makeAnimal('a1', 'pig');
    const controller = createAnimalController(scene, mapData, animal);
    expect(() => controller.setHeadFrameRanges(0, 10, 10, 60, 65, 70)).not.toThrow();
  });

  it('playAnimation does nothing for alpaca animal', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const animal = makeAnimal('a1', 'alpaca', 0, 0);
    const controller = createAnimalController(scene, mapData, animal);
    expect(() => controller.playAnimation('HeadDown')).not.toThrow();
    expect(() => controller.playAnimation('HeadBobbing')).not.toThrow();
    expect(() => controller.playAnimation('HeadRaise')).not.toThrow();
  });

  it('setHeadFrameRanges does nothing for alpaca animal', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const animal = makeAnimal('a1', 'alpaca', 0, 0);
    const controller = createAnimalController(scene, mapData, animal);
    expect(() => controller.setHeadFrameRanges(0, 10, 10, 60, 65, 70)).not.toThrow();
  });

  it('multiple updateAnimal calls do not throw', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const animal = makeAnimal();
    const controller = createAnimalController(scene, mapData, animal);
    expect(() => {
      controller.updateAnimal(animal);
      controller.updateAnimal(animal);
      controller.updateAnimal(animal);
    }).not.toThrow();
  });
});
