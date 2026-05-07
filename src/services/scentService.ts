import type { ScentWorldState, ScentPoint, AnimalScentProfile, ScentParams } from '../types/scent';
import { getTauDecayMultiplier, getEmitRateMultiplier } from '../config/scentConfig';

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

  if (Math.random() > profile.emitProbability * getEmitRateMultiplier()) {
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
    tauDecay:
      (profile.tauDecayMin + Math.random() * (profile.tauDecayMax - profile.tauDecayMin)) *
      getTauDecayMultiplier()
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

  if (Math.random() > profile.emitProbability * getEmitRateMultiplier()) {
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
    tauDecay:
      (profile.tauDecayMin + Math.random() * (profile.tauDecayMax - profile.tauDecayMin)) *
      getTauDecayMultiplier()
  };
  state.trailPoints.push(point);

  acc.lastX = animalX;
  acc.lastY = animalY;
  acc.lastHeight = animalHeight;
}

/**
 * Remove trail points whose age exceeds 5× tauDecay.
 * Modifies state.trailPoints in place.
 */
export function trimExpiredTrails(state: ScentWorldState, now: number, params: ScentParams): void {
  state.trailPoints = state.trailPoints.filter((point) => {
    const age = now - point.t;
    const threshold = (point.tauDecay ?? params.tauDecay) * 5;
    return age <= threshold;
  });
}
