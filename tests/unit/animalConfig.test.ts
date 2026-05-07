import { describe, it, expect } from 'vitest';
import { ANIMAL_HEIGHT_OFFSET, ANIMAL_SCALE } from '../../src/config/animalConfig';

describe('animalConfig', () => {
  it('ANIMAL_HEIGHT_OFFSET is derived from ANIMAL_SCALE', () => {
    expect(ANIMAL_HEIGHT_OFFSET).toBeCloseTo(ANIMAL_SCALE * 1.25);
  });
});
