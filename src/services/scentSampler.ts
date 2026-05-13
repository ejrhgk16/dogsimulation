import type { ScentPoint } from '../types/scent';
import type { ContactPoint } from '../types/pursuer';
import { DEFAULT_SCENT_PARAMS } from '../config/scentConfig';

export interface ScentSamplerParams {
  tauDecay: number;
  sensorRadius: number;
}

export interface ScentSampleDetail {
  totalSignal: number;
  avgAge: number;
}

/**
 * Sample scent intensity at a given position.
 * Sums contributions from all trail points with time decay and distance decay.
 */
export function sampleScentAt(
  pos: { x: number; y: number },
  trailPoints: readonly ScentPoint[],
  now: number,
  params: ScentSamplerParams
): number {
  return sampleScentDetail(pos, trailPoints, now, params).totalSignal;
}

/**
 * Sample scent intensity AND average age at a given position.
 * Returns signal strength and distance-weighted average age of contributing points.
 */
export function sampleScentDetail(
  pos: { x: number; y: number },
  trailPoints: readonly ScentPoint[],
  now: number,
  params: ScentSamplerParams
): ScentSampleDetail {
  const spreadSigma = DEFAULT_SCENT_PARAMS.scentSpreadSigma;
  const twoSigmaSq = 2 * spreadSigma * spreadSigma;
  let total = 0;
  let weightedAgeSum = 0;

  for (const point of trailPoints) {
    const dx = pos.x - point.x;
    const dy = pos.y - point.y;
    const distSq = dx * dx + dy * dy;
    if (Math.sqrt(distSq) > params.sensorRadius) continue;
    const tauDecay = point.tauDecay ?? params.tauDecay;
    const timeDecay = Math.exp(-(now - point.t) / tauDecay);
    const distDecay = Math.exp(-distSq / twoSigmaSq);
    const contribution = timeDecay * distDecay;
    total += contribution;
    weightedAgeSum += contribution * (now - point.t);
  }

  const avgAge = total > 1e-9 ? weightedAgeSum / total : Number.POSITIVE_INFINITY;

  return { totalSignal: total, avgAge };
}

/**
 * Returns the Euclidean distance between the last two contacts.
 * Returns 0 if fewer than 2 contacts.
 */
export function getLastContactDistance(contacts: readonly ContactPoint[]): number {
  if (contacts.length < 2) return 0;

  const prev = contacts[contacts.length - 2];
  const last = contacts[contacts.length - 1];
  const dx = last.x - prev.x;
  const dy = last.y - prev.y;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Estimates patchiness from recent contact time gaps.
 * Uses at most the last 3 gaps (last 4 contacts).
 * Returns normalized coefficient of variation in [0, 1].
 */
export function estimatePatchiness(contacts: readonly ContactPoint[], _now: number): number {
  const windowSize = Math.min(contacts.length, 4);
  if (windowSize < 3) return 0;

  const recent = contacts.slice(-windowSize);
  const gaps: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    gaps.push(recent[i].t - recent[i - 1].t);
  }

  if (gaps.length < 2) return 0;

  let sum = 0;
  for (const g of gaps) {
    sum += g;
  }
  const meanGap = sum / gaps.length;

  let varianceSum = 0;
  for (const g of gaps) {
    const diff = g - meanGap;
    varianceSum += diff * diff;
  }
  const variance = varianceSum / gaps.length;
  const stdGap = Math.sqrt(variance);
  const cv = stdGap / Math.max(meanGap, 1e-6);

  return Math.min(1, cv * 2);
}
