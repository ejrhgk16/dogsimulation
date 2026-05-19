# task-4-wiring

## 읽어야 할 파일
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `src/runtime/sceneRuntime.ts` (특히 gameLoop 메서드, ~440-490 라인)
- `src/services/scentGrid.ts` (task-1)
- `src/services/Pursued.ts` (task-2)
- `src/services/scentSampler.ts` (task-3)
- `src/config/scentConfig.ts` (`DEFAULT_SCENT_PARAMS`)

## 작업

`sceneRuntime.ts`에 공유 `ScentGrid` 인스턴스를 생성하고 game loop에 배선.

### 변경 사항

#### 1. 필드 추가
```typescript
import { ScentGridImpl } from '../services/scentGrid';

// class SceneRuntime 내부
private trailGrid: ScentGridImpl;
```

#### 2. 생성자에서 grid 초기화
```typescript
constructor(...) {
  // ...
  this.trailGrid = new ScentGridImpl(30); // 기본 cellSize, 필요시 trackingParams에서 가져옴
}
```

#### 3. gameLoop 배선 (~464-489 라인)

현재 코드:
```typescript
const allTrails = [...this.fakeTrails, ...this.pursuedList.flatMap((p) => p.trailPoints)];

for (const pursuer of this.pursuers) {
  if (!pursuer.isTracking) { ... continue; }
  const others = this.pursuedList.map((p) => ({ id: p.id, x: p.x, y: p.y }));
  pursuer.updateDogState(allTrails, now, dt, this.mapData, others);
  ...
}

for (const pursued of this.pursuedList) {
  pursued.moveByKeys(...);
  pursued.emitScent(now);
  ...
}

this.scentRender?.update(allTrails, now);
```

변경:
```typescript
// 1. grid trim (Pursued.trim() 책임을 여기서)
this.trailGrid.removeExpired(now, DEFAULT_SCENT_PARAMS.tauDecay);

// 2. pursued emit → grid에 insert
for (const pursued of this.pursuedList) {
  pursued.moveByKeys(this.keys, dt, this.mapData, ...);
  pursued.emitScent(now, this.trailGrid, DEFAULT_SCENT_PARAMS.tauDecay);
  ...
}

// 3. scentRender용 flatten
const allTrails = this.trailGrid.getAllPoints();

// 4. pursuer 업데이트 (grid 전달)
for (const pursuer of this.pursuers) {
  if (!pursuer.isTracking) { ... continue; }
  const others = this.pursuedList.map((p) => ({ id: p.id, x: p.x, y: p.y }));
  pursuer.updateDogState(this.trailGrid, now, dt, this.mapData, others);
  ...
}

// 5. scentRender
this.scentRender?.update(allTrails, now);
```

#### 4. `resetScent` 메서드 변경

현재 `Pursued.trailPoints = []` 직접 조작하던 부분 → grid 처리 필요.

```typescript
resetScent(): void {
  this.fakeTrails = [];
  // grid 재생성 (또는 clear 메서드 추가)
  this.trailGrid = new ScentGridImpl(this.trailGrid.cellSize);
}
```

또는 `ScentGrid`에 `clear()` 메서드를 추가하고 `this.trailGrid.clear()` 호출.

#### 5. `fakeTrails` 처리

`this.fakeTrails`가 존재한다면 `emitScent`와 같은 방식으로 `this.trailGrid.insert(point)` 호출하도록 변경. 또는 `fakeTrails` 관련 로직을 그대로 유지하면서 `grid.getAllPoints()`에 포함되지 않으므로 별도 처리.

### 주의사항
- `pursued.emitScent(now, grid, tauDecay)` 인자 추가
- `allTrails` 변수는 `trailGrid.getAllPoints()`로 대체
- `flatMap`, `[...spread]` 제거
- sceneRuntime 테스트에서 mock grid 사용 필요

## Acceptance Criteria
- `npm run lint && npm run format:check && npm run build && npm run test` 통과
- runtime → services import가 ARCHITECTURE.md 계약 준수
- grid가 매 프레임 rebuild 없이 실시간 insert만으로 갱신됨
- scentRender에 allTrails 정상 전달
- Pursued에서 trailPoints[] 직접 접근 코드 모두 제거됨

## 금지사항
- 명시되지 않은 파일 생성 금지
- scentRender 관련 코드 변경 금지
- 다른 debug/visualization 코드 변경 금지
