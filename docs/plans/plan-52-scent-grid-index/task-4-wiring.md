# task-4-wiring

## 읽어야 할 파일
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `src/runtime/sceneRuntime.ts` (특히 gameLoop 메서드, ~464-489 라인)
- `src/services/Pursuer.ts`
- `src/services/scentGrid.ts` (task-2)
- `src/services/scentSampler.ts` (task-3에서 grid 기반으로 변경된 상태)

## 작업

grid를 game loop에 배선하고 Pursuer에 전달한다.

### 1. `src/runtime/sceneRuntime.ts`

현재 코드 (~464-476 라인):
```typescript
const allTrails = [...this.fakeTrails, ...this.pursuedList.flatMap((p) => p.trailPoints)];

for (const pursuer of this.pursuers) {
  pursuer.updateDogState(allTrails, now, dt, this.mapData, others);
}
```

변경:
```typescript
import { ScentGridImpl } from '../services/scentGrid';

// grid build + allTrails 수집을 단일 루프로 통합
const sensorRadius = this.pursuers[0]?.trackingParams.sensorRadius ?? 30;
const grid = new ScentGridImpl(sensorRadius);
const allTrails: ScentPoint[] = [];

for (const point of this.fakeTrails) {
  allTrails.push(point);
}
for (const p of this.pursuedList) {
  for (const point of p.trailPoints) {
    allTrails.push(point);
  }
}
grid.build(allTrails);

for (const pursuer of this.pursuers) {
  pursuer.updateDogState(grid, now, dt, this.mapData, others);
}
```

- `ScentPoint` import 추가
- `ScentGridImpl` import 추가
- `allTrails` 수집과 `grid.build`를 같은 데이터에 대해 수행
- scentRender에는 기존대로 `allTrails` 전달

### 2. `src/services/Pursuer.ts`

`updateDogState` 시그니처 변경:
```typescript
// 변경 전
updateDogState(trailPoints: readonly ScentPoint[], now: number, dt: number, mapData: MapData, others: ...): void

// 변경 후
updateDogState(grid: ScentGrid, now: number, dt: number, mapData: MapData, others: ...): void
```

- import: `ScentPoint` 제거, `ScentGrid` 추가 (`src/types/scent`에서)
- `buildDogScentSample` 내부: `trailPoints` → `grid` 전달

`buildDogScentSample` 시그니처 변경:
```typescript
// 변경 전
private buildDogScentSample(trailPoints: readonly ScentPoint[], now: number): ScentSample

// 변경 후
private buildDogScentSample(grid: ScentGrid, now: number): ScentSample
```

- `sampleScentInSector` 호출 시 `trailPoints` 대신 `grid` 전달
- `ScentGrid` import 추가, 불필요한 `ScentPoint` import 제거

### 주의사항
- `Pursuer.ts`에서 `scentSampler` import 경로 변경 없음 (여전히 `./scentSampler`에서 `sampleScentInSector` 가져옴)
- `sceneRuntime.ts`의 `scentRender.update(allTrails, now)` 라인은 그대로 유지
- pursuers가 없는 경우 기본 cellSize=30 fallback

## Acceptance Criteria
- `npm run lint && npm run format:check && npm run build && npm run test` 통과
- runtime에서 services로의 import가 ARCHITECTURE.md 계약 준수
- grid build와 flatMap이 동일 루프에서 수행됨 (O(n) 1회)
- Pursuer.updateDogState가 grid 인자만 받고 내부적으로 scentSampler에 전달

## 금지사항
- 명시되지 않은 파일 생성 금지
- scentRender 관련 코드 변경 금지
- otherEntities 인터페이스 변경 금지
