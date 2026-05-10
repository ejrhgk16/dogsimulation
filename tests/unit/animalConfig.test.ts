import { describe, it, expect } from 'vitest';
import { ANIMAL_HEIGHT_OFFSET, ANIMAL_SCALE, ANIMAL_TYPES } from '../../src/config/animalConfig';

describe('animalConfig', () => {
  it('ANIMAL_HEIGHT_OFFSET is derived from ANIMAL_SCALE', () => {
    expect(ANIMAL_HEIGHT_OFFSET).toBeCloseTo(ANIMAL_SCALE * 1.25);
  });

  it('dog has headFrameRanges with correct values', () => {
    const dog = ANIMAL_TYPES['dog'];
    expect(dog.headFrameRanges).toBeDefined();
    expect(dog.headFrameRanges!.downStart).toBe(0);
    expect(dog.headFrameRanges!.downEnd).toBe(20);
    expect(dog.headFrameRanges!.bobStart).toBe(20);
    expect(dog.headFrameRanges!.bobEnd).toBe(60);
    expect(dog.headFrameRanges!.raiseStart).toBe(60);
    expect(dog.headFrameRanges!.raiseEnd).toBe(80);
  });

  it('alpaca does not have headFrameRanges', () => {
    expect(ANIMAL_TYPES['alpaca'].headFrameRanges).toBeUndefined();
  });

  it('pig does not have headFrameRanges', () => {
    expect(ANIMAL_TYPES['pig'].headFrameRanges).toBeUndefined();
  });

  it('dog has rotationSpeed of 8.0', () => {
    expect(ANIMAL_TYPES['dog'].rotationSpeed).toBe(8.0);
  });

  it('alpaca has rotationSpeed of 8.0', () => {
    expect(ANIMAL_TYPES['alpaca'].rotationSpeed).toBe(8.0);
  });

  it('pig has rotationSpeed of 8.0', () => {
    expect(ANIMAL_TYPES['pig'].rotationSpeed).toBe(8.0);
  });
});
