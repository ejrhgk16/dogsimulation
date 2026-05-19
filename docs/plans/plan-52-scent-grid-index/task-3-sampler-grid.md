# task-3-sampler-grid

## 읽어야 할 파일
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `src/services/scentSampler.ts`
- `src/types/scent.ts` (task-1에서 추가된 `ScentGrid`)
- `src/services/scentGrid.ts` (task-2에서 구현된 `ScentGridImpl`)

## 작업

`scentSampler.ts`의 3개 함수를 grid 기반으로 개조한다.

### 변경 사항

#### 1. `sampleScentAt`

기존 시그니처:
```typescript
sampleScentAt(pos, trailPoints: readonly ScentPoint[], now, params): number
```

변경:
```typescript
sampleScentAt(pos, grid: ScentGrid, now, params): number
```
- `trailPoints` 대신 `grid` 인자
- 내부에서 `grid.getCellsInRadius(pos, params.sensorRadius)` 호출하여 인접 셀 point만 순회
- `sampleScentDetail`도 동일하게 grid 전달

#### 2. `sampleScentDetail`

기존 시그니처:
```typescript
sampleScentDetail(pos, trailPoints: readonly ScentPoint[], now, params): ScentSampleDetail
```

변경:
```typescript
sampleScentDetail(pos, grid: ScentGrid, now, params): ScentSampleDetail
```
- `grid.getCellsInRadius(pos, params.sensorRadius)` 호출
- 셀 내 point 순회하며 거리/시간 감쇠 계산 (기존 로직 유지)

#### 3. `sampleScentInSector`

기존 시그니처:
```typescript
sampleScentInSector(origin, facingAngle, sectorMin, sectorMax, maxRadius, trailPoints, now, params): ScentSampleDetail
```

변경:
```typescript
sampleScentInSector(origin, facingAngle, sectorMin, sectorMax, maxRadius, grid: ScentGrid, now, params): ScentSampleDetail
```
- `grid.getCellsInSector(origin, facingAngle, sectorMin, sectorMax, maxRadius)` 호출
- 셀 내 point 순회 (기존 거리/각도 필터 로직 유지)

### 삭제 항목

- 함수 시그니처에서 `trailPoints: readonly ScentPoint[]` 인자 제거
- `for (const point of trailPoints)` → `for (const cell of cells) { for (const point of cell.points)` 형태로 변경

### 주의사항
- 기존 `getLastContactDistance`, `estimatePatchiness` 함수는 grid 의존 없음 → 변경 없음
- `sampleScentInSector`의 `dist < params.sensorRadius` 필터는 grid가 coarse하게 걸러주지만 point-level 거리 검사는 **유지**
- `DEFAULT_SCENT_PARAMS` import 유지

## Acceptance Criteria
- `npm run lint && npm run format:check && npm run build && npm run test` 통과
- 기존 scentSampler 동작 결과 동일 (grid 도입으로 정확도 저하 없음)
- import 경로가 ARCHITECTURE.md 레이어 계약 준수 (services → types)

## 금지사항
- 명시되지 않은 파일 생성 금지
- `getLastContactDistance`, `estimatePatchiness` 함수 변경 금지
