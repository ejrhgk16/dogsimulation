# task-2-grid-service

## 읽어야 할 파일
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `src/types/scent.ts` (task-1에서 추가된 `ScentGrid`, `ScentGridCell`)

## 작업

`src/services/scentGrid.ts` 신규 파일을 생성하여 `ScentGrid` 인터페이스를 구현한다.

### 구현체

```typescript
import type { ScentPoint, ScentGrid, ScentGridCell } from '../types/scent';

/** ScentGrid 구현: Map<string, ScentPoint[]> 기반 spatial grid */
export class ScentGridImpl implements ScentGrid {
  readonly cellSize: number;
  private cells: Map<string, ScentPoint[]> = new Map();

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  build(points: readonly ScentPoint[]): void {
    this.cells.clear();
    for (const point of points) {
      const cx = Math.floor(point.x / this.cellSize);
      const cy = Math.floor(point.y / this.cellSize);
      const key = `${cx},${cy}`;
      const cell = this.cells.get(key);
      if (cell) {
        cell.push(point);
      } else {
        this.cells.set(key, [point]);
      }
    }
  }

  getCellsInSector(
    origin: { x: number; y: number },
    facingAngle: number,
    sectorMinAngle: number,
    sectorMaxAngle: number,
    maxRadius: number
  ): readonly ScentGridCell[] {
    // origin을 포함하는 셀 기준 반경 내 모든 셀 후보 수집
    const originCx = Math.floor(origin.x / this.cellSize);
    const originCy = Math.floor(origin.y / this.cellSize);
    const cellRadius = Math.ceil(maxRadius / this.cellSize) + 1;
    const result: ScentGridCell[] = [];

    for (let dcx = -cellRadius; dcx <= cellRadius; dcx++) {
      for (let dcy = -cellRadius; dcy <= cellRadius; dcy++) {
        const cx = originCx + dcx;
        const cy = originCy + dcy;
        const key = `${cx},${cy}`;
        const points = this.cells.get(key);
        if (!points || points.length === 0) continue;

        // 셀 중심 계산
        const cellCenterX = (cx + 0.5) * this.cellSize;
        const cellCenterY = (cy + 0.5) * this.cellSize;
        const dx = cellCenterX - origin.x;
        const dy = cellCenterY - origin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 셀 중심까지 거리가 maxRadius + 셀대각/2 보다 크면 섹터 밖
        const cellHalfDiag = (this.cellSize * Math.SQRT2) / 2;
        if (dist > maxRadius + cellHalfDiag) continue;

        result.push({ cx, cy, points: [...points] });
      }
    }

    return result;
  }

  getCellsInRadius(origin: { x: number; y: number }, radius: number): readonly ScentGridCell[] {
    return this.getCellsInSector(origin, 0, -Math.PI, Math.PI, radius);
  }
}
```

### 주의사항
- `getCellsInSector`는 셀 단위 coarse 검사 후, 실제 point 필터링은 `scentSampler.ts`에서 수행 (기존 거리/각도 검사 재사용)
- `getCellsInRadius`는 내부적으로 `getCellsInSector`를 재사용 (전방향 = sectorMin=-PI, sectorMax=PI)
- 셀 키는 `"cx,cy"` 문자열

## Acceptance Criteria
- `npm run lint && npm run format:check && npm run build && npm run test` 통과
- ARCHITECTURE.md services 레이어 준수
- Three.js 의존성 없음 (순수 도메인 로직)

## 금지사항
- 명시되지 않은 파일 생성 금지
- 브라우저/렌더러 의존성 추가 금지
