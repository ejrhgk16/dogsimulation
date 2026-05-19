# task-1-grid-service

## 읽어야 할 파일
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `src/types/scent.ts`

## 작업

### 1. `src/types/scent.ts`에 `ScentGrid` 인터페이스 추가

```typescript
/** scent spatial grid — scent point의 공유 저장소이자 공간 인덱스 */
export interface ScentGrid {
  readonly cellSize: number;
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
}
```

`scentGridCell` 타입도 함께 추가 (이미 `ScentGridCell`이 템플릿에 있었으면 추가):

```typescript
export interface ScentGridCell {
  cx: number;
  cy: number;
  points: readonly ScentPoint[];
}
```

### 2. `src/services/scentGrid.ts` 신규 생성

`ScentGrid` 인터페이스를 구현하는 `ScentGridImpl` 클래스:

- **내부 저장소**: `cells: Map<string, ScentPoint[]>` (키 = `"cx,cy"`)
- **`insert(point)`**: `(cx, cy)` 계산 후 해당 셀 배열에 push
- **`removeExpired(now, defaultTauDecay)`**: 모든 셀 순회, 각 point의 age > 5×tauDecay이면 제거 (filter)
- **`getAllPoints()`**: 모든 셀의 point를 단일 배열로 flatten
- **`getCellsInSector()`**: origin 셀 기준 반경 내 모든 셀을 순회, coarse bounding box 필터 후 ScentGridCell[] 반환
  - 셀 중심까지 거리 < maxRadius + cellHalfDiag 인 것만 포함
- **`getCellsInRadius()`**: getCellsInSector(..., -PI, PI, radius) 호출

### 주의사항
- `ScentGridImpl`은 순수 도메인 로직. Three.js, 브라우저 의존성 없음
- `getCellsInSector`는 coarse 필터만 수행. point-level 거리/각도 검사는 scentSampler가 담당
- `removeExpired`의 tauDecay fallback은 `point.tauDecay ?? defaultTauDecay` 사용

## Acceptance Criteria
- `npm run lint && npm run format:check && npm run build && npm run test` 통과
- ARCHITECTURE.md 레이어 계약 준수 (types → services)
- Three.js 의존성 없음

## 금지사항
- 명시되지 않은 파일 생성 금지
- `ScentGrid` 인터페이스에 구현 포함 금지
- 브라우저/렌더러 의존성 추가 금지
