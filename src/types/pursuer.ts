export interface ContactPoint {
  x: number;
  y: number;
  t: number; // timestamp (ms)
  confidence: number; // 0~1, signal strength ratio
}

export type TrackState = 'track' | 'surge' | 'cast' | 'lost';

export interface ScentSample {
  totalSignal: number;
  signalDirection: number; // radians
  directionConfidence: number; // 0~1
}

export interface SensorPositions {
  center: { x: number; y: number };
  left: { x: number; y: number };
  right: { x: number; y: number };
}

export interface PursuerState {
  id: string;
  x: number;
  y: number; // map Z coordinate
  height: number; // world Y (elevation)
  speed: number; // base movement speed
  chaseSpeed: number; // speed when chasing target
  directionX: number; // normalized direction
  directionY: number; // normalized direction
  rotationAngle: number; // radians
  targetId: string | null;
  state: TrackState;
  lastContacts: ContactPoint[];
  lostTime: number;
  searchRadius: number;
  sigma: number;
  estimatedHeading: number;
  targetHeading: number;
  castSide: number; // +1 or -1
  lastTrailSignal: number;
}
