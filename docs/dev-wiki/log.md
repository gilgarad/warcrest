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
