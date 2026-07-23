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

## [2026-07-23] fix | 원격 접속 안내 — dev 서버 재기동

- 사용자가 SSH 포트포워딩(`ssh -L 5173:localhost:5173 -p 201 ...`)으로
  접속을 시도했는데 실패. 원인 확인: 이전 검증 후 dev 서버를 꺼놨던 것이
  원인(포워딩할 대상이 없었음). sshd `AllowTcpForwarding` 설정도 확인해
  차단이 아님을 확인. `npm run dev -- --port 5173`으로 재기동 후
  `127.0.0.1:5173` 응답 확인, 사용자에게 재접속 안내.

## [2026-07-23] redesign | 던전 탐험형으로 전면 재설계

- 사용자가 MVP(갈림길 메뉴 클릭형)를 보고 강하게 정정: 원래 예시로 든
  "디아블로 던전에서 실제로 움직이며 적을 죽이고 감옥에 갇힌 동료를
  구출" 이미지가 "왼쪽 길/오른쪽 길" 버튼 메뉴로 추상화되면서 핵심이
  사라졌다는 피드백. 인정하고 방향을 다시 잡음.
- 조작/시점을 먼저 확정: 방향키/WASD 실시간 이동, 탑다운 + 제한된
  시야(안개)+미니맵(디아블로 레퍼런스 그대로).
- `src/systems/dungeonGenerator.ts` 신설: 랜덤워크 방식으로 통로를
  깎는 절차적 던전 생성기. 메인 경로 하나 + 짧은 곁가지 2개로 실제
  갈림길을 만들고, 방마다 전투/구출 배정은 기존 `pickRandomForkKind`
  가중치 로직을 그대로 재사용(밸런스 로직 이원화 방지).
  - 초기 버전에서 방들이 시작 지점 근처에 다 뭉쳐서 생성되는 버그
    발견(분기 로직이 각 반복마다 워커 수만큼 방을 만들어 사실상
    지수적으로 늘어나던 문제) → 메인 경로+제한된 곁가지 2개로 구조를
    단순화해 해결.
- `src/scenes/RunScene.ts`(메뉴 기반)를 삭제하고
  `src/scenes/DungeonScene.ts`로 교체. Phaser Arcade Physics로 플레이어
  이동/충돌, 적·포로는 접촉 시 전투/구출 발동(포로는 자동, 적은 전투
  오버레이로 일시정지). 기존 전투(파타퐁 커맨드+타이머)·대열
  시스템(`squad.ts`, `combat.ts`, `commands.ts`)은 그대로 재사용 —
  상호작용 계층만 교체.
- 실제 버그 하나 발견·수정: 플레이어 충돌 박스를 "발 위치" 기준으로
  오프셋했더니(사이드뷰 관습) Arcade Physics의 body offset이 스프라이트
  origin이 아니라 프레임 좌상단 기준으로 계산돼서, 충돌 박스가 실제로는
  한 칸 아래 행으로 밀려 들어가 있었음 — 통로가 뻥 뚫려 있는데도 몇 칸
  못 가고 막히는 것처럼 보였음. `physics.arcade.debug: true`로 충돌
  박스를 시각화해서 원인을 확인 후, 탑다운 게임에 맞게 프레임 중앙
  기준으로 오프셋을 다시 계산해 해결.
- 검증: `npm run build` 통과. Playwright로 `window.__gameDebug`가 노출하는
  던전 그리드에 BFS를 돌려 시작→출구 경로를 계산하고, 실제로 화살표 키를
  눌러 그 경로를 따라가며(전투 조우 시 자동으로 공격 버튼 스팸) 완주하는
  헤드리스 테스트 작성 — 승리 화면(`win: true`)까지 확인.
- `docs/dev-wiki/game-concept.md`에 "방향 정정" 섹션과 갱신된 핵심 루프
  기록, `docs/patterns/README.md`에 던전 생성/충돌 버그/안개-미니맵
  패턴 추가, `docs/rules/testing.md`에 BFS 기반 헤드리스 검증 방식 기록.
- 여전히 GitHub 저장소/이슈가 없어 백로그+로그 기록으로만 남김.
