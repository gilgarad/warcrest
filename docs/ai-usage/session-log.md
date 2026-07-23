# AI 활용 세션 로그

NHN `nan2026` 게임잼 제출물 4번(AI 활용 기술 문서) 작성을 위한 원본
기록. `docs/dev-wiki/log.md`(작업 이력/백로그용)와는 별개로, 매 세션마다
"무엇을 지시했고 AI가 무엇을 만들었는지"를 남긴다. 형식과 갱신 주기는
`README.md` 참고.

---

## 2026-07-23 (1) — 프로젝트 부트스트랩

- **사용 도구**: Claude Code (Sonnet 5)
- **사용자 지시 요약**: 기존 stock_predict_rev 세션에서 분리하여
  `/data/projects/game_project1`이라는 새 프로젝트를 만들고, 이후 이
  세션은 그 폴더에서만 작업하도록 지시. NHN `nan2026` AI 게임잼 참가가
  목적이며(AI 코딩 에이전트로 게임 제작), 제출물 중 "1. 플레이 가능한
  빌드 및 소스 코드"를 이 저장소로 만들어야 함을 설명. 매 턴의 지시/응답을
  기록해 AI 활용도를 보여줄 것, GitHub 연동은 추후 저장소가 생기면 진행,
  자격증명은 `/data/projects/stock_predict`의 방식을 재사용할 것,
  `/data/projects/harness/APPLY_THIS_HARNESS.md`로 로컬 하네스를 먼저
  설치할 것을 요청.
- **AI 산출물 요약**:
  - `/data/projects/game_project1` 생성, `git init` 및 로컬 identity
    설정(`gilgarad` / `emeprorsim@gmail.com`, 기존 로컬 저장소들과 동일).
  - `/data/projects/harness/bin/harness-apply`로 운영 하네스 스켈레톤
    적용 (`AGENTS.md`, `docs/index.md`, `docs/dev-wiki/*`, `docs/rules/*`,
    `docs/patterns/*`, `docs/knowledge/*`, `docs/wiki/*`, `docs/harness/*`
    19개 파일).
  - 게임잼 프로젝트에 맞게 `docs/rules/testing.md`,
    `docs/patterns/README.md`, `docs/knowledge/index.md`,
    `docs/dev-wiki/backlog.md`를 재작성 (스택 미정 상태를 명시하고,
    결정 후 채워야 할 자리로 남김). `AGENTS.md` 등 공통 규약 파일은
    범용 상태 유지.
  - 이 디렉터리(`docs/ai-usage/`)를 신설해 대회용 AI 활용 로그 체계를
    별도로 구축.
  - GitHub 자격증명: stock_predict가 로컬 `.git/config`에
    `https://<user>:<PAT>@github.com/...` 형태로 토큰을 저장하는 방식을
    확인. 실제 토큰 값은 어떤 문서에도 기록하지 않았고, 저장소가 아직
    없어 remote는 설정하지 않음 — 저장소가 생기면 같은 방식으로 연동
    예정.
  - 결정하지 않은 것: 게임 컨셉, 엔진/기술 스택, 배포 방식(GitHub
    Pages 등). 다음 턴에 사용자와 상의 예정.