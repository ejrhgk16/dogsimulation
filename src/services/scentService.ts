import type { ScentWorldState, ScentPoint, OwnerScentProfile, ScentParams } from '../types/scent';

/**
 * Attempt to emit a scent trail point for an owner.
 * - Looks up or creates an EmitAccumulator for the owner
 * - Accumulates distance traveled since last emission
 * - Emits a ScentPoint when distance threshold is met and probability passes
 */
export function emitTrailPoint(
  state: ScentWorldState,
  ownerId: string,
  ownerType: string,
  ownerX: number,
  ownerY: number,
  now: number,
  profile: OwnerScentProfile
): void {
  let acc = state.emitters.get(ownerId);
  if (!acc) {
    acc = {
      distanceSinceLast: 0,
      ownerId,
      ownerType,
      lastX: ownerX,
      lastY: ownerY
    };
    state.emitters.set(ownerId, acc);
  }

  const dx = ownerX - acc.lastX;
  const dy = ownerY - acc.lastY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  acc.distanceSinceLast += dist;

  if (acc.distanceSinceLast < profile.emitSpacing) {
    return;
  }

  acc.distanceSinceLast = 0;

  if (Math.random() > profile.emitProbability) {
    return;
  }

  const point: ScentPoint = {
    ownerId,
    ownerType,
    x: ownerX,
    y: ownerY,
    t: now,
    baseIntensity: profile.baseIntensity
  };
  state.trailPoints.push(point);

  acc.lastX = ownerX;
  acc.lastY = ownerY;
}

/**
 * Sample the scent signal at a given position.
 * - Iterates all trail points
 * - Applies time decay (exponential) and spatial decay (Gaussian)
 * - Optionally filters by ownerType
 * - Returns the summed signal value
 */
export function sampleScentAt(
  state: ScentWorldState,
  position: { x: number; y: number },
  now: number,
  params: ScentParams,
  ownerType?: string
): number {
  let totalSignal = 0;

  for (const point of state.trailPoints) {
    if (ownerType !== undefined && point.ownerType !== ownerType) {
      continue;
    }

    const age = now - point.t;
    if (age < 0 || age > params.maxTrailAge) {
      continue;
    }

    const dx = position.x - point.x;
    const dy = position.y - point.y;
    const distSq = dx * dx + dy * dy;

    const intensity = point.baseIntensity * Math.exp(-age / params.tauDecay);
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
