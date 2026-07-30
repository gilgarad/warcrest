# Retro RTS Visual Methodology

이 문서는 현재 레인 전장 화면을 "대충 붙인 프로토타입"에서
"저해상도라도 규칙이 맞는 RTS 화면"으로 끌어올리기 위한 작업 기준서다.
목표 수준은 `Warcraft III`가 아니다. 더 낮은 해상도와 단순한 자산이어도,
`Warcraft II`처럼 화면 구성 규칙, 접지, 타일 연결, 애니메이션 문법이
일관되게 맞아떨어지는 상태를 목표로 한다.

이 문서는 다른 세션이 읽고 그대로 전면 재구축 작업에 들어갈 수 있도록
작성한다. 구현 전에는 반드시 `AGENTS.md` -> `docs/index.md` ->
`docs/dev-wiki/contract.md`를 먼저 읽고, 이 문서를 그 다음 작업 기준으로
사용한다.

## 1. Goal

현재 화면의 핵심 문제는 "그래픽 수준이 낮다"가 아니다. 더 큰 문제는
다음 요소들이 서로 다른 규칙으로 만들어져 한 장면 안에서 합쳐지지 않는다는
점이다.

- 바닥 타일과 길의 문법이 불분명하다.
- 바닥 위 오브젝트(나무, 돌, 타워, 요새)의 접지 기준이 일관하지 않다.
- 유닛 애니메이션이 공격 판정과 정확히 맞물리지 않는다.
- 거점/요새/본진의 배치가 전략 오브젝트로 읽히지 않고 화면에서 뭉쳐 보인다.
- UI가 월드 위를 덮는 방식이 강해서 월드 연출의 약점을 더 부각한다.

이 문서의 목표는 다음 4가지를 동시에 달성하는 것이다.

1. 바닥이 "배경 그림"이 아니라 실제 전투 필드처럼 보이게 만들 것
2. 오브젝트가 지면 위에 확실히 붙어 보이게 만들 것
3. 유닛의 상태 변화와 전투 판정이 읽히는 애니메이션 체계를 만들 것
4. 다른 세션이 같은 기준으로 자산, 배치, 애니메이션을 계속 확장할 수 있게
   데이터/모듈 구조를 정리할 것

## 2. Non-Goals

이번 기준서는 다음을 목표로 하지 않는다.

- `Warcraft III` 수준의 고해상도 디테일
- 실시간 3D 지형/광원 엔진
- 개별 유닛마다 완전히 다른 애니메이션 시스템
- 한 번의 턴에서 모든 자산을 새로 그리는 것

즉, "더 고급스럽게 보이는 저해상도 RTS"가 목표지,
"현대식 3D RTS"가 목표가 아니다.

## 3. Quality Bar

다른 세션은 구현 전에 아래 품질 기준을 먼저 이해해야 한다.

### 3.1 Terrain

- 길은 멀리서 봐도 경계와 폭이 읽혀야 한다.
- 길/흙/잔디는 서로 다른 재질로 읽혀야 한다.
- 대각선 길이라도 "그냥 비스듬히 늘인 회색 띠"처럼 보이면 실패다.
- 길 가장자리와 코너는 반복 패턴이어도 연결 규칙이 느껴져야 한다.

### 3.2 Grounding

- 모든 오브젝트는 "땅에 닿는 기준점"이 명확해야 한다.
- 그림자는 같은 광원 방향을 따라야 한다.
- foundation, shadow, sprite origin이 서로 다른 임의 기준을 쓰면 안 된다.
- 오브젝트가 떠 보인다면, 색감보다 먼저 anchor와 shadow를 의심해야 한다.

### 3.3 Combat Readability

- 공격은 준비, 실행, 후속이 읽혀야 한다.
- 데미지 적용 시점은 타격/발사 시점과 맞아야 한다.
- 유닛-유닛 공격과 유닛-구조물 공격은 같은 로직을 공유하더라도,
  같은 연출로 보여서는 안 된다.

### 3.4 Screen Composition

- 거점, 요새, 본진은 전략 오브젝트로서 서로 구분되는 위치와 실루엣을 가져야 한다.
- 라벨이 없더라도 대략 무엇인지 구분돼야 한다.
- UI는 월드 위에 얹히되, 월드 자체의 구조적 문제를 가려주는 방식이어서는 안 된다.

## 4. What To Investigate First

