# plan-71-last-scent-cell-sentinel-grid-unify

## 목표

`_lastScentGridX/Y` sentinel `-1` 충돌 버그 수정 + Pursuer/scentSampler/sceneRuntime이 `ScentGridImpl`의 cell 좌표계를 공유하도록 통합.

## 문제

1. **sentinel `-1` 충돌**: `-1`을 "미감지"로 쓰는데, worldLeft가 음수인 맵 좌측 절반에선 실제 cell 인덱스도 음수. `>=0` 조건에 걸려 lost 탐색+시각화가 좌측 맵에서 무력화.
2. **좌표계 불일치**: Pursuer, scentSampler, sceneRuntime이 `Math.floor(x / cellSize)`로 origin-centric cell 인덱스를 직접 계산 → ScentGridImpl의 `worldToCell()` (`Math.floor((x - worldLeft) / cellSize)`) 과 다른 결과.
3. **분산된 계산 로직**: 같은 cell 인덱스 계산이 4군데 이상에 흩어져 있음.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
|---|---|---|---|
| 1 | sgrid-api | `src/types/scent.ts`, `src/services/scentGrid.ts` | `ScentGrid` 인터페이스에 `worldToCell()`, `cellToWorld()` 추가, `ScentGridImpl` 구현 |
| 2 | pursuer-fix | `src/services/Pursuer.ts` | sentinel `null`로 변경, grid API 사용으로 전환, lost 탐색 cellToWorld 사용 |
| 3 | runtime-sampler-align | `src/runtime/sceneRuntime.ts`, `src/services/scentSampler.ts`, `src/types/pursuer.ts` | sceneRuntime sentinel 조건 수정, scentSampler visited 필터 grid API 사용, PursuerState 타입 수정 |

## 의존성

```
task-1-sgrid-api
  ├── task-2-pursuer-fix       (순차)
  └── task-3-runtime-sampler-align  (병렬)
```

task-2와 task-3은 task-1 완료 후 병렬 실행 가능.
