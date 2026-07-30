# 프로젝트 현황판 (project_development.md)

**이 문서 하나로 "지금 뭐가 됐고 뭘 해야 하는지" 파악하고 바로 다음 작업을
시작할 수 있어야 합니다.** 새 세션(다른 대화, 다른 에이전트)이 이 프로젝트를
다시 열 때 제일 먼저 읽는 문서로 씁니다.

이 문서는 하네스 운영 규칙을 대체하지 않습니다. **에이전트 운영 규칙은
여전히 `AGENTS.md` → `docs/index.md` → `docs/dev-wiki/contract.md` 순서가
원본**입니다. 이 문서는 그 위에 얹는 "현재 상태 요약 + 링크 허브"입니다.

> **유지 규칙**: 의미 있는 작업 세션이 끝나면 이 문서의 5번(지금까지)·6번
> (다음 할 일) 섹션을 최신 상태로 갱신하세요. 갱신을 안 하면 이 문서는
> 금방 쓸모없어집니다.

---

## 0. 세션 시작 시 반드시 할 일 (체크리스트)

1. `AGENTS.md` → `docs/index.md` → `docs/dev-wiki/contract.md` 순서로 읽기
   (사용자가 "하네스 규약대로 작업해"라고만 말해도 이 순서는 항상 적용).
2. 이 문서(`project_development.md`)의 4·5번 섹션으로 현재 상태 파악.
3. **매 턴 `docs/ai-usage/session-log.md`에 기록 남기기.** 이건
   `docs/dev-wiki/contract.md`의 "The Second Rule"(이 프로젝트 전용
   필수 규칙)이자 대회 제출물 4번(AI 활용 기술 문서)의 원본 자료입니다.
   "하네스 규약대로 작업해"라는 말 안에 이미 포함된 지시이므로, 사용자가
   따로 언급하지 않아도 지킬 것 — `docs/ai-usage/README.md`에 형식/주기
   설명이 있음.

---

## 1. 프로젝트가 뭔가

- **NHN `nan2026` AI 게임잼** 출품작. AI 코딩 에이전트(Claude Code 등)로
  게임을 만드는 과정 자체가 대회 취지 — 그래서 `docs/ai-usage/`에 매 턴
  기록을 따로 남기고 있음(아래 8번 참고).
- 이 저장소는 대회 제출물 5종 중 **"1. 플레이 가능한 빌드 및 소스 코드"**만
  담당. 나머지(플레이 영상, 게임 소개서, AI 활용 문서, 팀원 롤 문서)는
  이 저장소의 문서/이력을 근거로 나중에 별도로 만듦.
- **공식 제출 요건 전문**은 `docs/knowledge/contest-requirements.md`에
  원문 그대로 저장돼 있음 — 제출물 4번(AI 활용 기술 문서)이 "AI 대상
  주요 프롬프트 및 지시 사항"을 명시적으로 요구하므로,
  `docs/ai-usage/session-log.md`는 요약뿐 아니라 방향 전환/피드백 turn의
  **원문 인용**도 남기는 중(`docs/ai-usage/README.md` 참고).
- 현재 타이틀 표기는 **`Warcrest`** 로 임시 전환해 두었음.
  기존 `"갈림길 정찰대"` 명칭은 던전 탐험형 초기 콘셉트의 잔재라서,
  현재 레인 공성/거점 운영 게임 방향과 맞지 않음.
- **stock_predict_rev 등 다른 프로젝트와 완전히 무관한 독립 저장소.**
  GitHub 저장소는 이제 연결되어 있음:
  `https://github.com/gilgarad/game_project1.git`
  (`origin` configured, `master` pushed on 2026-07-26). 자격증명 패턴은
  `/data/projects/stock_predict`와 같은 계정을 재사용.

## 2. 지금 당장 실행하는 법

```bash
cd /data/projects/game_project1
npm run dev      # http://localhost:5173 — 개발 서버 (HMR)
npm run build    # tsc --noEmit && vite build — 타입체크 + 프로덕션 빌드
```

- **원격 서버에서 SSH로 접속해 보는 중이라면**: `ssh -L 5173:localhost:5173
  -p <port> user@host` 로 포트포워딩. 단, 이 서버(위 명령을 실행하는 쪽)에
  `npm run dev`가 실제로 떠 있어야 함 — 과거에 dev 서버를 꺼둔 채로
  포워딩만 시도해서 헤맨 적 있음(`docs/dev-wiki/log.md` "원격 접속 안내"
  항목).