구현 전에 반드시 아래 조사부터 한다. 이걸 건너뛰면 다시 "감으로 수정"
루프로 들어간다.

### 4.1 Current Screen Breakdown

같은 카메라 위치에서 화면을 다음 4층으로 분리 캡처한다.

1. 바닥만
2. 바닥 + 오브젝트
3. 바닥 + 오브젝트 + 유닛
4. 전투 중 6~8프레임 시퀀스

조사 질문:

- 길의 폭과 방향이 읽히는가
- 바닥 종류가 구분되는가
- 오브젝트가 땅에 붙어 보이는가
- 유닛이 어디를 딛고 서 있는지 보이는가
- 공격 순간이 정지 화면에서도 읽히는가

### 4.2 Terrain Grammar Audit

현재 바닥 시스템을 다음 항목 기준으로 기록한다.

- 길 중심선 좌표
- 길 폭
- 길 경계 처리 규칙
- 잔디/흙/길 명도 차
- 코너/교차/넓어지는 지점의 타일 규칙

### 4.3 Prop Grounding Audit

오브젝트별로 아래 값을 표로 정리한다.

- `groundOriginY`
- `shadow.offsetX`
- `shadow.offsetY`
- `shadow.widthScale`
- `shadow.heightScale`
- `shadow.rotationRad`
- foundation 크기
- footprint 크기

대상:

- rock-cluster
- tree-cluster
- watchtower
- fixed fortress
- main base

### 4.4 Animation Audit

유닛별로 현재 상태를 다음 기준으로 정리한다.

- idle 프레임 수
- walk 프레임 수
- attack 프레임 수
- hit / death 존재 여부
- attack 판정 시점
- ranged release 시점
- structure attack 분기 존재 여부

이 조사에서 "프레임이 적다"와 "문법이 없다"를 구분해야 한다.
프레임 수가 적어도 문법이 맞으면 괜찮다. 반대로 프레임이 많아도 타이밍이
어긋나면 허접해 보인다.

## 4.5 Projection Grammar Conflict (Unresolved — Blocks Everything Below)

2026-07-28 상담 세션에서 다시 조사한 결과, 이 문서의 나머지 항목보다
**먼저 결정해야 하는 축**이 하나 더 있다는 것을 확인했다. 이걸 정하지
않으면 5장 이후 어떤 작업을 해도 다시 "대각선으로 애매하게 늘어난 길"
문제로 돌아온다.

**핵심 사실 확인**: `Warcraft II`는 등각(isometric)도, 고사선
(high-oblique) 원근도 아니다. 카메라가 거의 수직으로 내려다보는
정통 top-down 정사각 타일 그리드다(`OpenGameArt`의 "Grass and dirt
tileset (Warcraft II style)" 참고 — 8x8 기준 타일에 상하좌우 병합 +
코너 + 내부 코너 변형까지 포함된 정사각 그리드로 구성됨). 유닛 스프라이트만
살짝 3/4 각도로 그려 입체감을 주는 정도지, 바닥 자체는 원근이 거의 없다.

반면 이 저장소의 현재 배경(`lane-battlefield-object-base-v4.png`,
`docs/dev-wiki/terrain-rendering-plan.md` "배경" 절 참고)은 **하나의
그림으로 그려진 고사선(high-oblique) 파노라마**이고, `art-direction-animation.md`도
"long bottom-left to upper-right lane"을 화면 구성 표준으로 명시하고
있다. 즉 지금 방향은 "위에서 거의 수직으로 내려다보는 정사각 그리드"가
아니라 "비스듬히 멀리서 본 대각선 협곡"이다.

**왜 이게 "타일이 대각선으로 애매하게 올라간다"는 느낌의 근본 원인인가**:
정사각 top-down 그리드는 타일 경계가 항상 수평/수직/45도 대각선 중
하나로만 떨어지고, 그 각도가 화면 전체에서 일정하다. 반면 한 장의
고사선 파노라마는 소실점과 원근 압축이 화면 위치마다 달라서, 그 위에
정사각 격자 문법(코너, 변, 소켓)을 그대로 얹으면 타일 경계가 화면
위치마다 다른 각도로 보인다 — 이게 "길이 어디로 가는지 애매하다"는
인상의 실제 원인일 가능성이 높다. `terrain-rendering-plan.md`의
"원근/카메라" 행이 이미 이 문제를 다른 각도(콜라주처럼 보임)로 지적한
바 있다.

