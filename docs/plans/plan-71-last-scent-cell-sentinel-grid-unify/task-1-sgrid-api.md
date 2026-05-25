# task-1-sgrid-api

## 읽어야 할 파일
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `src/types/scent.ts`
- `src/services/scentGrid.ts`

## 작업
`ScentGrid` 인터페이스에 세계좌표↔cell 인덱스 변환 메서드를 추가하고 `ScentGridImpl`에 구현.

### 1. `src/types/scent.ts` — ScentGrid 인터페이스 확장
```ts
/** 세계좌표 → cell 인덱스. 범위 밖이면 null */
worldToCell(x: number, y: number): { cx: number; cy: number } | null;
/** cell 인덱스 → cell 중심 세계좌표 */
cellToWorld(cx: number, cy: number): { x: number; y: number };
```

### 2. `src/services/scentGrid.ts` — 구현
- 기존 `private worldToCell()` → `public worldToCell()` 로 변경 (파라미터: `x, y`)
- `cellToWorld(cx, cy)` 추가:
  ```ts
  x = this.worldLeft + (cx + 0.5) * this.scentCellSize;
  y = this.worldTop  + (cy + 0.5) * this.scentCellSize;
  ```

## Acceptance Criteria
- `npm run verify` 통과
- `worldToCell`이 `ScentGrid` 인터페이스에 선언되고 구현됨
- `cellToWorld`가 `ScentGrid` 인터페이스에 선언되고 구현됨
- 기존 `worldToCell` 호출부 (내부 `insert()`)가 깨지지 않음

## 금지사항
- 명시되지 않은 파일 생성 금지
- `scentGrid.ts`의 내부 로직 변경 금지 (기존 메서드 동작 유지)
