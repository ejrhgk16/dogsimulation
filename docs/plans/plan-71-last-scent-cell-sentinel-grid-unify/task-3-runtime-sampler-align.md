# task-3-runtime-sampler-align

## 읽어야 할 파일
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `src/types/scent.ts` (task-1 수정 후)
- `src/types/pursuer.ts`
- `src/runtime/sceneRuntime.ts`
- `src/services/scentSampler.ts`

## 작업
sceneRuntime과 scentSampler의 cell 인덱스 계산을 ScentGrid API로 정렬하고, sentinel 조건 수정.

### 1. `src/types/pursuer.ts` — PursuerState 타입 수정
```ts
// 기존
lastScentGridX?: number;
lastScentGridY?: number;

// 변경
lastScentGridX: number | null;
lastScentGridY: number | null;
```
- optional → required + nullable. 사용처 없으면 변경만 하고 끝.

### 2. `src/runtime/sceneRuntime.ts` — getOrangeCellKeys (line 60-71)
- `_lastScentGridX` / `_lastScentGridY` 타입 assertion 유지
- `if (gx >= 0 && gy >= 0)` → `if (gx !== null && gy !== null)`
- 타입 어설션도 `{ _lastScentGridX: number | null }` 로 업데이트

### 3. `src/runtime/sceneRuntime.ts` — getPurpleCellKeys (line 73-94)
- 동일: `>= 0` → `!== null`
- `if (gx < 0 || gy < 0) continue` → `if (gx === null || gy === null) continue`

### 4. `src/runtime/sceneRuntime.ts` — resetAll / resetPositions
- `(p as unknown as { _lastScentGridX: number })._lastScentGridX = -1;` → `= null;`
- 어설션 타입도 `number | null` 로

### 5. `src/services/scentSampler.ts` — visited cell 필터 (line 115-118)
```ts
// 기존
if (visitedCells && cellSize) {
  const cellX = Math.floor(point.x / cellSize);
  const cellY = Math.floor(point.y / cellSize);
  if (visitedCells.has(`${cellX},${cellY}`)) continue;
}
```
- 이 함수는 `grid: ScentGrid` 를 이미 파라미터로 받고 있음
```ts
// 변경
if (visitedCells) {
  const cell = grid.worldToCell(point.x, point.y);
  if (cell && visitedCells.has(`${cell.cx},${cell.cy}`)) continue;
}
```
- `cellSize` 파라미터 제거 가능 — 함수 시그니처도 정리

### 6. `src/services/scentSampler.ts` —  `sampleScentInSector` 시그니처
- 파라미터 `visitedCells?: Set<string>, cellSize?: number` → `visitedCells?: Set<string>` (cellSize 제거)
- 호출부 (Pursuer.ts `buildDogScentSample`) 확인: task-2에서 수정된 코드와 충돌 없도록

## Acceptance Criteria
- `npm run verify` 통과
- `getOrangeCellKeys` / `getPurpleCellKeys` 가 `null` 체크로 동작
- `resetAll` / `resetPositions` 에서 `null` 할당
- `scentSampler.ts` visited 필터가 `grid.worldToCell()` 사용
- `PursuerState.lastScentGridX/Y` 타입이 `number | null`
- `sampleScentInSector`에서 `cellSize` 파라미터 제거됨 (호출부도)

## 금지사항
- 명시되지 않은 파일 생성 금지
- 목록 외 파일 수정 금지
- `rebuildGridCells`의 cellKey 계산 로직은 이 task에서 건드리지 않음 (이미 origin-centric으로 일관성 있음)