**결정이 필요한 지점 (사용자 확인 필요, 구현 전 확정)**:

- **안 A. Top-down 그리드로 전환** — 카메라를 거의 수직으로 내리고,
  타일/오브젝트/유닛을 모두 정사각 그리드 문법으로 다시 구성한다.
  WC2 수준 재현에 가장 가깝고 문법 일관성 확보가 쉽지만, 현재 배경
  파노라마 자산과 `battlefieldWorldRenderer.ts`/`LaneBattleScene.ts`의
  카메라·좌표 가정을 상당 부분 다시 만들어야 한다.
- **안 B. 고사선 파노라마 유지 + 그리드를 원근에 맞춰 왜곡** — 배경
  자산은 유지하되, 타일/오브젝트 배치 그리드 자체를 배경의 소실점에
  맞는 사다리꼴/원근 격자로 재정의한다. 자산 재제작은 줄지만, 원근
  보정 로직이 추가로 필요하고 "정사각 타일 문법의 명료함"은 top-down
  보다 약해진다.
- **안 C. 화면을 구역별로 분리** — 실제 전투가 벌어지는 좁은 회랑
  구간만 top-down에 가깝게(안 A) 다시 만들고, 원경(절벽/숲/폐허)은
  지금처럼 고사선 매트로 남긴다. `terrain-rendering-plan.md`가 이미
  권장한 "하이브리드(E 기반 B)" 구조와 자연스럽게 겹친다 — 즉 이미
  세워둔 계획을 실행하면서 이 항목만 명시적으로 확정하면 된다.

이 문서의 저자 세션은 **안 C**를 기본 추천으로 남긴다 — 기존
`terrain-rendering-plan.md` 권장안과 자산 재사용 비용이 가장 잘
맞는다. 그러나 이건 톤/취향 판단이 크게 들어가므로 사용자 확정 없이
구현에 들어가지 않는다.

### 4.5.1 결정 확정 (2026-07-28): 안 A — 완전 Top-down 전환

사용자가 안 A로 확정했다. 근거: "실제로 대각선으로 병력 운용은 하더라도
보이는 건 일정하게 워크래프트2/3처럼" — 즉 **레인의 논리적 배치가
대각선인 것과, 화면이 원근으로 기울어 보이는 것은 별개**라는 요구다.
안 C(회랑만 top-down, 원경만 매트 유지)는 여전히 카메라 자체가 완전
수직이 아닐 여지를 남기므로, 이 요구에는 안 A가 더 정확히 맞는다.
다음 세션은 안 B/C를 검토하지 말고 바로 안 A 기준으로 Phase 1부터
진행한다.

### 4.5.2 이 프로젝트가 왜 고사선으로 흘러갔는가 (원인 규명, 2026-07-28)

사용자가 "왜 뜬금없이 원근감이 생겼는지 알 수 없다"고 물어서
`docs/dev-wiki/log.md`를 역추적했다. 답은 **누가 임의로 추가한 게
아니라, "대각선 레인"이라는 요구가 두 가지 다른 방식으로 해석될 수
있었는데 그중 카메라 원근 쪽으로 구현이 쏠렸기 때문**이다.

- 2026-07-26 `[code] 전장 화면을 넓은 대각선 레인 전장으로 전면 재구성`
  항목의 사용자 지시 원문: "리그 오브 레전드처럼 전방향 맵처럼 보이되
  1:1은 대각선(좌하단에서 우상단)으로 양쪽으로 공격해서 내려오는 것처럼
  보여야 함."
- 이 요구 자체은 정확하다 — LoL 미니맵은 실제로 좌하단/우상단 두 코너에
  본진을 두고 그 사이를 대각선 레인이 잇는 **top-down 평면 지도**다.
  카메라가 기울어 있는 게 아니라, 그 평면 지도 위에서 레인의 배치
  방향이 대각선일 뿐이다.
- 그런데 그 다음 구현에서 image_gen으로 만든 새 배경
  (`lane-battlefield-bg.png` → 이후 `-v2`, `-object-base-v4`)이
  "멀리서 비스듬히 내려다보는 협곡" 컨셉 아트로 만들어졌고, 이후
  `art-direction-animation.md`의 "high-oblique RTS composition"
  표준으로 그대로 굳어졌다. 즉 "지도 위 대각선 배치"였어야 할 요구가
  "카메라 자체의 대각선 원근"으로 잘못 번역된 뒤, 그 잘못된 해석이
  다음 문서/자산 제작의 기준으로 승격되면서 계속 재생산됐다.
