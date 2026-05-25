export type AnimalType = 'dog' | 'cow' | 'pig' | string;

export interface ScentPoint {
  animalId: string;
  animalType: AnimalType;
  x: number;
  y: number;
  height: number;
  t: number;
  tauDecay?: number;
}

export interface EmitAccumulator {
  timeSinceLastEmit: number;
  distanceSinceLast: number;
  animalId: string;
  animalType: AnimalType;
  lastX: number;
  lastY: number;
  lastHeight: number;
}

export interface ScentParams {
  tauDecay: number;
  scentSpreadSigma: number;
  emitSpacing: number;
}

export interface AnimalScentProfile extends ScentParams {
  animalType: AnimalType;
  emitInterval: number;
  emitSpacing: number;
  emitProbability: number;
  spreadRadius: number;
}

export interface ScentVisualConfig {
  pointSize: number;
  minHeight: number;
  animalColorMap: Record<string, number>;
}

export interface TrackingParams {
  sensorRadius: number;
  /** 부채꼴 센서의 총 각도 (라디안). 기본값은 Math.PI / 2 (90°). */
  sensorFanAngle: number;
  /** 360도 fan을 나눌 섹터 개수 (기본 6, 60도 간격) */
  sensorSectorCount: number;
  /** 센서 중심의 머리 앞 offset 거리 (기본 1.0 = ANIMAL_HALF_EXTENT*2) */
  sensorOffset: number;
  detectThreshold: number;
  tauMemory: number;
  sigmaBase: number;
  sigmaMin: number;
  sigmaMax: number;
  lambda: number;
  xi: number;
  kLost: number;
  kPatch: number;
  initialRadius: number;
  kRadius: number;
  castAngleMax: number;
  /** cast 진입 sigma 임계값. sigma > castThreshold 이면 surge→cast 전환. 기본 1.0 */
  castThreshold: number;
  castTurnTolerance: number;
  lostRadius: number;
  lostTurnRate: number;
  surgeDuration: number;
  maxContacts: number;
  minSpeed: number;
  maxSpeed: number;
  kSpeedSigma: number;
  /** sector envelope multiplier (Θ₀ >> 1, 논문 Fig.3A). cast sweep 반각 = sigma * theta0 */
  theta0: number;
  /** radial distance contribution weight to sigma. sigma += kRadial * r */
  kRadial: number;
  /** cast 상태에서 lostTime 누적 배율 (기본 1.0). 0으로 두면 cast 고정 */
  castLostScale: number;
  /** cast flip 마진 (0.3~1.0). _baseBoundary = tan(halfSectorAngle * margin). 작을수록 더 자주 flip */
  castFlipMargin: number;
  /** flip scale 최대값 (0.3~2.0). flipRampStart에서 시작해 flipRampStep씩 증가, 이 값에서 cap. 기본 1.0 */
  castFlipScaleMax: number;
  /** cast flip 시 회전 속도 (2~20). 기본 8. 클수록 빠르게 꺾임 */
  flipTurnRate: number;
  /** flip 시 초기 angle scale (0.3~1.0). cast 진입 또는 flip ramp 시작 시 적용값. 기본 0.5 */
  flipRampStart: number;
  /** flip 시 angle scale 증가량 (0.05~0.5). 매 flip마다 이 값만큼 scale 증가. castFlipScaleMax까지 cap. 기본 0.1 */
  flipRampStep: number;
  /** 시야 감지 최대 거리 */
  visionRange: number;
  /** 시야 cone 반각 (라디안). 전체 cone 각도 = 2 * visionConeAngle */
  visionConeAngle: number;
}

/** scent spatial grid — cell 단위로 scent point 공간 인덱싱 */
export interface ScentGridCell {
  cx: number;
  cy: number;
  points: readonly ScentPoint[];
}

/** scent spatial grid — scent point의 공유 저장소이자 공간 인덱스 */
export interface ScentGrid {
  readonly scentCellSize: number;
  readonly cols: number;
  readonly rows: number;
  readonly worldLeft: number;
  readonly worldTop: number;
  readonly worldWidth: number;
  readonly worldDepth: number;
  /** point를 해당 셀에 삽입 */
  insert(point: ScentPoint): void;
  /** 5×tauDecay 초과 오래된 point 제거 */
  removeExpired(now: number, defaultTauDecay: number): void;
  /** origin 중심 반경 내 모든 point를 단일 배열로 반환 (scentRender용) */
  getAllPoints(): readonly ScentPoint[];
  /** origin 기준 부채꼴 섹터와 겹치는 셀들 조회 (sampler용) */
  getCellsInSector(
    origin: { x: number; y: number },
    facingAngle: number,
    sectorMinAngle: number,
    sectorMaxAngle: number,
    maxRadius: number
  ): readonly ScentGridCell[];
  /** origin 중심 반경 내 모든 셀 조회 */
  getCellsInRadius(origin: { x: number; y: number }, radius: number): readonly ScentGridCell[];
  /** 모든 셀의 위치와 점 개수를 배열로 반환 (시각화용) */
  getAllCellEntries(): Array<{ cx: number; cy: number; count: number }>;
}

export interface ScentWorldState {
  trailPoints: ScentPoint[];
  emitters: Map<string, EmitAccumulator>;
}
