# task-1-types

## 읽어야 할 파일
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `src/types/scent.ts`

## 작업

1. `ScentPoint` 인터페이스에 `tauDecay: number` 필드 추가. 각 냄새 점이 생성 시 할당받는 개별 감쇠 시간상수.

2. `OwnerScentProfile` 인터페이스에 `tauDecayMin: number`와 `tauDecayMax: number` 필드 추가. 종족별 감쇠 범위의 하한/상한. `emitTrailPoint`에서 이 범위 내 랜덤값을 ScentPoint에 배정.

3. `ScentParams`에서 기존 `tauDecay: number` 필드는 유지. 기본값(=공통 fallback) 용도. `tauDecayMin`/`tauDecayMax`가 지정되지 않았을 때 사용.

## Acceptance Criteria
- `npm run test` 통과
- ARCHITECTURE.md 레이어 구조 준수 (types 레이어)
- ADR 기술 스택 준수
- AGENTS.md 규칙 준수

## 금지사항
- 명시되지 않은 파일 생성 금지
- services, runtime, config 레이어 파일 수정 금지