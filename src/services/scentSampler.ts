import type { ScentGrid } from '../types/scent';
import type { ContactPoint } from '../types/pursuer';
import { DEFAULT_SCENT_PARAMS } from '../config/scentConfig';

/** 향기 샘플링 파라미터 */
export interface ScentSamplerParams {
  /** 시간감쇠 시정수 (클수록 오래 지속) */
  tauDecay: number;
  /** 센서 감지 반경 */
  sensorRadius: number;
}

/** 단일 지점 향기 샘플링 결과 */
export interface ScentSampleDetail {
  /** 누적 신호 강도 */
  totalSignal: number;
  /** 거리 가중 평균 연령 */
  avgAge: number;
}

/**
 * 특정 위치에서 향기 신호 강도만 반환.
 * 모든 trail point의 시간감쇠+거리감쇠 기여도를 합산.
 */
export function sampleScentAt(
  pos: { x: number; y: number },
  grid: ScentGrid,
  now: number,
  params: ScentSamplerParams
): number {
  return sampleScentDetail(pos, grid, now, params).totalSignal;
}

/**
 * 특정 위치에서 향기 신호 강도와 평균 연령을 반환.
 * 센서 반경 내 trail point만 고려, 거리 가중 평균 age 산출.
 */
export function sampleScentDetail(
  pos: { x: number; y: number },
  grid: ScentGrid,
  now: number,
  params: ScentSamplerParams
): ScentSampleDetail {
  const spreadSigma = DEFAULT_SCENT_PARAMS.scentSpreadSigma;
  const twoSigmaSq = 2 * spreadSigma * spreadSigma;
  let total = 0;
  let weightedAgeSum = 0;

  const cells = grid.getCellsInRadius(pos, params.sensorRadius);
  for (const cell of cells) {
    for (const point of cell.points) {
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
  }

  const avgAge = total > 1e-9 ? weightedAgeSum / total : Number.POSITIVE_INFINITY;

  return { totalSignal: total, avgAge };
}

/**
 * 부채꼴 섹터 내 향기 샘플링.
 * facingAngle 기준 상대각도로 trail point 필터링 후
 * 시간감쇠+거리감쇠+평균연령 계산 (sampleScentDetail와 동일 로직).
 */
export function sampleScentInSector(
  origin: { x: number; y: number },
  facingAngle: number,
  sectorMinAngle: number,
  sectorMaxAngle: number,
  maxRadius: number,
  grid: ScentGrid,
  now: number,
  params: ScentSamplerParams,
  visitedCells?: string[]
): ScentSampleDetail {
  const spreadSigma = DEFAULT_SCENT_PARAMS.scentSpreadSigma;
  const twoSigmaSq = 2 * spreadSigma * spreadSigma;
  let total = 0;
  let weightedAgeSum = 0;

  const cells = grid.getCellsInSector(
    origin,
    facingAngle,
    sectorMinAngle,
    sectorMaxAngle,
    maxRadius
  );
  for (const cell of cells) {
    for (const point of cell.points) {
      const dx = point.x - origin.x;
      const dy = point.y - origin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 거리 차단
      if (dist > maxRadius) continue;
      if (dist > params.sensorRadius) continue;

      // 각도 필터: facing 방향 기준 상대각도 [-π, π] 정규화
      const pointAngle = Math.atan2(dy, dx) - facingAngle;
      const normalizedAngle = Math.atan2(Math.sin(pointAngle), Math.cos(pointAngle));
      if (normalizedAngle < sectorMinAngle || normalizedAngle > sectorMaxAngle) continue;

      // visited cell filter: skip point whose grid cell has been visited
      if (visitedCells) {
        const cell = grid.worldToCell(point.x, point.y);
        if (cell && visitedCells.includes(`${cell.cx},${cell.cy}`)) continue;
      }

      const tauDecay = point.tauDecay ?? params.tauDecay;
      const timeDecay = Math.exp(-(now - point.t) / tauDecay);
      const distDecay = Math.exp(-(dx * dx + dy * dy) / twoSigmaSq);
      const contribution = timeDecay * distDecay;
      total += contribution;
      weightedAgeSum += contribution * (now - point.t);
    }
  }

  const avgAge = total > 1e-9 ? weightedAgeSum / total : Number.POSITIVE_INFINITY;

  return { totalSignal: total, avgAge };
}

/**
 * 마지막 두 접촉점 사이 체비셰프 거리 반환 (world 좌표 wx,wy 기준).
 * 접촉점 2개 미만이면 0.
 */
export function getLastContactDistance(contacts: readonly ContactPoint[]): number {
  if (contacts.length < 2) return 0;

  const prev = contacts[contacts.length - 2];
  const last = contacts[contacts.length - 1];
  const dx = last.wx - prev.wx;
  const dy = last.wy - prev.wy;

  return Math.max(Math.abs(dx), Math.abs(dy));
}

/**
 * 최근 접촉 시간 간격으로 불균일도(patchiness) 추정.
 * 최대 3개 간격(최근 4개 접촉점) 사용, 변동계수(CV) 정규화값 [0,1] 반환.
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
