# task-2-config

## 읽어야 할 파일
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `src/config/scentConfig.ts`
- `src/types/scent.ts` (task-1 완료 후)

## 작업

1. `DEFAULT_SCENT_PARAMS`에 `tauDecayMin`/`tauDecayMax` 필드 추가. 기존 `tauDecay: 8000` 유지, `tauDecayMin: 6000`, `tauDecayMax: 10000` 설정 (임시값, 추후 튜닝).

2. `OWNER_PROFILES`의 각 종족에 `tauDecayMin`/`tauDecayMax` 추가:
   - dog: `tauDecayMin: 6000`, `tauDecayMax: 10000`
   - cow: `tauDecayMin: 8000`, `tauDecayMax: 14000`
   - pig: `tauDecayMin: 4000`, `tauDecayMax: 8000`
   
   임시값. 종족별 경향만 반영 (돼지 빠름, 개 중간, 소 느림).

3. `getOwnerProfile`에서 알 수 없는 종족의 fallback에도 `tauDecayMin`/`tauDecayMax` 포함.

4. `ScentParams`에 `tauDecayMin`/`tauDecayMax` 필드가 추가되었으므로 `DEFAULT_SCENT_PARAMS`에도 반영.

## Acceptance Criteria
- `npm run test` 통과 (task-1 완료 후 실행)
- ARCHITECTURE.md 레이어 구조 준수 (config 레이어)
- ADR 기술 스택 준수
- AGENTS.md 규칙 준수

## 금지사항
- 명시되지 않은 파일 생성 금지
- services, runtime 레이어 파일 수정 금지