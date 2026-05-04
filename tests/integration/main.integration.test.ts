import { describe, it, expect } from 'vitest';
import { defaultSceneConfig } from '../../src/config/sceneConfig';
import { defaultMapConfig } from '../../src/config/mapConfig';

describe('sceneConfig integration', () => {
  it('exports correct default values', () => {
    expect(defaultSceneConfig.gravity).toBe(-9.81);
    expect(defaultSceneConfig.groundSize).toBe(50);
  });

  it('has no dog domain fields', () => {
    const keys = Object.keys(defaultSceneConfig);
    expect(keys).not.toContain('initialDogPosition');
    expect(keys).not.toContain('initialDogSpeed');
  });

  it('includes mapConfig with defaults', () => {
    expect(defaultSceneConfig.mapConfig).toBe(defaultMapConfig);
    expect(defaultSceneConfig.mapConfig.width).toBe(50);
    expect(defaultSceneConfig.mapConfig.depth).toBe(30);
    expect(defaultSceneConfig.mapConfig.cellSize).toBe(1);
  });
});