- 이후 세션들(2026-07-26 `전장 대각선 완화`, `전열 압축/재배치 강화` 등)이
  대각선을 완만하게 하거나 줌을 조정하는 식으로 계속 대증 처방을 했지만,
  "카메라를 top-down으로 되돌린다"는 근본 옵션 자체는 한 번도 검토되지
  않았던 것으로 보인다.

결론: 이건 사용자 요구가 바뀐 게 아니라, 초기 이미지 생성 단계에서
"대각선 지도 배치"를 "대각선 카메라 원근"으로 잘못 구현한 뒤 그게
그대로 표준 문서(`art-direction-animation.md`)에 박제된 것이다.
4.5.1의 안 A 확정은 이 오역을 원래 의도(top-down 지도 + 대각선 레인
배치)로 되돌리는 작업이다.

## 5. Terrain Rebuild Method

이 프로젝트에서 가장 먼저 고쳐야 할 축은 바닥이다. 바닥이 애매하면
모든 오브젝트가 어색해 보인다.

### 5.1 Terrain Architecture

다른 세션은 바닥을 아래 3계층으로 다뤄야 한다.

1. `base ground`
   - 잔디/흙의 큰 덩어리
   - 저주파 패턴과 명도 분할 담당
2. `road grammar`
   - 길 중심선, 폭, 가장자리, 코너, 패드
   - 전투가 실제로 일어나는 표면
3. `surface dressing`
   - 균열, 마모, 작은 데칼, 바퀴 자국, 가장자리 깨짐

중요한 점:

- 2번이 불명확하면 3번을 아무리 얹어도 좋아지지 않는다.
- 장식보다 먼저 길 문법부터 만든다.

### 5.2 Terrain Data To Define

가능하면 다음 데이터를 별도 구조로 둔다.

- `roadWidth`
- `shoulderWidth`
- `edgeNoiseSeed`
- `tileFamilyId`
- `transitionRule`
- `socketPadding`

즉, 길을 이미지로만 보지 말고 규칙 데이터로 취급해야 한다.

### 5.2.1 Transition Rule — Concrete Technique Choice (added 2026-07-28)

`transitionRule`을 막연히 "규칙 데이터"로만 남겨두면 다시 추상적인
워딩으로 돌아간다. 실제로 쓸 수 있는 기법은 알려진 세 가지 중 하나이고,
이번 조사에서 확인한 특성은 다음과 같다.

- **Marching squares / 16-tile 세트**: 4방향(N/E/S/W) 이웃만 보고 타일을
  고른다. 필요한 타일 수가 적어(16개) 제작 부담이 가장 작지만, 내부
  코너가 뭉툭하게 처리된다.
- **Blob / 47-tile 세트**: 8방향 이웃을 모두 보고 타일을 고른다. 외곽
  코너, 내부 코너, 세 면이 만나는 지점까지 각각 전용 타일을 가지므로
  결과물이 가장 매끈하지만, 제작해야 할 타일 수가 47개로 늘어난다.
- **Dual-grid 기법**: 논리 그리드와 렌더 그리드를 어긋나게 둬서(타일
  모서리에 렌더 타일 중심을 맞춤) 마치 47-tile 수준의 매끈함을 훨씬 적은
  원본 타일로 얻는 방식. 최근 인디 개발 커뮤니티에서 자동타일링 구현
  비용을 줄이는 방법으로 자주 소개된다.

**추천**: 이 프로젝트는 레인 1개 + 소수 지형 재질(잔디/흙/도로/석재)만
다루므로 47-tile 풀세트는 과설계다. **marching squares(16-tile)로
시작하고, 코너가 눈에 띄게 뭉툭하면 그 부분만 dual-grid로 보강**하는
순서를 권장한다. `transitionRule` 데이터 필드는 이 중 어떤 기법을
쓰는지와 이웃 비트마스크를 실제로 담아야 한다 — "규칙이 있다"는
서술만으로는 다른 세션이 바로 구현할 수 없다.

참고 자료(2026-07-28 확인):

