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
  netBias: number;
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
  directionX: number; // normalized direction
  directionY: number; // normalized direction
  rotationAngle: number; // radians
  castOriginX: number; // cast 진입 시점 x 좌표 (원점)
  castOriginY: number; // cast 진입 시점 y 좌표 (원점)
  targetId: string | null;
  state: TrackState;
  lastContacts: ContactPoint[];
  trailMemory: { x: number; y: number }[];
  lostTime: number;
  searchRadius: number;
  sigma: number;
  estimatedHeading: number;
  targetHeading: number;
  castSide: number; // +1 or -1
  lastTrailSignal: number;
  /** 시야로 감지한 대상 ID (없으면 null) */
  visionTargetId: string | null;
  /** 시야 감지 여부 (현재 프레임) */
  hasVisionContact: boolean;
}
