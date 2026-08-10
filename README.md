# Warcrest

전선과 요새를 두고 충돌하는 지휘 전장 — 넓은 대각선 레인 전장에서 자동
웨이브와 경제를 운영하는 전략 게임입니다.

> NHN `nan2026` AI 게임잼 출품작. 게임 로직/에셋 생성/디버깅 전 과정을
> Claude Code(AI 코딩 에이전트)와의 협업으로 만들었습니다 — 과정 기록은
> [`docs/ai-usage/session-log.md`](docs/ai-usage/session-log.md)에 있습니다.

## 바로 플레이하기

설치 없이 브라우저에서 바로 플레이할 수 있습니다.

**▶ [https://gilgarad.github.io/game_project1/](https://gilgarad.github.io/game_project1/)**

- PC/모바일 브라우저 모두 지원(Chrome 계열 권장).
- 별도 설치·로그인·결제 없이 링크만 열면 바로 시작됩니다.

## 게임 방법

1. 화면 첫 화면에서 난이도(초급 / 중급 / 고급 / 신)를 선택하면 전장에
   입장합니다.
2. 아군 본진(좌하단)과 적 본진(우상단) 사이 대각선 레인을 따라 병력이
   **자동으로 편성·이동·전투**합니다 — 직접 유닛을 조작하지 않는
   오토배틀러/공성 경제 게임입니다.
3. 플레이어는 화면 하단 패널에서 경제와 진행을 운영합니다:
   - **일꾼 배치**: 금/목재/식량/금속/연구 자원에 일꾼을 `+`/`-`로 재배치
   - **일꾼 고용 / 연구 일꾼**: 자원을 소모해 일꾼 인원 자체를 늘림
   - **즉시 웨이브**: 토큰을 소모해 다음 정규 웨이브를 기다리지 않고
     즉시 병력을 출전(쿨다운/자원 조건 있음)
   - **시대 업**: 자원을 모아 다음 시대로 진행 — 더 강한 병종과 시설이
     열립니다
4. 전장 중앙의 **거점**을 점령해 시설(방어 타워/병참/조달소)을 지으면
   전황에 유리해집니다. 거점/타워를 클릭하면 건설·재건·폐기 액션이
   나타납니다.
5. **승리/패배**: 상대 본진 체력을 0으로 만들면 승리, 내 본진 체력이
   0이 되면 패배합니다.

## 로컬에서 실행하기 (개발자 / 소스 빌드용)

```bash
git clone https://github.com/gilgarad/game_project1.git
cd game_project1
npm install
npm run dev       # http://localhost:5173/game_project1/ — 개발 서버(HMR)
```

프로덕션 빌드:

```bash
npm run build      # 타입체크 + dist/ 정적 빌드
npm run preview     # 빌드 결과 로컬 미리보기
```

요구 사항: Node.js 20 이상, npm.

## 오디오/사운드 미리듣기 (개발자용)

`?sandbox=2`로 접속하면 게임 내 모든 효과음/배경음을 카테고리별로 직접
들어볼 수 있는 오디오 랩 화면이 뜹니다 (예:
`http://localhost:5173/game_project1/?sandbox=2`).
유닛 애니메이션만 따로 확인하려면 `?sandbox=1`.

## 기술 스택

- [Phaser 3](https://phaser.io/) + TypeScript + Vite
- 효과음: 실제 CC0 레퍼런스 녹음을 분석해 그래뉼러 방식으로 완전히 새로
  합성 (원본 파형은 출력에 포함되지 않음) — 자세한 내용은
  [`tools/audio-synth/render_combat_sfx.py`](tools/audio-synth/render_combat_sfx.py)와
  [`tools/audio-synth/vendor/`](tools/audio-synth/vendor/)의 라이선스 파일 참고.
- 배경음/유닛·건물 아트: 자체 생성 자산.

## 문서

| 문서 | 내용 |
|---|---|
| [`docs/ai-usage/session-log.md`](docs/ai-usage/session-log.md) | AI 활용 기록(대회 제출용) |
| [`docs/dev-wiki/log.md`](docs/dev-wiki/log.md) | 전체 개발 이력 |
| [`docs/knowledge/contest-requirements.md`](docs/knowledge/contest-requirements.md) | 대회 제출 요건 원문 |
| [`AGENTS.md`](AGENTS.md) | 이 저장소의 에이전트 운영 규칙 |

## GitHub Pages 배포

`master`에 푸시할 때마다 `.github/workflows/deploy-pages.yml` 워크플로가
자동으로 빌드 후 GitHub Pages에 배포합니다. 현재 활성화되어 정상 배포 중이며,
위 플레이 링크가 그 결과물입니다.

## 라이선스

_(TODO: 프로젝트 라이선스 명시 필요)_
