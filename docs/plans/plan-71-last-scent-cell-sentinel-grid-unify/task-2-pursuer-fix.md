# task-2-pursuer-fix

## 읽어야 할 파일
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `src/types/scent.ts` (task-1 수정 후)
- `src/services/scentGrid.ts` (task-1 수정 후)
- `src/services/Pursuer.ts`
- `src/config/scentConfig.ts`

## 작업
Pursuer의 `_lastScentGridX/Y` sentinel `-1`을 `null`로 변경하고, cell 좌표 계산을 직접 하는 대신 `ScentGrid.worldToCell()` / `cellToWorld()` API를 사용하도록 전환.

### 1. 필드 타입 변경
```ts
// 기존
_lastScentGridX: number = -1;
_lastScentGridY: number = -1;

// 변경
_lastScentGridX: number | null = null;
_lastScentGridY: number | null = null;
```

### 2. `constructor()` (line 93-121)
- `_lastScentGridX = -1` → 제거 (이미 필드 초기값 `null`)

### 3. `setPosition()` (line 123-144)
- `this._lastScentGridX = -1` → `this._lastScentGridX = null`
- `this._lastScentGridY = -1` → `this._lastScentGridY = null`

### 4. `updateDogState()` scent 감지부 (line 175-183)
```ts
// 기존
this._lastScentGridX = Math.floor(this.x / DEFAULT_SCENT_CELL_SIZE);
this._lastScentGridY = Math.floor(this.y / DEFAULT_SCENT_CELL_SIZE);

// 변경 — ScentGrid API 사용
const cell = grid.worldToCell(this.x, this.y);
if (cell) {
  this._lastScentGridX = cell.cx;
  this._lastScentGridY = cell.cy;
} else {
  this._lastScentGridX = null;
  this._lastScentGridY = null;
}
```
- `DEFAULT_SCENT_CELL_SIZE` import 제거 (더 이상 직접 계산 안 함)

### 5. `buildDogScentSample()` visited cell 기록 (line 647-651)
```ts
// 기존
const cellSize = DEFAULT_SCENT_CELL_SIZE;
const cx = Math.floor(this.x / cellSize);
const cy = Math.floor(this.y / cellSize);
this.visitedCells.add(`${cx},${cy}`);

// 변경 — ScentGrid API 사용
const cell = grid.worldToCell(this.x, this.y);
if (cell) {
  this.visitedCells.add(`${cell.cx},${cell.cy}`);
}
```
- 여기서도 `DEFAULT_SCENT_CELL_SIZE` 직접 사용 제거

### 6. lost 상태 탐색 (line 293-328)
- `if (this._lastScentGridX >= 0 && this._lastScentGridY >= 0)` → `if (this._lastScentGridX !== null && this._lastScentGridY !== null)`
- cell 중심 계산 부분:
```ts
// 기존
const cellCenterX = (gx + 0.5) * cellSize;
const cellCenterY = (gy + 0.5) * cellSize;

// 변경 — ScentGrid API 사용
const center = grid.cellToWorld(gx, gy);
this.targetHeading = Math.atan2(center.y - this.y, center.x - this.x);
```
- lost 탐색에서도 `DEFAULT_SCENT_CELL_SIZE` 직접 사용 제거. 단, grid 객체를 lost 분기에서 참조할 수 있어야 함 → `updateDogState()`의 `grid` 파라미터 활용

### 7. `DEFAULT_SCENT_CELL_SIZE` import
- Pursuer.ts에서 직접적인 `DEFAULT_SCENT_CELL_SIZE` 사용이 모두 사라지므로 import 제거

## Acceptance Criteria
- `npm run verify` 통과
- `_lastScentGridX/Y` 타입이 `number | null`
- 모든 cell 인덱스 계산이 `grid.worldToCell()` 경유
- lost 탐색의 cell 중심 계산이 `grid.cellToWorld()` 경유
- `Pursuer.ts`에서 `DEFAULT_SCENT_CELL_SIZE` 직접 사용 없음
- 좌측 맵에서도 `_lastScentGridX/Y` 음수값과 sentinel 구분 가능

## 금지사항
- 명시되지 않은 파일 생성 금지
- `Pursuer.ts` 외 파일 수정 금지
- lost 탐색 알고리즘(radius 1→2→3, perimeter check) 자체는 변경 금지
