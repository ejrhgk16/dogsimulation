# task-5-tests

## 읽어야 할 파일
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `tests/unit/scentService.test.ts`
- `tests/unit/scentConfig.test.ts`
- `tests/unit/scentVisualizer.test.ts`
- `tests/integration/sceneRuntime.scent.test.ts`
- `src/types/scent.ts` (task-1 완료 후)
- `src/config/scentConfig.ts` (task-2 완료 후)
- `src/services/scentService.ts` (task-3 완료 후)
- `src/runtime/scentVisualizer.ts` (task-4 완료 후)

## 작업

1. `scentConfig.test.ts` 업데이트:
   - `DEFAULT_SCENT_PARAMS`에 `tauDecayMin`/`tauDecayMax` 검증 추가
   - `OWNER_PROFILES` 각 종족에 `tauDecayMin`/`tauDecayMax` 검증 추가
   - `getOwnerProfile` fallback에 `tauDecayMin`/`tauDecayMax` 검증 추가

2. `scentService.test.ts` 업데이트:
   - `ScentPoint` 생성 시 `tauDecay` 필드 포함 확인 (`makeScentPoint`에 `tauDecay` 기본값 추가)
   - `emitTrailPoint` 테스트에서 생성된 ScentPoint의 `tauDecay`가 `tauDecayMin`~`tauDecayMax` 범위 내인지 검증
   - `sampleScentAt` 테스트에서 per-point `tauDecay` 기반 감쇠 계산 검증. 고정값 `params.tauDecay` 대신 `point.tauDecay` 사용 확인
   - `Math.random` mock 필요한 경우(emitTrailPoint의 랜덤 tauDecay 배정) 고려

3. `scentVisualizer.test.ts` 업데이트:
   - 테스트 fixture ScentPoint에 `tauDecay` 필드 추가
   - per-point tauDecay 기반 페이드 계산 검증

4. `sceneRuntime.scent.test.ts` 업데이트:
   - 통합 테스트에서 per-point tauDecay 흐름 검증

## Acceptance Criteria
- `npm run lint && npm run format:check && npm run build && npm run test` 전부 통과
- ARCHITECTURE.md 레이어 구조 준수
- ADR 기술 스택 준수
- AGENTS.md 규칙 준수
- 기존 통과하던 테스트가 깨지지 않음

## 금지사항
- 명시되지 않은 파일 생성 금지
- 테스트 통과를 위해 기존 테스트 삭제/비활성화 금지
- lint 규칙 주석으로 우회 금지