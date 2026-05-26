import type { TrackingParams } from '../types/scent';
import type { VisionParams } from '../types/vision';

export const DEFAULT_TRACKING_PARAMS: TrackingParams = {
  sensorRadius: 3,
  sensorFanAngle: (110 * Math.PI) / 180,
  detectThreshold: 0.01,
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
  kSpeedSigma: 1.2,
  theta0: 4,
  kRadial: 0.01,
  castLostScale: 0.5,
  castFlipMargin: 0.5,
  castFlipScaleMax: 1.7,
  flipRampStart: 0.7,
  flipRampStep: 0.1,
  flipTurnRate: 8,
  visionRange: 10,
  visionConeAngle: (40 * Math.PI) / 180
};

export const DEFAULT_VISION_PARAMS: VisionParams = {
  visionRange: 10,
  visionConeAngle: (40 * Math.PI) / 180 // 40° (half cone, total 80°)
};
