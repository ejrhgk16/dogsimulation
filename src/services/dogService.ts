/** 개(Dog) 기본 데이터 구조 */
export interface Dog {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  speed: number;
}

/** 새 Dog 인스턴스 생성 */
export function createDog(
  id: string,
  name: string,
  position: { x: number; y: number; z: number },
  speed: number
): Dog {
  return { id, name, position: { ...position }, speed };
}

/** 방향·속도·deltaTime 기반으로 Dog 위치 이동 */
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

/** Dog 속도를 min~max 범위로 제한 */
export function clampSpeed(dog: Dog, min: number, max: number): Dog {
  return {
    ...dog,
    speed: Math.max(min, Math.min(max, dog.speed))
  };
}
