# task-4-visual

## 읽어야 할 파일
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `src/runtime/scentVisualizer.ts`
- `src/types/scent.ts` (task-1 완료 후)

## 작업

1. `scentVisualizer.ts`의 `update` 함수에서 age 기반 ratio 계산 수정. 기존:
   ```
   const maxTrailAge = profile?.maxTrailAge ?? 10000;
   const ratio = Math.max(0, Math.min(1, age / maxTrailAge));
   ```
   이 부분은 `maxTrailAge` 기반 하드 리밋이므로 유지. 페이드 속도는 per-point tauDecay 기반으로 변경:
   ```
   const decayFactor = Math.exp(-age / point.tauDecay);
   const ratio = 1 - decayFactor;  // decayFactor 1→0 = ratio 0→1
   ```
   `ratio`가 0(신선) → 1(거의 사라짐)이 되도록. 기존 로직과 동일한 방향이지만 감쇠 곡선이 per-point tauDecay 반영.

2. height lerp, scale lerp, color fade 모두 이 `ratio` 기반이므로 자동으로 per-point 감쇠 반영됨.

## Acceptance Criteria
- `npm run test` 통과 (task-1~3 완료 후)
- ARCHITECTURE.md 레이어 구조 준수 (runtime 레이어)
- ADR 기술 스택 준수
- AGENTS.md 규칙 준수
- Three.js API가 runtime 레이어 밖으로 누수되지 않음

## 금지사항
- 명시되지 않은 파일 생성 금지
- types, config, services, ui 레이어 파일 수정 금지