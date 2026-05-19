# task-3-sampler-pursuer

## 읽어야 할 파일
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `src/services/scentSampler.ts`
- `src/services/Pursuer.ts`
- `src/types/scent.ts` (task-1에서 추가된 `ScentGrid`)

## 작업

### 1. `src/services/scentSampler.ts`

3개 함수의 시그니처를 변경: `trailPoints: readonly ScentPoint[]` → `grid: ScentGrid`

#### `sampleScentAt`
```typescript
// 변경 전
sampleScentAt(pos, trailPoints: readonly ScentPoint[], now, params): number

// 변경 후
sampleScentAt(pos, grid: ScentGrid, now, params): number
```
- 내부: `sampleScentDetail(pos, grid, now, params)` 호출

#### `sampleScentDetail`
```typescript
// 변경 전
sampleScentDetail(pos, trailPoints: readonly ScentPoint[], now, params): ScentSampleDetail

// 변경 후
sampleScentDetail(pos, grid: ScentGrid, now, params): ScentSampleDetail
```
- `for (const point of trailPoints)` → `grid.getCellsInRadius(pos, params.sensorRadius)` 후 셀 내 point 순회
- 기존 거리/시간 감쇠 로직 유지

#### `sampleScentInSector`
```typescript
// 변경 전
sampleScentInSector(origin, facingAngle, sectorMin, sectorMax, maxRadius,
  trailPoints: readonly ScentPoint[], now, params): ScentSampleDetail

// 변경 후
sampleScentInSector(origin, facingAngle, sectorMin, sectorMax, maxRadius,
  grid: ScentGrid, now, params): ScentSampleDetail
```
- `grid.getCellsInSector(origin, facingAngle, sectorMin, sectorMax, maxRadius)` 호출
- 셀 내 point 순회하며 기존 거리/각도/시간 필터 로직 유지

#### 변경 없음
- `getLastContactDistance(contacts)` — grid 불필요
- `estimatePatchiness(contacts, now)` — grid 불필요
- `ScentSamplerParams` 인터페이스 — 변경 없음
- `ScentSampleDetail` 인터페이스 — 변경 없음

### 2. `src/services/Pursuer.ts`

#### `updateDogState` 시그니처
```typescript
// 변경 전
updateDogState(trailPoints: readonly ScentPoint[], now, dt, mapData, others): void

// 변경 후
updateDogState(grid: ScentGrid, now, dt, mapData, others): void
```
- import: `ScentPoint` 제거, `ScentGrid` 추가
- `buildDogScentSample` 호출 시 `trailPoints` 대신 `grid` 전달

#### `buildDogScentSample` 시그니처
```typescript
// 변경 전
private buildDogScentSample(trailPoints: readonly ScentPoint[], now): ScentSample

// 변경 후
private buildDogScentSample(grid: ScentGrid, now): ScentSample
```
- `sampleScentInSector` 호출 3회: `trailPoints` → `grid` 전달
- `scentSampler` import 경로 변경 없음 (`./scentSampler`)

### 주의사항
- `DEFAULT_SCENT_PARAMS` import는 scentSampler에서 유지
- `DEFAULT_TRACKING_PARAMS` import는 Pursuer에서 유지
- `sampleScentInSector`의 point-level `dist < params.sensorRadius` 필터 유지 (grid coarse는 근사치)
- `_baseBoundary`, `_halfSectorAngle`, `_currentFlipScale` 등 cast 관련 내부 상태 유지

## Acceptance Criteria
- `npm run lint && npm run format:check && npm run build && npm run test` 통과
- scentSampler 함수들에서 `trailPoints` 인자 완전 제거
- Pursuer에서 `trailPoints` 전달 없이 `grid`만 전달
- 기존 scentSampler, Pursuer 테스트 통과 (grid mock 필요 시 적용)

## 금지사항
- 명시되지 않은 파일 생성 금지
- `getLastContactDistance`, `estimatePatchiness` 변경 금지
- cast/lost 상태머신 로직 변경 금지
