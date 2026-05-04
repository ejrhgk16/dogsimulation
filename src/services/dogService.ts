import type { Dog, DogPosition } from '../types/dog';

export function createDog(id: string, name: string, position: DogPosition, speed: number): Dog {
  return { id, name, position, speed };
}

export function moveDog(dog: Dog, direction: DogPosition, deltaTime: number): Dog {
  return {
    ...dog,
    position: {
      x: dog.position.x + direction.x * dog.speed * deltaTime,
      y: dog.position.y + direction.y * dog.speed * deltaTime,
      z: dog.position.z + direction.z * dog.speed * deltaTime
    }
  };
}

export function clampSpeed(dog: Dog, min: number, max: number): Dog {
  return { ...dog, speed: Math.min(Math.max(dog.speed, min), max) };
}
