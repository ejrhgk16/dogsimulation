import type { ScentGrid, ScentGridCell, ScentPoint } from '../types/scent';

/** 세계 좌표 → 2D 셀 인덱스 매핑, 셀 단위 ScentPoint 저장 */
export class ScentGridImpl implements ScentGrid {
  readonly scentCellSize: number;
  readonly cols: number;
  readonly rows: number;
  readonly worldLeft: number;
  readonly worldTop: number;
  readonly worldWidth: number;
  readonly worldDepth: number;
  private readonly grid: ScentPoint[][][];

  constructor(
    worldLeft: number,
    worldTop: number,
    worldWidth: number,
    worldDepth: number,
    scentCellSize: number
  ) {
    this.worldLeft = worldLeft;
    this.worldTop = worldTop;
    this.worldWidth = worldWidth;
    this.worldDepth = worldDepth;
    this.scentCellSize = scentCellSize;
    this.cols = Math.ceil(worldWidth / scentCellSize);
    this.rows = Math.ceil(worldDepth / scentCellSize);

    this.grid = [];
    for (let c = 0; c < this.cols; c++) {
      const col: ScentPoint[][] = [];
      for (let r = 0; r < this.rows; r++) {
        col.push([]);
      }
      this.grid.push(col);
    }
  }

  /** 세계좌표(x,y) → cell 인덱스. 범위 밖이면 null */
  worldToCell(x: number, y: number): { cx: number; cy: number } | null {
    const cx = Math.floor((x - this.worldLeft) / this.scentCellSize);
    const cy = Math.floor((y - this.worldTop) / this.scentCellSize);
    if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return null;
    return { cx, cy };
  }

  /** cell 인덱스 → cell 중심 세계좌표. 범위 밖이면 null */
  cellToWorld(cx: number, cy: number): { x: number; y: number } | null {
    if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return null;
    return {
      x: this.worldLeft + (cx + 0.5) * this.scentCellSize,
      y: this.worldTop + (cy + 0.5) * this.scentCellSize
    };
  }

  /** 향기 점을 해당 셀에 삽입 */
  insert(point: ScentPoint): void {
    const cell = this.worldToCell(point.x, point.y);
    if (!cell) return;
    this.grid[cell.cx][cell.cy].push(point);
  }

  /** decay < 0.01 이면 제거 (GPU step(0.01)과 동일 기준) */
  removeExpired(now: number, defaultTauDecay: number): void {
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const cell = this.grid[c][r];
        if (cell.length === 0) continue;
        const filtered = cell.filter((p) => {
          const tau = p.tauDecay ?? defaultTauDecay;
          const decay = Math.exp(-(now - p.t) / tau);
          return decay >= 0.01;
        });
        if (filtered.length !== cell.length) {
          // splice + copy to keep array reference stable
          this.grid[c][r] = filtered;
        }
      }
    }
  }

  /** 전체 셀의 모든 ScentPoint를 평탄화하여 반환 (scentRender용) */
  getAllPoints(): readonly ScentPoint[] {
    const result: ScentPoint[] = [];
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const cell = this.grid[c][r];
        for (const p of cell) {
          result.push(p);
        }
      }
    }
    return result;
  }

  getCellsInSector(
    origin: { x: number; y: number },
    _facingAngle: number,
    _sectorMinAngle: number,
    _sectorMaxAngle: number,
    maxRadius: number
  ): readonly ScentGridCell[] {
    const minCol = Math.max(
      0,
      Math.floor((origin.x - maxRadius - this.worldLeft) / this.scentCellSize)
    );
    const maxCol = Math.min(
      this.cols - 1,
      Math.floor((origin.x + maxRadius - this.worldLeft) / this.scentCellSize)
    );
    const minRow = Math.max(
      0,
      Math.floor((origin.y - maxRadius - this.worldTop) / this.scentCellSize)
    );
    const maxRow = Math.min(
      this.rows - 1,
      Math.floor((origin.y + maxRadius - this.worldTop) / this.scentCellSize)
    );
    const result: ScentGridCell[] = [];

    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        const points = this.grid[col][row];
        if (points.length > 0) result.push({ cx: col, cy: row, points });
      }
    }

    return result;
  }

  getCellsInRadius(origin: { x: number; y: number }, radius: number): readonly ScentGridCell[] {
    const minCol = Math.max(
      0,
      Math.floor((origin.x - radius - this.worldLeft) / this.scentCellSize)
    );
    const maxCol = Math.min(
      this.cols - 1,
      Math.floor((origin.x + radius - this.worldLeft) / this.scentCellSize)
    );
    const minRow = Math.max(
      0,
      Math.floor((origin.y - radius - this.worldTop) / this.scentCellSize)
    );
    const maxRow = Math.min(
      this.rows - 1,
      Math.floor((origin.y + radius - this.worldTop) / this.scentCellSize)
    );
    const result: ScentGridCell[] = [];

    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        const points = this.grid[col][row];
        if (points.length > 0) result.push({ cx: col, cy: row, points });
      }
    }

    return result;
  }

  getAllCellEntries(): Array<{ cx: number; cy: number; count: number }> {
    const result: Array<{ cx: number; cy: number; count: number }> = [];
    for (let col = 0; col < this.cols; col++) {
      for (let row = 0; row < this.rows; row++) {
        result.push({ cx: col, cy: row, count: this.grid[col][row].length });
      }
    }
    return result;
  }
}
