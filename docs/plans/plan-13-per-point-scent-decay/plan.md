# plan-13-per-point-scent-decay

## 목표

`tauDecay`를 전역 단일값에서 ScentPoint마다 랜덤 배정으로 변경. 같은 종족 내에서도 개별 냄새 흔적이 다르게 감쇠.

## 포함 범위

- `ScentPoint.tauDecay` 필드 추가
- `OwnerScentProfile`에 `tauDecayMin`/`tauDecayMax` 범위 추가
- `emitTrailPoint`에서 범위 내 랜덤 tauDecay 배정
- `sampleScentAt`에서 per-point tauDecay 사용
- `scentVisualizer`에서 per-point tauDecay로 페이드 계산
- 관련 테스트 업데이트

## 제외 범위

- 종족별 구체 감쇠 수치 튜닝 (나중에)
- 새 ownerType 추가
- 새 파일/레이어 생성
- 행동/AI 로직

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
|---|---|---|---|
| 1 | types | `src/types/scent.ts` | `ScentPoint.tauDecay` 추가, `OwnerScentProfile`에 `tauDecayMin`/`tauDecayMax` 추가 |
| 2 | config | `src/config/scentConfig.ts` | `OWNER_PROFILES`에 종족별 `tauDecayMin`/`tauDecayMax` 설정 |
| 3 | service | `src/services/scentService.ts` | `emitTrailPoint`에서 랜덤 tauDecay 배정, `sampleScentAt`에서 per-point tauDecay 사용 |
| 4 | visual | `src/runtime/scentVisualizer.ts` | per-point tauDecay 기반 height/color 페이드 계산 |
| 5 | tests | `tests/unit/scentService.test.ts`, `tests/unit/scentConfig.test.ts`, `tests/unit/scentVisualizer.test.ts`, `tests/integration/sceneRuntime.scent.test.ts` | 모든 변경에 맞게 테스트 업데이트 |

## 의존 관계

task-1 → task-2 → task-3 → task-4 → task-5 (순차)