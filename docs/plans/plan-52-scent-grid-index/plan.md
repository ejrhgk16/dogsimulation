# plan-52-scent-grid-index

## 목표

scentSampler의 O(n) 전체 배열 순회를 공간 그리드 인덱스 기반 O(k) 근접 검색으로 전환한다.
셀 크기는 `sensorRadius`로 고정, 매 프레임 flatMap+rebuild 통합 O(n) 1회.

## 설계 결정

- 셀 크기 = `sensorRadius` (TrackingParams.sensorRadius)
- rebuild 전략 = 매 프레임, flatMap과 통합하여 O(n) 1회
- grid 자료구조 = `Map<string, ScentPoint[]>` (키 = `"cx,cy"`)

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 | 의존 |
|---|---|---|---|---|
| 1 | grid-types | `src/types/scent.ts` | `ScentGridCell`, `ScentGrid` 인터페이스 정의 | 없음 |
| 2 | grid-service | `src/services/scentGrid.ts` (신규) | `ScentGrid` 클래스: `build()`, `queryBySector()` 구현 | task-1 |
| 3 | sampler-grid | `src/services/scentSampler.ts` | `sampleScentAt`, `sampleScentDetail`, `sampleScentInSector` → grid 인자 기반 개조 | task-2 |
| 4 | wiring | `src/runtime/sceneRuntime.ts`, `src/services/Pursuer.ts` | flatMap+rebuild 통합, Pursuer에 grid 전달 | task-2, task-3 |

## 의존 그래프

```
task-1 → task-2 → task-3 → task-4
                   ↘ task-4
```
task-1: 병렬 가능 (의존성 없음)
task-2: task-1 완료 후
task-3: task-2 완료 후
task-4: task-2, task-3 완료 후
