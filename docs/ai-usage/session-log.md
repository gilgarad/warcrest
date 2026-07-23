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

## 2026-07-23 (2) — 게임 컨셉 확정

- **사용 도구**: Claude Code (Sonnet 5)
- **사용자 지시 요약**: "컨셉부터 정하자"는 방향 확인 후, 사용자가
  아이디어 3가지(디아블로류 미니맵 던전, 병사 구출 대열 게임, 2인용
  협동 노젓기 게임)를 자유 서술로 제시하며 비슷한 계열의 추가 제안을
  요청. AI가 A(안개 시야 구출 던전)/B(갈림길 정찰대)/C(손그림 던전)
  3안을 제안하자 B 선택. 전투 방식 질문에는 "파타퐁 느낌, 덱에서
  타이밍 맞춰 커맨드 입력, 타이머 바가 빠르게 줄어드는 형식, 병종이
  여러 개 섞이는 플로우 중심"이라고 구체화. 아트 방식은 "AI 생성
  픽셀아트" 선택. 임팩트는 완성도/폴리싱, 플랫폼은 웹만으로 앞서
  확정.
- **AI 산출물 요약**:
  - AskUserQuestion으로 장르/전투/아트/임팩트/플랫폼을 단계적으로
    좁혀 컨셉을 구체화.
  - `docs/dev-wiki/game-concept.md` 신설 — 한줄소개, 핵심 루프, 파타퐁식
    커맨드 전투 설계, 대열 시스템, 아트 방침, 스코프 리스크와 MVP
    확장 순서를 정리.
  - `docs/dev-wiki/index.md`, `docs/index.md`에 새 문서 링크 반영.
  - `docs/dev-wiki/backlog.md` Active Queue를 "게임 컨셉 선택" →
    "기술 스택 선택"으로 갱신, Recently Closed에 컨셉 확정 항목 추가.
  - `docs/dev-wiki/log.md`에 한국어로 결정 사항 기록(사용자 기존 피드백:
    dev-wiki log.md 신규 항목은 한국어로 작성).
  - 에이전트가 자체적으로 짚은 리스크: 로그라이트 절차 생성 + 커맨드
    전투 + 대열 관리 + AI 픽셀아트 조합이 잼 스코프 대비 요소가 많다는
    점을 문서에 명시적으로 남기고, MVP 단계 축소안을 제시함.
  - 결정하지 않은 것: 게임 제목, 기술 스택/프레임워크, 병종·커맨드
    구체 목록, 미션 구조. 다음 턴에 기술 스택부터 상의 예정.