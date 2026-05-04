import { describe, it, expect } from 'vitest';
import { createDog, moveDog, clampSpeed } from '../../src/services/dogService';

describe('createDog', () => {
  it('creates a dog with given properties', () => {
    const dog = createDog('d1', 'Rex', { x: 1, y: 0, z: 2 }, 3);
    expect(dog).toEqual({ id: 'd1', name: 'Rex', position: { x: 1, y: 0, z: 2 }, speed: 3 });
  });
});

describe('moveDog', () => {
  it('moves dog along direction scaled by speed and deltaTime', () => {
    const dog = createDog('d1', 'Rex', { x: 0, y: 0, z: 0 }, 2);
    const moved = moveDog(dog, { x: 1, y: 0, z: 0 }, 0.5);
    expect(moved.position.x).toBeCloseTo(1);
    expect(moved.position.y).toBeCloseTo(0);
    expect(moved.position.z).toBeCloseTo(0);
  });

  it('does not mutate the original dog', () => {
    const dog = createDog('d1', 'Rex', { x: 0, y: 0, z: 0 }, 2);
    moveDog(dog, { x: 1, y: 0, z: 0 }, 1);
    expect(dog.position.x).toBe(0);
  });
});

describe('clampSpeed', () => {
  it('clamps speed to max when above range', () => {
    const dog = createDog('d1', 'Rex', { x: 0, y: 0, z: 0 }, 10);
    expect(clampSpeed(dog, 0, 5).speed).toBe(5);
  });

  it('clamps speed to min when below range', () => {
    const dog = createDog('d1', 'Rex', { x: 0, y: 0, z: 0 }, -1);
    expect(clampSpeed(dog, 0, 5).speed).toBe(0);
  });

  it('leaves speed unchanged when within range', () => {
    const dog = createDog('d1', 'Rex', { x: 0, y: 0, z: 0 }, 3);
    expect(clampSpeed(dog, 0, 5).speed).toBe(3);
  });
});