- 개념 정리와 두 기법 대조: https://www.redblobgames.com/articles/autotile/gemini/autotiling.html
- 47-tile blob 세트 설명: https://tilewise.ai/blog/generate-47-tile-blob-tileset-with-ai
- Dual-grid 기법 구현기: https://excaliburjs.com/blog/Dual%20Tilemap%20Autotiling%20Technique/
- WC2풍 실제 타일 크기/병합 예시(8x8 기준): https://opengameart.org/content/grass-and-dirt-tileset-warcraft-ii-style

### 5.3 Immediate Terrain Tasks

다른 세션이 바로 할 수 있는 구체 작업은 아래다.

1. 길 폭과 경계를 우선 고정한다.
2. 잔디/흙/길의 명도 차를 먼저 맞춘다.
3. 코너, 가장자리, 거점 패드를 같은 규칙으로 다시 그린다.
4. 바닥과 오브젝트의 색온도가 크게 다르면 맞춘다.

## 6. Grounding Method For Trees, Rocks, Towers

현재 "허접함"의 큰 원인은 오브젝트가 배경 위에 떠 보인다는 점이다.
이를 막으려면 모든 오브젝트가 같은 접지 문법을 가져야 한다.

### 6.1 Required Object Data

각 오브젝트는 최소 아래 필드를 가져야 한다.

- `groundOriginY`
- `opaqueBounds.visibleHeightRatio`
- `shadowPreset`
- `foundationPreset`
- `footprint`
- `occludesUnits`

### 6.2 Shadow Rules

- 같은 종류의 바위는 같은 그림자 각도와 압축비를 쓴다.
- 나무 그림자는 바위보다 길고 퍼질 수 있지만, 광원 방향은 바뀌지 않는다.
- tower / fortress / base는 건물 그림자와 foundation이 서로 충돌하지 않게
  역할을 분리한다.

### 6.3 Foundation Rules

- foundation은 "장식"이 아니라 접지 보정 요소다.
- 길 위 건물은 길 표면과 충돌하지 않는 재질과 두께를 가져야 한다.
- foundation이 크면 건물이 묻혀 보이고, 작으면 떠 보인다.
- foundation 크기는 자산마다 수동 조절하되, 조절 규칙은 데이터화한다.

## 7. Unit Animation Method

캐릭터 모션은 "더 많은 프레임"보다 "공통 상태 기계"가 먼저다.

### 7.1 Shared Animation Skeleton

모든 유닛은 가능하면 같은 상태 집합을 가진다.

- `idle`
- `walk-a`
- `walk-b`
- `windup`
- `attack`
- `recover`
- `hit`
- `death`

모든 유닛이 모든 상태를 즉시 다 갖출 필요는 없다. 하지만 구조는 이 상태를
수용할 수 있어야 한다.

### 7.2 Timing Rules

근접 유닛:

- `windup`은 짧지만 읽혀야 한다.
- `contact`에서 가장 큰 실루엣 변화가 와야 한다.
- `recover`는 너무 길면 안 된다.

원거리 유닛:

- 발사 직전 `release pose`가 보여야 한다.
- projectile spawn은 그 프레임에 맞아야 한다.
- recoil은 약하지만 분명해야 한다.

지원 유닛:

- 전투 유닛보다 움직임이 짧고 절제되어야 한다.
- cast/heal의 시점이 명확해야 한다.

### 7.4 Facing Direction Scope (added 2026-07-28)

"프레임을 더 세분화한다"는 방향만으로는 범위가 무한히 커진다.
`Warcraft II` 유닛은 보통 8방향 스프라이트를 가진다. 이 프로젝트는
현재 단일 레인을 좌우로 왕복 이동하는 구조이므로, 8방향 전체를 목표로
삼는 것은 4.5절의 Non-Goal("현대식 3D RTS 아님")과도 어긋나는 과설계다.

**결정 필요 항목**: 유닛이 실제로 보여야 하는 최소 facing 수.

- 좌/우 2방향(현재에 가장 가까움, 레인 이동 방향만 반영)
- 좌/우 + 공격 시 상대 방향으로의 미세 회전(2방향 + 짧은 회전 보정)
- 4방향(좌/우/상/하 — 거점 주변에서 진형이 넓어질 때 필요할 수 있음)

이번 문서는 **좌/우 2방향 + 공격 시 미세 회전 보정**을 최소 기준으로
추천한다 — 6장/7장에서 이미 요구한 windup/attack/recover/hit 상태
세분화와 조합했을 때 제작량 대비 체감 향상이 가장 크고, 8방향 풀세트
제작은 이번 스코프에서 과하다. 다만 이것도 사용자 취향이 크게 개입하는
항목이므로 10장 체크포인트에 반영한다.

