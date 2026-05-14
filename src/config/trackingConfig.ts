import type { TrackingParams } from '../types/scent';

export const DEFAULT_TRACKING_PARAMS: TrackingParams = {
  sensorRadius: 1,
  sensorFanAngle: Math.PI / 2,
  detectThreshold: 0.25,
  tauMemory: 3.0,
  sigmaBase: 0.05,
  sigmaMin: 0.05,
  sigmaMax: 1.2,
  lambda: 25,
  xi: 50,
  kLost: 0.12,
  kPatch: 0.4,
  initialRadius: 8,
  kRadius: 20,
  castAngleMax: 1.0,
  castTurnTolerance: 0.08,
  lostRadius: 80,
  lostTurnRate: 0.8,
  surgeDuration: 0.5,
  maxContacts: 6,
  minSpeed: 1,
  maxSpeed: 5,
  kSpeedSigma: 1.2
};
