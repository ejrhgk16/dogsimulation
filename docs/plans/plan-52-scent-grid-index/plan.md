# plan-52-scent-grid-index

## 목표

scentSampler의 O(n) 전체 배열 순회를 공간 그리드 인덱스 기반 O(k) 근접 검색으로 전환한다.
grid를 **매 프레임 rebuild 하지 않고**, sceneRuntime이 소유하는 **단일 공유 저장소**로 사용.

## 설계 결정

- 셀 크기 = `sensorRadius` (TrackingParams.sensorRadius)
- grid = **매 프레임 rebuild ❌**, **Pursued.emitScent() → grid.insert()** 실시간 갱신
- grid는 sceneRuntime이 소유하는 단일 공유 `ScentGrid` 인스턴스
- Pursued의 `trailPoints[]` 필드 제거, trim 로직은 grid의 `removeExpired()`로 대체
- scentRender용 allTrails는 `grid.getAllPoints()`로 flatten (O(n) 1회, 기존 flatMap과 동일)

### 데이터 흐름

```
매 프레임 gameLoop():
  1. grid.removeExpired(now)                  // 전체 trim, O(n) 1회
  2. for pursued:
       pursued.emitScent(now, grid)           // push → grid.insert()
  3. allTrails = grid.getAllPoints()          // scentRender용 flat array
  4. for pursuer:
       pursuer.updateDogState(grid, ...)      // O(k) grid 검색
  5. scentRender.update(allTrails, now)       // 기존대로
```

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 | 의존 |
|---|---|---|---|---|
| 1 | grid-service | `src/types/scent.ts`, `src/services/scentGrid.ts` | `ScentGrid` 인터페이스 + `ScentGridImpl` 구현 | 없음 |
| 2 | pursued | `src/services/Pursued.ts` | `trailPoints[]` 제거, `emitScent`에 grid 인자, trim 제거 | task-1 |
| 3 | sampler-pursuer | `src/services/scentSampler.ts`, `src/services/Pursuer.ts` | sampler 함수들 grid 기반 개조, Pursuer 시그니처 변경 | task-1 |
| 4 | wiring | `src/runtime/sceneRuntime.ts` | 공유 grid 생성, trim+insert+flatten+sampling 배선 | task-2, task-3 |

## 의존 그래프

```
task-1 (grid types + impl)
  ├→ task-2 (Pursued)
  └→ task-3 (sampler + Pursuer)
       └→ task-4 (wiring)
```
task-2, task-3: 병렬 가능 (task-1 완료 후)
task-4: task-2, task-3 완료 후