### 7.3 Structure Attack

구조물 공격은 별도 표기 규칙이 필요하다.

- target kind를 `unit` / `structure`로 나눈다.
- 같은 공격 포즈를 쓰더라도, structure attack은 접촉 대상이 크기 때문에
  전신 이동량, 무기 arc, hit timing을 다르게 다룬다.

## 8. Refactor Targets

다른 세션이 전면 적용 작업을 할 때, 최소한 아래 축은 별도 모듈로 분리하는
것이 좋다.

### 8.1 Terrain

- 길/바닥 규칙
- 거점 소켓 배치
- 오브젝트 접지 프리셋

후보 위치:

- `src/presentation/terrain/`
- `src/data/terrain/`

### 8.2 Unit Presentation

- 유닛 애니메이션 레지스트리
- 프레임별 anchor/opaque bounds
- role별 combat motion

후보 위치:

- `src/presentation/units/`

### 8.3 Combat Timing

- melee contact timing
- ranged release timing
- structure attack timing

후보 위치:

- `src/systems/lane-combat/`

## 9. Phase Plan

다른 세션은 아래 순서로 진행하는 것이 좋다.

### Phase 0. Projection Decision (added 2026-07-28, confirmed same day — 안 A)

목표:

- ~~4.5절의 안 A/B/C 중 하나를 사용자와 함께 확정~~ 완료: **안 A(완전
  top-down 전환)로 확정됨** (4.5.1절 참고). 다음 세션은 이 결정을
  다시 논의하지 말고 바로 이 전제로 Phase 1부터 진행한다.
- 7.4절의 facing 방향 수는 아직 미확정 — 여전히 필요.

산출물:

- 채택안 + 근거 1문단
- 확정된 facing 방향 수

### Phase 1. Visual Audit and Freeze

목표:

- 현재 화면의 문제를 캡처와 표로 고정

산출물:

- before 캡처 세트
- 오브젝트 grounding 표
- 애니메이션 상태 표

### Phase 2. Terrain Grammar First

목표:

- 길과 바닥이 읽히는 수준까지 정리

산출물:

- 길 폭/경계 재정의
- 바닥 타일 규칙 반영
- before/after 비교

### Phase 3. Grounding Pass

목표:

- 나무/돌/타워/요새가 지면에 붙도록 정리

산출물:

- shadow/foundation preset
- prop grounding before/after

### Phase 4. Animation Skeleton Pass

목표:

- 모든 유닛이 같은 애니메이션 구조를 타게 함

산출물:

- animation registry
- combat motion helper
- unit role별 시퀀스 비교

### Phase 5. Combat Timing Pass

목표:

- 데미지 적용 시점과 모션이 맞아떨어지게 정리

산출물:

- unit-vs-unit 시퀀스
- unit-vs-structure 시퀀스
- ranged release timing 검증

### Phase 6. UI Composition Pass

목표:

- 월드가 읽히는 수준까지 UI 밀도와 위치를 조정

산출물:

- HUD density before/after
- 월드 가독성 비교 캡처

## 10. User Checkpoints

아래 항목은 사용자 취향 판단이 크게 개입하므로, 구현 중간에 선택지를
보여주는 것이 좋다.

- ~~투영 방식(4.5절)~~ 확정됨: 안 A, top-down 전환 (2026-07-28)
- **유닛 facing 방향 수(7.4절) — 아직 확정 필요**
- 길 폭과 재질 대비
- 거점/요새 배치 구조
- 그림자 진하기와 방향
- 근접 공격 모션의 exaggeration 정도
- 음악 톤 방향

다만 다음 항목은 사용자 확인 없이도 먼저 고쳐야 한다.

- 잘못된 ground anchor
- 공격 타이밍과 데미지 타이밍 불일치
- 거점/요새 클릭 혼선
- 테스트가 깨지는 상태

## 11. Validation Checklist

작업 후에는 최소 아래를 확인한다.

- `npm run build`
- `npm test`
- 지형 before/after 캡처
- prop grounding before/after 캡처
- melee / ranged / support 애니메이션 시퀀스
- unit-vs-structure 타격 시퀀스
- 동일 카메라 위치에서 UI 포함/미포함 비교

가능하면 `window.__gameDebug` 또는 기존 Playwright 검증을 활용해
고정 상태를 재현한다.