- 자동 테스트 프레임워크는 아직 없음. 검증 표준은
  `docs/rules/testing.md` 참고 — 핵심은 `npm run build` + Playwright로
  직접 화면 확인, 그리고 `window.__gameDebug`(런타임 디버그 훅)를 이용한
  BFS 길찾기 기반 헤드리스 완주 테스트.

## 3. 기술 스택 & 아키텍처 한눈에

- **Phaser 3 + TypeScript + Vite.**
- **렌더링은 등각(isometric)이지만, 게임 로직은 전부 직교(ortho) 격자.**
  이동/충돌(Arcade Physics)/시야 반경(fog)/미니맵은 처음 만든 탑다운
  버전의 직교 좌표계를 그대로 씀 — 그리는 위치만
  `src/gfx/iso.ts`의 `isoProject()`를 거쳐 변환. 그래서 플레이어/적/포로/
  대열원은 전부 "보이지 않는 직교 물리 바디 + 매 프레임 등각 위치로
  동기화되는 시각 `Image`" 쌍으로 존재함 (`DungeonScene`의
  `playerBody`/`playerVisual` 패턴 참고).
- **던전은 절차적 생성** (`src/systems/dungeonGenerator.ts`): 랜덤워크로
  코리더를 깎는 방식, 메인 경로 + 짧은 곁가지 2~3개, 매 판 새로 생성.
  재현 가능성(도달 불가 구조 없음)은 "한 번의 연속된 walk"로 구조적으로
  보장됨.
- **전투는 MMO 핫바식** (`src/systems/combat.ts`): 적은 HP를 가짐, 화면
  오른쪽 상시 패널의 슬롯(현재 공격/방어 2개)은 각자 독립 쿨타임, 적도
  자체 타이머로 주기적으로 공격 — 방어 슬롯으로 가드 안 하면 대열 손실.
  정해진 순서를 입력하는 방식이 **아님** (그런 버전은 폐기됨).
- **확장 지점(데이터 레지스트리)** — 새 콘텐츠 추가 시 여기만 건드리면 됨:
  - `src/data/unitTypes.ts` — 병종(지금은 "병사" 1종)
  - `src/data/commands.ts` — 전투 커맨드(지금은 공격/방어 2개, 각각
    `role`/`cooldownMs` 보유)
  - `src/data/encounterTypes.ts` — 던전 방 콘텐츠 종류(전투/구출 가중치)
- **그래픽은 혼합 방식**:
  - 던전 바닥/벽/안개/일부 장식은 여전히 코드 기반 절차 텍스처
    (`src/gfx/iso.ts`, `DungeonScene` 내부 생성 텍스처).
  - 캐릭터 스프라이트, 타이틀/결과 일러스트, HUD 패널은 built-in
    `image_gen`으로 만든 비트맵 자산을 `public/assets/`에서 사용 중.
  - **실시간 3D 엔진/모델링 도구는 없음.** 따라서 현재 방향은 "2D 등각
    필드 + 생성 일러스트/스프라이트" 조합으로 모바일 게임 톤을 끌어올리는
    것.

### 파일 지도 (`src/`)

```
main.ts                    Phaser 게임 부트스트랩, 씬 등록
scenes/
  BootScene.ts              타이틀 화면 (패럴랙스 배경 + 미리보기 대열)
  DungeonScene.ts            메인 게임플레이 — 등각 렌더링/이동/충돌/전투/
                              대열/미니맵/안개/카메라 전부 여기 (가장 큰 파일)
  GameOverScene.ts           승패 화면 + 재시작
systems/                    Phaser에 의존하지 않는 순수 로직
  combat.ts                  전투 상태(HP/쿨타임/가드) + 규칙
  dungeonGenerator.ts         던전 절차 생성
  squad.ts                   대열 증감
data/                       확장 지점 레지스트리 (배열에 항목만 추가)
  unitTypes.ts / commands.ts / encounterTypes.ts
gfx/                        렌더링 헬퍼
  chibi.ts                   캐릭터 텍스처 생성(+ `shade()` 색상 헬퍼)
  iso.ts                     등각 투영 좌표변환 + 벽/바닥 텍스처
  parallax.ts                 BootScene 타이틀 화면용 패럴랙스 배경
```

## 4. 지금까지 뭘 만들었나 (요약 — 전체 이력은 `docs/dev-wiki/log.md`)

작업 순서: 하네스 부트스트랩 → 게임 컨셉 확정 → 스택+스캐폴드 →
~~MVP(갈림길 메뉴형)~~(폐기) → 던전 탐험형 재설계 → 비주얼/전투UI/카메라
1차 정정 → 등각 투영 + MMO 핫바 전투 재설계 → **필드 자동전투 + 리더/스킬/
인벤토리 1차 전환 (현재 상태)**.

