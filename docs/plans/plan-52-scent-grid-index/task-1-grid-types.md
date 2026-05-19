# task-1-grid-types

## 읽어야 할 파일
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `src/types/scent.ts`

## 작업

`src/types/scent.ts`에 scent grid 관련 타입을 추가한다.

### 추가할 타입

```typescript
/** scent grid 내 개별 셀 */
export interface ScentGridCell {
  cx: number;
  cy: number;
  points: readonly ScentPoint[];
}

/** scent spatial grid interface — services/scentGrid.ts 에서 구현 */
export interface ScentGrid {
  readonly cellSize: number;
  /** 전체 point 목록으로 grid rebuild */
  build(points: readonly ScentPoint[]): void;
  /** origin 중심 부채꼴 섹터와 겹치는 셀들 조회 */
  getCellsInSector(
    origin: { x: number; y: number },
    facingAngle: number,
    sectorMinAngle: number,
    sectorMaxAngle: number,
    maxRadius: number
  ): readonly ScentGridCell[];
  /** origin 중심 반경 내 모든 셀 조회 */
  getCellsInRadius(origin: { x: number; y: number }, radius: number): readonly ScentGridCell[];
}
```

- `ScentGridCell.cx`, `cy` = 그리드 셀 좌표 인덱스 (정수)
- `ScentGrid.cellSize` = 셀 크기
- `getCellsInSector` = origin 기준 facingAngle에서 sectorMinAngle~sectorMaxAngle 범위 부채꼴과 겹치는 셀 반환
- `getCellsInRadius` = origin 중심 원형 영역과 겹치는 셀 반환

## Acceptance Criteria
- `npm run lint && npm run format:check && npm run build && npm run test` 통과
- ARCHITECTURE.md 레이어 계약 준수
- ADR 기술 스택 준수
- AGENTS.md 규칙 준수

## 금지사항
- 명시되지 않은 파일 생성 금지
- `ScentGrid` 인터페이스에 구현 포함 금지 (순수 타입만)
