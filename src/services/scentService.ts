import type { ScentWorldState, ScentPoint, AnimalScentProfile, ScentParams } from '../types/scent';

function randomGaussian(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function emitTrailPoint(
  state: ScentWorldState,
  animalId: string,
  animalType: string,
  animalX: number,
  animalY: number,
  animalHeight: number,
  dt: number,
  now: number,
  profile: AnimalScentProfile
): void {
  let acc = state.emitters.get(animalId);
  if (!acc) {
    acc = {
      timeSinceLastEmit: 0,
      distanceSinceLast: 0,
      animalId,
      animalType,
      lastX: animalX,
      lastY: animalY,
      lastHeight: animalHeight
    };
    state.emitters.set(animalId, acc);
  }

  acc.timeSinceLastEmit += dt;

  if (acc.timeSinceLastEmit < profile.emitInterval) {
    return;
  }

  acc.timeSinceLastEmit = 0;

  if (Math.random() > profile.emitProbability) {
    return;
  }

  // 원형 2D 가우시안 확산 (animal 중심, 방향 무관)
  const angle = Math.random() * 2 * Math.PI;
  const radius = Math.abs(randomGaussian()) * profile.spreadRadius;
  const px = animalX + Math.cos(angle) * radius;
  const py = animalY + Math.sin(angle) * radius;

  const point: ScentPoint = {
    animalId,
    animalType,
    x: px,
    y: py,
    height: animalHeight,
    t: now,
    baseIntensity: profile.baseIntensity,
    tauDecay: profile.tauDecayMin + Math.random() * (profile.tauDecayMax - profile.tauDecayMin)
  };
  state.trailPoints.push(point);

  acc.lastX = animalX;
  acc.lastY = animalY;
  acc.lastHeight = animalHeight;
}

export function emitTrailPointOnMove(
  state: ScentWorldState,
  animalId: string,
  animalType: string,
  animalX: number,
  animalY: number,
  animalHeight: number,
  now: number,
  profile: AnimalScentProfile
): void {
  let acc = state.emitters.get(animalId);
  if (!acc) {
    acc = {
      timeSinceLastEmit: 0,
      distanceSinceLast: 0,
      animalId,
      animalType,
      lastX: animalX,
      lastY: animalY,
      lastHeight: animalHeight
    };
    state.emitters.set(animalId, acc);
  }

  // 거리 누적
  const dx = animalX - acc.lastX;
  const dy = animalY - acc.lastY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  acc.distanceSinceLast += dist;

  // 거리 임계치 미달 시 방출하지 않음
  if (acc.distanceSinceLast < profile.emitSpacing) {
    acc.lastX = animalX;
    acc.lastY = animalY;
    acc.lastHeight = animalHeight;
    return;
  }

  acc.distanceSinceLast = 0;

  if (Math.random() > profile.emitProbability) {
    acc.lastX = animalX;
    acc.lastY = animalY;
    acc.lastHeight = animalHeight;
    return;
  }

  // 원형 2D 가우시안 확산 (위치 중심, 방향 무관)
  const angle = Math.random() * 2 * Math.PI;
  const radius = Math.abs(randomGaussian()) * profile.spreadRadius;
  const px = animalX + Math.cos(angle) * radius;
  const py = animalY + Math.sin(angle) * radius;

  const point: ScentPoint = {
    animalId,
    animalType,
    x: px,
    y: py,
    height: animalHeight,
    t: now,
    baseIntensity: profile.baseIntensity,
    tauDecay: profile.tauDecayMin + Math.random() * (profile.tauDecayMax - profile.tauDecayMin)
  };
  state.trailPoints.push(point);

  acc.lastX = animalX;
  acc.lastY = animalY;
  acc.lastHeight = animalHeight;
}

/**
 * Sample the scent signal at a given position.
 * - Iterates all trail points
 * - Applies time decay (exponential) and spatial decay (Gaussian)
 * - Optionally filters by animalType
 * - Returns the summed signal value
 */
export function sampleScentAt(
  state: ScentWorldState,
  position: { x: number; y: number },
  now: number,
  params: ScentParams,
  animalType?: string
): number {
  let totalSignal = 0;

  for (const point of state.trailPoints) {
    if (animalType !== undefined && point.animalType !== animalType) {
      continue;
    }

    const age = now - point.t;
    if (age < 0 || age > params.maxTrailAge) {
      continue;
    }

    const dx = position.x - point.x;
    const dy = position.y - point.y;
    const distSq = dx * dx + dy * dy;

    const decay = point.tauDecay ?? params.tauDecay;
    const intensity = point.baseIntensity * Math.exp(-age / decay);
    const sigmaSq = params.scentSpreadSigma * params.scentSpreadSigma;
    totalSignal += intensity * Math.exp(-distSq / (2 * sigmaSq));
  }

  return totalSignal;
}

/**
 * Remove trail points whose age exceeds maxTrailAge.
 * Modifies state.trailPoints in place.
 */
export function trimExpiredTrails(state: ScentWorldState, now: number, params: ScentParams): void {
  state.trailPoints = state.trailPoints.filter((point) => {
    const age = now - point.t;
    return age <= params.maxTrailAge;
  });
}