**사용자 피드백에 의한 방향 정정이 세 차례** 있었음 — 자세한 배경과 "왜
틀렸는지"는 `docs/dev-wiki/game-concept.md`의 "⚠️ 방향 정정" / "톤 정정"
섹션들에 그대로 남겨뒀습니다. **다음에 비슷한 작업(비주얼/UI 방향 결정)을
할 때는 이걸 먼저 읽고 같은 실수를 반복하지 마세요**:

1. 갈림길을 버튼 메뉴로 추상화했다가, "실제로 던전을 움직이며 탐험"이라는
   원래 취지와 어긋나서 재설계.
2. 탑다운 화면이 "80년대 게임 같다"는 지적으로 명암/카메라를 1차 조정했지만,
3. 여전히 등각(디아블로류) 시점이 아니고 톤도 원하는 것과 달라서, 사용자가
   "이해했는지 먼저 확인하고 계획을 설명하라"고 명시적으로 요청 → 등각 투영
   + MMO 핫바 전투 + 클래시 오브 클랜풍 톤으로 전면 재설계.

## 5. 지금 뭘 해야 하나 (요약 — 원본은 `docs/dev-wiki/backlog.md`)

- **현재 가장 큰 변화는 컨셉 피벗 검토다.** 사용자는 이제 이 프로젝트를
  던전 스쿼드 액션에서, DotA/LoL식 레인 구조 + Civilization Wars식
  기술/병종/경제 운영을 결합한 **모바일 레인 공성/고용 전략 게임**으로
  전환하길 원함. 조사/구조 분해 문서는
  `docs/dev-wiki/concept-pivot-lane-siege.md`.
- 따라서 다음 작업의 우선순위는 단순 전투 폴리싱이 아니라,
  **새 코어 루프를 정의하는 상담 + MVP 경계 확정**이다:
  - 자원/시대/웨이브/편성 규칙은 이미 데이터 레이어로 고정 시작
  - `battlefieldGenerator` + `LaneBattleScene` 골격도 추가되어,
    게임 기본 실행 경로가 새 레인 전장 프로토타입으로 연결됨
  - 2026-07-26 현재 `LaneBattleScene` 화면은 한 차례 더 크게 수정되어,
    좁은 등각 타일 전장 대신 **좌하단 -> 우상단 대각선 레인을 가진 넓은
    전장형 UI**와 새 생성 배경/HUD 자산을 사용하도록 바뀜
  - 같은 날 후속 작업으로 석기 `투석병/도끼병/보급대`는 코드 도형 대신
    생성 비트맵 스프라이트를 쓰게 바뀌었고, 전장 배경도 새 painterly 자산으로
    교체되었으며 WebAudio 기반 절차형 배경 음악이 추가됨
  - 2026-07-27 전장 오브젝트화 후속 교정으로, 지나치게 낮은 시점의 평탄
    배경을 폐기하고 기존 고시점 전장 구도를 살린 오브젝트용 배경으로 교체함.
    본진과 세 타워는 도로 패드 중심을 따르는 다중 노드 경로에 배치되고,
    타워/유닛/장애물은 같은 접지점 깊이 정렬을 사용함
  - 같은 날 중앙 거점에만 `8 x 8` 논리 지형 패치를 얹는 하이브리드
    렌더링 프로토타입을 추가함. `terrain=legacy|prototype`,
    `camera=central`, 고정 seed와 브라우저 제어 API로 같은 상태를 즉시
    비교할 수 있으며, 상세 실행법과 결과는
    `docs/dev-wiki/terrain-prototype-validation.md`에 있음
  - 이 프로토타입은 아직 전체 레인으로 확장하지 않음. placeholder 지형의
    혼합 강도, 타워 foundation 형태, 낮은 카메라 각도의 기존 유닛 자산을
    먼저 재제작할지 사용자 판단을 받은 뒤 다음 단계 범위를 정해야 함
  - 중앙 거점 V2는 원본 배경에서 해당 원형 패드만 완전 불투명 도로 픽셀로
    교체하고, 직사각형 밴드 대신 불규칙 전환 데칼과 단일 foundation을
    사용함. `terrain=prototype-v2&preset=subtle|balanced|readability`로
    비교할 수 있으며, 카메라 `0.46`을 유지한 채 유닛/월드 UI를 화면 크기
    기준으로 보정함
  - V2 비교 결과는 `balanced / M`이 기술 추천안이지만 전체 맵에는 아직
    적용하지 않음. 동일 정지 상태에서 legacy/V1/V2의 전투 snapshot은
    정확히 같았으며 상세 수치와 캡처는
    `docs/dev-wiki/terrain-prototype-v2-validation.md`에 있음
  - 다음은 경제 시스템, 자동 생산 웨이브 시스템, 본진/거점 UI를 더 실제 게임에
    가깝게 확장하는 단계
  - 다만 첫 전장 진입 시 카메라 시작 위치와 하단 UI 밀도는 아직 추가 정리가
    필요한 상태이므로, 다음 세션 초반에 이 두 가지를 먼저 폴리싱하는 편이 좋음
  - 세부 밸런스값은 전부 사전 합의하지 않고, 에이전트 기본안으로 먼저
    구현/검증 후 피드백으로 조정
