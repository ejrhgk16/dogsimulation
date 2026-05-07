import { describe, it, expect } from 'vitest';
import {
  ANIMAL_HEIGHT_OFFSET,
  ANIMAL_SCALE,
  getAnimalSpeed,
  setAnimalSpeed
} from '../../src/config/animalConfig';

describe('animalConfig', () => {
  it('ANIMAL_HEIGHT_OFFSET is derived from ANIMAL_SCALE', () => {
    expect(ANIMAL_HEIGHT_OFFSET).toBeCloseTo(ANIMAL_SCALE * 1.25);
  });

  it('getAnimalSpeed returns default 5.0', () => {
    expect(getAnimalSpeed()).toBeCloseTo(5.0);
  });

  it('setAnimalSpeed updates value returned by getAnimalSpeed', () => {
    setAnimalSpeed(10.0);
    expect(getAnimalSpeed()).toBeCloseTo(10.0);
    setAnimalSpeed(5.0);
    expect(getAnimalSpeed()).toBeCloseTo(5.0);
  });
});
