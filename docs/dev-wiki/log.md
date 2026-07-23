# Dev-Wiki Log

Append-only chronology.

Use consistent headings so entries are easy to grep.

## [2026-07-23] maintenance | initial harness setup

- Created operating harness skeleton.

## [2026-07-23] setup | game_project1 부트스트랩 (NHN nan2026 게임잼)

- `/data/projects/game_project1`을 stock_predict와 완전히 무관한 신규
  독립 저장소로 생성. 목적은 AI 코딩 에이전트(Claude Code / Codex /
  Gemini 등)로 NHN `nan2026` AI 게임잼용 플레이 가능한 게임을 만드는 것.
- 로컬 운영 하네스 적용(`harness-apply --project-name game_project1`) 후
  `docs/rules/testing.md`, `docs/patterns/README.md`,
  `docs/knowledge/index.md`, `docs/dev-wiki/backlog.md`를 이 프로젝트에
  맞게 재작성. `AGENTS.md`, `docs/index.md`,
  `docs/dev-wiki/contract.md`, `docs/rules/workflow.md`,
  `docs/rules/docs.md`, `docs/rules/security.md`는 범용 상태 유지.
- `git init` 실행, 로컬 identity를 다른 로컬 저장소와 동일하게
  `gilgarad` / `emeprorsim@gmail.com`으로 설정. 아직 remote는 없음 —
  사용자가 별도로 GitHub 저장소를 만들어 추후 전달할 예정.
- 대회 제출물 4번 "AI 활용 기술 문서" 근거 자료로 쓸 `docs/ai-usage/`를
  신설. 이 dev-wiki log와는 별개로, 매 턴 사용자 지시와 AI 산출물을
  기록하는 용도.
- 워크플로 기본값에서 벗어난 점: 아직 GitHub 저장소/이슈가 없어서 이번
  부트스트랩 커밋은 브랜치/이슈 없이 `master`에 바로 올라감. 저장소가
  생기면 실제 기능 작업부터는 `docs/rules/workflow.md`대로
  `issue-<n>-topic` 브랜치로 전환.
- 게임 컨셉과 기술 스택은 아직 미정 — 다음 단계는 코드 작성 전에
  사용자와 상의하는 것.

## [2026-07-23] design | 게임 컨셉 확정: 갈림길 정찰대

- 사용자와 상의해 장르/핵심 루프/전투 시스템/아트 스타일을 결정.
  전체 내용은 `docs/dev-wiki/game-concept.md`에 정리.
- 요약: 로그라이트 갈림길 정찰 액션, 파타퐁식 커맨드 전투(타이머 바
  소진형, 병종 조합에 따라 덱 폭 결정), 구출로 대열이 늘고 전투 손실로
  줄어드는 스쿼드 시스템, AI 생성 픽셀아트, 웹 전용 배포, 임팩트
  포인트는 완성도/폴리싱.
- 스코프 리스크를 문서에 명시: 요소가 잼 스코프치고 많아서
  MVP(최소 루프 → 대열 증감 → 병종 다양화 → 생성/폴리싱 순) 단계적
  확장을 권장함으로 기록해둠.
- `docs/dev-wiki/backlog.md`의 Active Queue를 "게임 컨셉 선택"에서
  "기술 스택 선택"으로 갱신.
- 아직 GitHub 저장소/이슈가 없어 이 결정도 백로그+로그 기록으로만
  남김.

## [2026-07-23] setup | 기술 스택 확정 및 최소 스캐폴드 검증

- Phaser 3 + TypeScript + Vite로 확정. `npm create vite`가 비어있지 않은
  디렉터리에서 비대화형으로 진행되지 않아(prompt 취소) 수동으로
  `package.json`/`tsconfig.json`/`index.html`/`src/main.ts`/
  `src/scenes/BootScene.ts`를 작성.
- `BootScene`은 실제 아트/전투 없이 파이프라인만 검증하는 placeholder:
  `Graphics.generateTexture`로 만든 줄무늬 패럴랙스 2겹, 자동 이동하는
  사각형 "병사", 제목 텍스트.