- 현재 `DungeonScene` 기반 필드 자동전투 버전은 더 이상 기본 실행 경로는
  아니지만, 완전 삭제 대신
  **비주얼 톤, 등각 파이프라인, 모바일 입력 방향**을 다음 게임으로 이관하기
  위한 중간 프로토타입으로 보면 됨.
- GitHub 저장소는 이미 연결됨:
  `https://github.com/gilgarad/game_project1.git`
  이제부터는 가능하면 실제 GitHub Issue/branch 단위로 진행하는 것이 맞음.

## 6. 알아두면 시간 아끼는 것들 (gotcha 모음, 전체는 `docs/patterns/README.md`)

- **Arcade Physics body offset은 스프라이트 origin이 아니라 프레임
  좌상단 기준.** 충돌이 이상하게 막히는데 그리드 데이터는 멀쩡해 보이면
  `physics: { arcade: { debug: true } }`로 충돌 박스를 직접 시각화해서
  확인할 것 — 추측하지 말 것.
- **Phaser 텍스처 키는 씬별이 아니라 게임 전역.** 같은 유닛이라도 다른
  크기로 그리려면 반드시 다른 키를 써야 함(안 그러면 먼저 생성된 크기가
  고정됨).
- **타일에 개별 명암 밴드를 넣으면 반복돼서 블라인드 커튼처럼 보임.** 벽에
  인접한 바닥에만 그림자를 드리우는 방식(실제 지오메트리와 상관된 음영)이
  정답이었음.
- **이미지 생성 도구는 사용 가능하지만, 실시간 3D 렌더링 도구는 없음.**
  캐릭터/일러스트/HUD는 생성 비트맵으로 보강할 수 있지만 게임 월드를 3D
  엔진처럼 돌리지는 못함. "실제 3D 렌더링 수준"을 요구받으면 그 차이를
  분명히 설명하고 2D 등각 기준의 현실적 대안을 제안할 것.
- **`window.__gameDebug`**: `DungeonScene.update()`가 매 프레임 현재
  상태(phase/대열/전투/던전 그리드 등)를 여기 노출함. 자동 플레이테스트
  스크립트가 여기서 그리드를 읽어 BFS로 경로를 계산해 헤드리스로 완주
  검증하는 데 씀 — 새 기능을 검증할 때도 이 패턴을 재사용할 것.

## 7. 문서 지도

| 문서 | 용도 |
|---|---|
| `AGENTS.md` | 하네스 운영 규칙 — **항상 세션 시작 시 먼저 읽을 것** |
| `docs/index.md` | 레이지로드 카탈로그 |
| `docs/dev-wiki/contract.md` | 운영 모델(백로그 기록 원칙 등) |
| `docs/dev-wiki/game-concept.md` | 게임 설계 전체, 방향 정정 이력 포함 |
| `docs/dev-wiki/backlog.md` | 할 일(Active Queue)/최근 완료 이력 |
| `docs/dev-wiki/log.md` | 전체 작업 이력(append-only, 제일 상세함) |
| `docs/ai-usage/session-log.md` | 대회 제출용 AI 활용 기록 — dev-wiki log와 별개 트랙 |
| `docs/knowledge/contest-requirements.md` | 대회 공식 제출 요건 원문 |
| `docs/patterns/README.md` | 구현 패턴 + 삽질/교훈 모음 |
| `docs/rules/testing.md` | 검증 표준(빌드/Playwright/BFS 테스트 패턴) |

---

*이 문서는 스냅샷입니다. 다음 세션 시작 전에 4·5번 섹션이 최신인지
확인하고, 작업 후에는 갱신하세요.*
