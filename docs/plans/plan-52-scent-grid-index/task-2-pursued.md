# task-2-pursued

## 읽어야 할 파일
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `src/services/Pursued.ts`
- `src/types/scent.ts` (task-1에서 추가된 `ScentGrid`)
- `src/config/scentConfig.ts`

## 작업

`Pursued.ts`에서 `trailPoints[]` 필드와 `trim()` 메서드를 제거하고, emit 시 공유 grid에 직접 insert.

### 변경 사항

#### 1. 필드 제거
- `trailPoints: ScentPoint[] = []` **제거**
- `ScentPoint` import 제거 (더 이상 직접 배열 관리 안 함)

#### 2. `emitScent` 시그니처 변경

```typescript
// 변경 전
emitScent(now: number): void

// 변경 후
emitScent(now: number, grid: ScentGrid, defaultTauDecay: number): void
```

- 내부에서 `this.trim()` 호출하던 것 → `grid.removeExpired(now, defaultTauDecay)` 호출로 대체
- `pushScentPoint` 호출 시 `this.trailPoints.push(...)` 대신 `grid.insert(point)` 호출

#### 3. `pushScentPoint` 변경
- 인자에 `grid: ScentGrid` 추가
- `this.trailPoints.push({...})` → `grid.insert({...})`

#### 4. `trim` 메서드 제거
- `private trim(now, params)` 완전히 삭제
- 이 책임은 `grid.removeExpired()`가 담당 (sceneRuntime에서 매 프레임 호출)

### 주의사항
- `scentConfig`에서 `getAnimalProfile`, `getTauDecayMultiplier`, `getEmitRateMultiplier` import 유지
- `DEFAULT_SCENT_PARAMS` import는 더 이상 `trim`에서 필요 없으므로 제거 (emitScent에서 defaultTauDecay를 파라미터로 받음)
- `mapService` import 유지 (getHeightAt, isObstacleInFootprint)

## Acceptance Criteria
- `npm run lint && npm run format:check && npm run build && npm run test` 통과
- ARCHITECTURE.md services 레이어 준수
- Pursued에서 trailPoints[] 참조하는 모든 코드 제거됨
- 기존 Pursued 테스트 통과 (또는 grid mock 적용)

## 금지사항
- 명시되지 않은 파일 생성 금지
- `moveByKeys`, `applyMovement`, `isCollidingWithEntities` 변경 금지