- 검증: `npm run build`(tsc --noEmit + vite build) 성공, `npm run dev`를
  백그라운드로 띄운 뒤 Playwright로 스크린샷 촬영해 실제 캔버스 렌더링을
  육안 확인, 확인 후 dev 서버 종료. 두 검증 방식 모두
  `docs/rules/testing.md`에 기본 검증 표준으로 기록.
- `npm audit`에서 esbuild/vite 관련 moderate 취약점 1건 발견(dev 서버
  전용 CORS 이슈, breaking major 업그레이드 필요) — 로컬 개발 서버에만
  영향이라 지금 단계에서는 강제 업그레이드하지 않고 인지만 해둠.
- `docs/rules/testing.md`, `docs/patterns/README.md`를 실제 스택 기준으로
  재작성(placeholder 문구 제거).
- `docs/dev-wiki/backlog.md` Active Queue를 "기술 스택 선택"에서
  "핵심 루프 구현"으로 갱신.
- 여전히 GitHub 저장소/이슈가 없어 백로그+로그 기록으로만 남김.

## [2026-07-23] feature | MVP 핵심 루프 첫 구현

- 사용자 지시: 병종 등 디테일 추가는 나중으로 미루고, 확장 가능한
  구조로 가볍게 한 판 플레이 가능한 수준까지 끝까지 구현해서 화면으로
  직접 확인 후 변경 지시를 하겠다고 함. 그래픽은 "예쁜 가분수 캐릭터"
  요청.
- 확장 지점을 데이터 레지스트리로 분리: `src/data/unitTypes.ts`
  (병종), `src/data/commands.ts`(전투 커맨드), `src/data/encounterTypes.ts`
  (갈림길 결과 종류). RunScene/시스템 코드는 이 레지스트리를 순회/조회만
  할 뿐 특정 항목을 하드코딩하지 않음 — 새 병종/커맨드 추가는 레지스트리에
  엔트리 하나 넣는 것으로 끝나도록 설계.
- UI 없는 순수 로직 계층 `src/systems/`(squad.ts, runGenerator.ts,
  combat.ts)와 Phaser 종속 렌더링 계층(`src/scenes/`, `src/gfx/`)을 분리.
- 이미지 생성 도구가 이 환경에 없어서, `src/gfx/chibi.ts`가 Phaser
  Graphics API로 직접 그리는 "가분수"(큰 머리/작은 몸) 캐릭터로 실제
  픽셀아트를 대체. Playwright로 고해상도 확대 스크린샷을 찍어 눈·블러셔·
  모자 디테일을 확인하며 반복 조정.
- `RunScene`에 갈림길 선택 → 전투(파타퐁식 커맨드+타이머 바) → 구출 →
  미션 → `GameOverScene`까지 전체 루프 구현. `BootScene`을 타이틀
  화면으로 재구성(패럴랙스 배경 + 미리보기 대열 + 시작 프롬프트).
- 검증: `npm run build` 통과. `window.__gameDebug`(현재 phase/진행도/
  전투 상태를 매 프레임 노출하는 디버그 전용 훅, 게임플레이 로직에서는
  읽지 않음)를 만들어 Playwright 스크립트가 랜덤 분기(전투/구출)를 실제
  상태 기반으로 판단하며 클릭하도록 구성, 갈림길 5회 전부를 거쳐 미션
  성공 화면까지 헤드리스로 완주 확인. 승리 화면 스크린샷도 별도로 확보.
- `docs/patterns/README.md`, `docs/rules/testing.md`,
  `docs/dev-wiki/game-concept.md`에 구조/검증 방식/MVP 진행 상태 반영.
- 다음 단계는 사용자가 직접 플레이해보고 주는 변경 지시를 기다리는 것 —
  병종 다양화, 커맨드 확장, 난이도 곡선 등은 의도적으로 보류.
- 여전히 GitHub 저장소/이슈가 없어 백로그+로그 기록으로만 남김.
