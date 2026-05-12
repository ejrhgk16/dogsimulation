export interface Dog {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  speed: number;
}

export function createDog(
  id: string,
  name: string,
  position: { x: number; y: number; z: number },
  speed: number
): Dog {
  return { id, name, position: { ...position }, speed };
}

export function moveDog(
  dog: Dog,
  direction: { x: number; y: number; z: number },
  deltaTime: number
): Dog {
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
  return {
    ...dog,
    speed: Math.max(min, Math.min(max, dog.speed))
  };
}