## 12. Overnight Status Note

2026-07-28 오전 확인 기준:

- 최근 커밋 `3438ca1`은 `feat: normalize unit animation and tower volleys`
  로 완료되어 있다.
- 그러나 그 이후 worktree에는 미커밋 변경이 더 남아 있으며,
  `src/data/battlefieldMaps.ts`, `src/data/capturePointDefinitions.ts`,
  `src/gfx/battlefieldWorldRenderer.ts`, `src/scenes/LaneBattleScene.ts`,
  `src/presentation/units/combatPresentation.ts`,
  `src/systems/lane-combat/laneOccupancy.ts` 등이 수정 중 상태다.
- 현재 `npm run build`는 통과하지만, `npm test`는
  `src/data/__tests__/battlefieldMaps.test.ts`의 2개 테스트가 깨져 있다.
- 즉, 간밤 작업은 실제로 진전은 있었지만 "완전히 정리돼 끝난 상태"는 아니고,
  거점 구조 변경 리팩토링을 진행하다 중간 정리 없이 멈춘 상태로 보는 편이
  맞다.

## 13. Verified References

아래 링크는 2026-07-28에 실제로 존재 여부를 다시 확인했다.

- Warcraft II 개요 참고:
  https://www.mobygames.com/game/1339/warcraft-ii-tides-of-darkness/
- Warcraft II 실제 플레이 화면 참고:
  https://www.youtube.com/watch?v=KYzb2UvjFu8
- 타일맵/타일셋 작업 기준 참고:
  https://doc.mapeditor.org/en/stable/manual/introduction/
- Phaser tilemap API 참고:
  https://docs.phaser.io/api-documentation/class/tilemaps-tilemap
- 픽셀 걷기 모션 분해 참고:
  https://www.slynyrd.com/blog/2024/5/24/pixelblog-50-human-walk-cycle
- 애니메이션 anticipation/timing 참고:
  https://www.animationmentor.com/blog/anticipation-the-12-basic-principles-of-animation/

아래는 2026-07-28 상담 세션에서 추가로 확인한 참고 자료다.

- WC2가 등각/고사선이 아니라 정통 top-down 그리드임을 보여주는 실제
  타일 예시(8x8 기준, 병합/코너 포함):
  https://opengameart.org/content/grass-and-dirt-tileset-warcraft-ii-style
- 타일 전이 기법 개념 정리(marching squares vs blob 대조):
  https://www.redblobgames.com/articles/autotile/gemini/autotiling.html
- 47-tile blob 세트 설명:
  https://tilewise.ai/blog/generate-47-tile-blob-tileset-with-ai
- Dual-grid 자동타일링 구현기:
  https://excaliburjs.com/blog/Dual%20Tilemap%20Autotiling%20Technique/

## 14. Consulting Session Note (2026-07-28)

이번 세션은 구현을 하지 않고 상담/조사만 진행했다(다른 세션인
stock_predict_rev 저장소 세션에서, game_project1만 보는 조건으로
호출됨). 사용자가 제기한 핵심 질문은 "지금 이 문서가 추상적인 워딩
명령인지, 실제로 워크래프트2 수준에 도달하려면 뭘 더 조사해야
하는지"였다.

이번 조사로 확정한 결론:

1. 이 문서의 4~9장은 이미 상당히 구체적이었으나(감사 항목, 데이터
   필드, phase 계획 등), **투영 방식(top-down vs 고사선 파노라마)이
   서로 다른 장끼리 암묵적으로 다른 가정을 깔고 있었다** — 이게
   가장 큰 "숨은 추상성"이었다. 4.5절로 명시하고 Phase 0으로 승격했다.
2. `transitionRule`처럼 "규칙 데이터로 취급"이라고만 적혀 있던 부분은
   실제 기법 이름(marching squares / blob / dual-grid)과 추천안을
   5.2.1절에 못박았다.
3. 애니메이션 세분화도 "더 자연스럽게"만으로는 범위가 안 잡혀서,
   facing 방향 수라는 구체적 손잡이를 7.4절에 추가했다.
4. 이 세 항목(투영 방식, transition 기법, facing 수)은 모두 취향/스코프
   판단이 섞여 있어 **사용자 확정 없이 다음 세션이 구현에 들어가면 안
   된다** — Phase 0과 10장 체크포인트에 명시했다.
