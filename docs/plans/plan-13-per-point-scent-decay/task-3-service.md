# task-3-service

## 읽어야 할 파일
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `src/services/scentService.ts`
- `src/types/scent.ts` (task-1 완료 후)

## 작업

1. `emitTrailPoint`에서 ScentPoint 생성 시 `tauDecay` 필드 추가 할당. `profile.tauDecayMin`과 `profile.tauDecayMax` 사이에서 균등 난수로 배정:
   ```
   tauDecay: profile.tauDecayMin + Math.random() * (profile.tauDecayMax - profile.tauDecayMin)
   ```

2. `sampleScentAt`에서 시간 감쇠 계산 수정. 기존:
   ```
   intensity = point.baseIntensity * Math.exp(-age / params.tauDecay)
   ```
   변경:
   ```
   intensity = point.baseIntensity * Math.exp(-age / point.tauDecay)
   ```
   per-point tauDecay 사용. `params.tauDecay`는 fallback으로만 유지 가능하나 point에 항상 값이 있으므로 `point.tauDecay` 우선.

3. `trimExpiredTrails` 수정 여부 확인. `maxTrailAge`는 전역값이므로 변경 불필요. 다만 per-point tauDecay로 인해 유효 수명이 달라질 수 있으나, `maxTrailAge`는 하드 리밋이므로 그대로 유지.

## Acceptance Criteria
- `npm run test` 통과 (task-1, task-2 완료 후)
- ARCHITECTURE.md 레이어 구조 준수 (services 레이어)
- ADR 기술 스택 준수
- AGENTS.md 규칙 준수

## 금지사항
- 명시되지 않은 파일 생성 금지
- types, config, runtime, ui 레이어 파일 수정 금지