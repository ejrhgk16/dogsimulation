import type { ContactPoint } from '../types/pursuer';

/**
 * GWLC(Generalized Worm-Like Chain) trail 통계 모델.
 *
 * 두 contact 사이 거리 L에 대한 heading 불확실성 σ(L)을 계산한다.
 *
 * - curvature-dominated (L ≪ λ): σ ≈ L / (2 * xi)
 * - diffusive (L ≫ λ): σ ≈ sqrt(2 * lambda * L) / (sqrt(3) * xi)
 * - regime interpolation: w = L / (L + lambda), σ² = (1-w)*curvatureTerm + w*diffusiveTerm
 *
 * @param L 두 contact 사이 거리 (≥0)
 * @param lambda persistence length (λ)
 * @param xi curvature radius (ξ)
 * @returns heading 불확실성 σ (radians)
 */
export function gwlcSigma(L: number, lambda: number, xi: number): number {
  const denom = L + lambda;
  const w = denom > 0 ? L / denom : 0;

  const curvatureTerm = (L * L) / (4 * xi * xi);
  const diffusiveTerm = (2 * lambda * L) / (3 * xi * xi);

  const sigmaSq = (1 - w) * curvatureTerm + w * diffusiveTerm;
  return Math.sqrt(Math.max(0, sigmaSq));
}

/**
 * 두 contact 사이 heading correlation ρ(L)을 계산한다.
 *
 * - curvature-dominated (L ≪ λ): ρ ≈ -1 (두 점은 원의 chord)
 * - diffusive (L ≫ λ): ρ ≈ -1/2
 * - regime interpolation: w = L / (L + lambda), ρ = (1-w)*(-1) + w*(-1/2)
 *
 * @param L 두 contact 사이 거리 (≥0)
 * @param lambda persistence length (λ)
 * @param xi curvature radius (ξ) — signature 통일용, 계산에는 사용되지 않음
 * @returns heading correlation ρ ∈ [-1, -0.5]
 */
export function gwlcCorrelation(L: number, lambda: number, _xi: number): number {
  const denom = L + lambda;
  const w = denom > 0 ? L / denom : 0;

  return (1 - w) * -1 + w * -0.5;
}

/**
 * lastContacts로부터 trail heading φ_ML을 추정한다.
 *
 * - contacts.length < 3 → NaN (fallback은 호출자가 처리) 또는 chord
 * - contacts.length >= 3 → 마지막 3개 contact에 대한 ordinary least squares 선형 회귀
 *
 * @param contacts 접촉점 배열 (인덱스 0이 가장 오래됨)
 * @param lambda persistence length (λ) — 향후 GWLC 보정용
 * @param xi curvature radius (ξ) — 향후 GWLC 보정용
 * @returns 추정 heading (radians), 불가능 시 NaN
 */
export function estimateTrailHeading(
  contacts: readonly ContactPoint[],
  _lambda: number,
  _xi: number
): number {
  const n = contacts.length;
  if (n < 2) return NaN;

  if (n === 2) {
    const p0 = contacts[0];
    const p1 = contacts[1];
    return Math.atan2(p1.cy - p0.cy, p1.cx - p0.cx);
  }

  // n >= 3: ordinary least squares linear regression on last 3
  const m = Math.min(n, 3);
  const window = contacts.slice(n - m);

  let sumX = 0;
  let sumY = 0;
  for (const c of window) {
    sumX += c.cx;
    sumY += c.cy;
  }
  const meanX = sumX / m;
  const meanY = sumY / m;

  let covXY = 0;
  let varX = 0;
  for (const c of window) {
    const dx = c.cx - meanX;
    covXY += dx * (c.cy - meanY);
    varX += dx * dx;
  }

  if (varX < 1e-10) {
    return Math.atan2(window[m - 1].cy - window[0].cy, window[m - 1].cx - window[0].cx);
  }

  const slope = covXY / varX;
  const intercept = meanY - slope * meanX;

  const x0 = window[0].cx;
  const y0 = intercept + slope * x0;
  const x1 = window[m - 1].cx;
  const y1 = intercept + slope * x1;

  return Math.atan2(y1 - y0, x1 - x0);
}
