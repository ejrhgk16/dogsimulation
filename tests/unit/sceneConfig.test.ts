import { describe, it, expect } from 'vitest';
import { HEAD_DOWN_MAX_TERRAIN, defaultSceneConfig } from '../../src/config/sceneConfig';

describe('sceneConfig', () => {
  it('exports HEAD_DOWN_MAX_TERRAIN constant with value 0.5', () => {
    expect(HEAD_DOWN_MAX_TERRAIN).toBe(0.5);
  });

  it('defaultSceneConfig remains unchanged', () => {
    expect(defaultSceneConfig).toHaveProperty('gravity', -9.81);
    expect(defaultSceneConfig).toHaveProperty('groundSize', 50);
  });
});
