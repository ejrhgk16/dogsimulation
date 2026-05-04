import { describe, it, expect } from 'vitest';
import { defaultSceneConfig } from '../../src/config/sceneConfig';

describe('sceneConfig integration', () => {
  it('exports correct default values', () => {
    expect(defaultSceneConfig.gravity).toBe(-9.81);
    expect(defaultSceneConfig.groundSize).toBe(20);
  });

  it('has no dog domain fields', () => {
    const keys = Object.keys(defaultSceneConfig);
    expect(keys).not.toContain('initialDogPosition');
    expect(keys).not.toContain('initialDogSpeed');
    expect(keys).toEqual(['gravity', 'groundSize']);
  });
});
