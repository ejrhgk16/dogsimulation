import { describe, it, expect, vi } from 'vitest';
import { Scene } from 'three';

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn().mockImplementation(() => ({
    load: vi.fn()
  }))
}));

import { createPursuerController } from '../../src/runtime/pursuerController';
import type { MapData } from '../../src/types/map';
import type { PursuerState } from '../../src/types/pursuer';
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

describe('createPursuerController', () => {
  it('returns PursuerController interface with all methods', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createPursuerController(scene, mapData);
    expect(controller).toHaveProperty('updatePursuer');
    expect(controller).toHaveProperty('playAnimation');
    expect(controller).toHaveProperty('setScale');
    expect(controller).toHaveProperty('setRotationSpeed');
    expect(controller).toHaveProperty('setHeadFrameRanges');
    expect(controller).toHaveProperty('getObject');
    expect(controller).toHaveProperty('getLoadedModel');
    expect(typeof controller.updatePursuer).toBe('function');
    expect(typeof controller.playAnimation).toBe('function');
    expect(typeof controller.setScale).toBe('function');
    expect(typeof controller.setRotationSpeed).toBe('function');
    expect(typeof controller.setHeadFrameRanges).toBe('function');
    expect(typeof controller.getObject).toBe('function');
    expect(typeof controller.getLoadedModel).toBe('function');
  });

  it('getObject returns null when no pursuer provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createPursuerController(scene, mapData);
    expect(controller.getObject()).toBeNull();
  });

  it('getLoadedModel returns null when no pursuer provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createPursuerController(scene, mapData);
    expect(controller.getLoadedModel()).toBeNull();
  });

  it('getObject returns an Object3D when pursuer provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const pursuer = makePursuer();
    const controller = createPursuerController(scene, mapData, pursuer);
    expect(controller.getObject()).not.toBeNull();
  });

  it('updatePursuer does not throw when pursuer provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const pursuer = makePursuer();
    const controller = createPursuerController(scene, mapData, pursuer);
    expect(() => controller.updatePursuer(pursuer)).not.toThrow();
  });

  it('playAnimation does not throw with HeadDown', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createPursuerController(scene, mapData);
    expect(() => controller.playAnimation('HeadDown')).not.toThrow();
  });

  it('playAnimation does not throw with HeadBobbing', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createPursuerController(scene, mapData);
    expect(() => controller.playAnimation('HeadBobbing')).not.toThrow();
  });

  it('playAnimation does not throw with HeadRaise', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createPursuerController(scene, mapData);
    expect(() => controller.playAnimation('HeadRaise')).not.toThrow();
  });

  it('playAnimation does not throw with unknown name', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createPursuerController(scene, mapData);
    expect(() => controller.playAnimation('Unknown')).not.toThrow();
  });

  it('playAnimation does not throw with all head animation names when pursuer provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const pursuer = makePursuer();
    const controller = createPursuerController(scene, mapData, pursuer);
    expect(() => controller.playAnimation('HeadDown')).not.toThrow();
    expect(() => controller.playAnimation('HeadBobbing')).not.toThrow();
    expect(() => controller.playAnimation('HeadRaise')).not.toThrow();
  });

  it('setHeadFrameRanges does not throw without pursuer', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createPursuerController(scene, mapData);
    expect(() => controller.setHeadFrameRanges(0, 10, 10, 60, 65, 70)).not.toThrow();
  });

  it('setHeadFrameRanges does not throw with pursuer provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const pursuer = makePursuer();
    const controller = createPursuerController(scene, mapData, pursuer);
    expect(() => controller.setHeadFrameRanges(0, 10, 10, 60, 65, 70)).not.toThrow();
  });

  it('setScale does not throw when pursuer provided', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const pursuer = makePursuer();
    const controller = createPursuerController(scene, mapData, pursuer);
    expect(() => controller.setScale(0.5)).not.toThrow();
  });

  it('setScale does not throw without pursuer', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createPursuerController(scene, mapData);
    expect(() => controller.setScale(0.5)).not.toThrow();
  });

  it('setScale accepts edge values 0.1 and 1.0', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const pursuer = makePursuer();
    const controller = createPursuerController(scene, mapData, pursuer);
    expect(() => controller.setScale(0.1)).not.toThrow();
    expect(() => controller.setScale(1.0)).not.toThrow();
  });

  it('setRotationSpeed does not throw', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const controller = createPursuerController(scene, mapData);
    expect(() => controller.setRotationSpeed(4.0)).not.toThrow();
  });

  it('multiple updatePursuer calls do not throw', () => {
    const scene = new Scene();
    const mapData = makeMapData();
    const pursuer = makePursuer();
    const controller = createPursuerController(scene, mapData, pursuer);
    expect(() => {
      controller.updatePursuer(pursuer);
      controller.updatePursuer(pursuer);
      controller.updatePursuer(pursuer);
    }).not.toThrow();
  });
});
