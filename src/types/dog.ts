export interface DogPosition {
  x: number;
  y: number;
  z: number;
}

export interface Dog {
  id: string;
  name: string;
  position: DogPosition;
  speed: number;
}

export type DogState = 'idle' | 'walking' | 'running' | 'sitting';
