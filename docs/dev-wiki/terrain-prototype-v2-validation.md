# 중앙 거점 지형 프로토타입 V2 검증

## 결론

중앙 거점에 구워진 원형 패드를 제거하는 주 방식은 **C. 중앙 패드가 제거된
background variant**를 선택했다. V2 배경은 원본 구도와 색을 다시 생성하지
않고, 원본 배경 안의 인접한 일반 도로 픽셀을 불규칙한 완전 불투명 마스크로
중앙 패드 구간에 복사해 만들었다.

- 원본: `public/assets/battle/lane-battlefield-object-base-v4.png`
- V2: `public/assets/battle/lane-battlefield-object-base-v4-prototype-v2.png`
- 이미지 크기: `1692 x 929`
- 실제 변경 영역: `x=899..1106`, `y=327..493` (`208 x 167`)
- 변경 픽셀: `23,348`, 전체의 `1.485%`
- V2 알파 최솟값: `255`

따라서 원형 두 개를 반투명하게 섞어 숨긴 것이 아니다. 기존 패드 픽셀을
완전히 교체한 뒤, B 방식의 불규칙 마모/전환 데칼은 새 foundation과 기존
도로 사이를 연결하는 보조 수단으로만 사용했다.

## 방식 비교

| 방식 | 판단 |
|---|---|
| A. 전용 중앙 지면 청크 | 경계를 독립 텍스처 안에서 통제할 수 있지만, 기존 배경의 도로 원근·붓질·명도를 다시 맞춰야 해 이음새 위험이 큼 |
| B. 불규칙 마스크와 데칼 | 경계 해체에는 유효하나 이미 구워진 원형 선 자체를 완전히 없애기 어려움 |
| C. 패드 제거 background variant | 원본 화폭과 구도를 보존하면서 문제 픽셀만 완전 교체할 수 있어 현재 구조에서 가장 안전함 |
| D. foundation/그림자만 개선 | 기존 원형과 새 foundation의 중첩 원인을 제거하지 못함 |

이미지 생성으로 전체 중앙부를 다시 그리는 시도는 도로 폭과 주변 구도가
달라져 폐기했다. 프로젝트에 포함된 V2 배경은 생성형 재구성 결과가 아니다.

## 구현 구조

### 렌더 모드

- `terrain=legacy`: 원본 배경과 기존 표시
- `terrain=prototype`: V1의 `8 x 8` 밴드 패치와 V1 foundation
- `terrain=prototype-v2`: 패드 제거 배경, 불규칙 데칼, V2 foundation

`T` 키는 `legacy -> prototype -> prototype-v2` 순으로 순환한다.
`window.__terrainPrototypeControl.setMode(mode)`로 정지 상태에서 모드만
바꿀 수도 있다.

### V2 지형

V2는 V1의 긴 직사각형 재질 밴드를 그리지 않는다. 중앙 도로는 패드가 제거된
배경 variant가 담당하고, 렌더러는 고정 seed 성격의 위치표를 사용해 중앙
주변에 작은 타원형 잔디/흙/석재 데칼만 배치한다.

- 데칼 위치, 크기, 회전, 반전이 서로 다름
- 프리셋에 따라 데칼 수와 알파가 달라짐
- 패치 길이/폭과 전환 폭은 visual configuration에서 조절
- blur로 경계를 감추지 않음
- 전체 맵이나 이동 가능 영역은 바꾸지 않음

V2 foundation은 다음 계층으로 구성한다.

1. 눌린 흙과 가장자리 잔디 손상
2. footprint 아래 접촉 음영
3. 단일 석재 받침과 얕은 상부 면
4. 균열과 작은 석재 파편
5. 좌상단 광원에 대응하는 우하단 방향성 그림자

V1의 세 겹 동심 타원은 V2에서 사용하지 않는다.

### 설정

`src/config/prototypeVisualConfig.ts` 한 곳에서 다음을 관리한다.

- 지형 패치 길이/폭, 전환 폭, 데칼 수와 혼합 강도
- foundation 크기, 위치, 알파
- 접촉 음영과 타워 그림자 offset/scale/alpha
- S/M/L 유닛 크기와 병종별 보정
- 향후 영웅/대형 유닛 보정값
- 타워 배율
- 카메라 줌별 유닛 최소/최대 화면 높이
- 유닛/타워 HP바 화면 너비·높이·offset
- 이름표 화면 글자 크기와 최소/최대값
- outline, shadow, 배경 알파
- 이름표/HP바 간격과 밀집 표시 정책
- 줌 보정 강도

프리셋은 query parameter로 선택한다.

```text
?terrain=prototype-v2&preset=subtle
?terrain=prototype-v2&preset=balanced
?terrain=prototype-v2&preset=readability
```

## 유닛과 타워 크기

모든 값은 카메라 줌 `0.46`에서 내부 `1600 x 900` 캔버스에 실제 렌더된
화면 픽셀이다.

| 모드/프리셋 | 투석병 높이 | 도끼병 높이 | 보급병 높이 | 중앙 타워 높이 |
|---|---:|---:|---:|---:|
| legacy | 34.9 | 35.0 | 42.7 | 84.2 |
| V1 | 51.4 | 51.5 | 54.3 | 84.2 |
| A subtle / S | 55.5 | 60.3 | 68.6 | 88.4 |
| B balanced / M | 65.5 | 73.1 | 82.0 | 96.0 |
| C readability / L | 76.1 | 88.4 | 96.0 | 102.7 |

balanced는 V1 대비 투석병 `1.27x`, 도끼병 `1.42x`, 보급병 `1.51x`,
타워 `1.14x`다. 타워 높이/일반 전투 유닛 평균 높이 비율은 V1 `1.64`에서
balanced `1.40`으로 줄었다.

종횡비는 원본 프레임 비율을 유지한다. 유닛 논리 좌표, 진행 속도, 사거리,
공격 판정, 간격 수치는 바꾸지 않았다.

## 월드 UI

| 항목 | legacy/V1 | balanced V2 |
|---|---:|---:|
| 유닛 글자 실효 화면 크기 | 4.6px | 12px |
| 타워 글자 실효 화면 크기 | 6.44px | 13px |
| 유닛 HP바 | 15.64 x 2.3px | 39 x 5px |
| 타워 HP바 | 27.6 x 3.22px | 82 x 9px |

월드 UI 위치는 오브젝트의 ground anchor를 따르지만 글자와 HP바 치수는
카메라 줌을 역보정한다. 최소·최대 화면 크기가 있어 다른 줌에서도 무한히
커지거나 작아지지 않는다. 어두운 외곽선, 약한 그림자, 반투명 배경을
적용했다.

실제 `1365 x 768` 브라우저에서는 내부 캔버스가 `0.8533x`로 표시된다.
balanced의 CSS상 실효 크기는 유닛 글자 `10.24px`, 타워 글자 `11.09px`,
유닛 HP바 높이 `4.27px`, 타워 HP바 높이 `7.68px`였다. 브라우저 오류는
없었고 글자는 밝은 도로와 어두운 잔디 양쪽에서 판독 가능했다.

## 밀집 표시 정책

- subtle: 일반 유닛 이름은 선택 또는 hover 시만 표시
- balanced: 선택/hover 이름을 표시하며, 보급병은 가까운 같은 팀 보급병 중
  대표 하나만 항상 표시
- readability: 모든 유닛 이름을 항상 표시

30초 교전 캡처에서 subtle은 가장 깨끗하지만 병종 정보가 적다. balanced는
HP바와 팀별 중요 이름표를 유지하면서 중복 이름표를 줄였다. readability는
유닛 형태는 가장 크지만 모든 이름표가 겹쳐 일반 플레이 기본값으로는
과밀하다.

## 앵커와 부속 요소

- 유닛과 타워 ground origin: `0.88`
- 유닛 그림자와 선택 원: 같은 `groundY`의 하위 depth
- 스프라이트: `groundY` depth
- HP바, 이름표: 같은 `groundY`의 상위 depth
- 유닛 투사체 시작점: 현재 표시 높이의 `42%` 위
- 타워 투사체: 현재 타워 표시 높이를 기준으로 발사 `70%`, 피격 `48%` 위
- 선택 원과 클릭 대상: 확대된 시각 크기를 따름
- 공격/피격/사망의 논리 좌표와 전투 판정: 기존 값 유지

정지 프레임에서 ground anchor, HP바, 이름표, 접지 그림자, 타워 발사점의
기준이 함께 이동하는 것을 확인했다.

## 동일 상태 검증

seed `warcrest-central-v1`, 카메라 중앙, 줌 `0.46`, 경과
`30.17546초`에서 씬을 정지한 뒤 표시 모드만 바꿨다.

```json
{
  "legacyEqualsV1": true,
  "v1EqualsV2": true,
  "legacyEqualsV2": true
}
```

비교할 때 `terrainMode`, `prototypePreset`, presentation 실측값만 제외했고,
자원, 일꾼, 본진 HP, 웨이브 시간, 유닛 ID/팀/병종/좌표/행/HP, 거점 소유와
점령 상태, 전투 규칙, 병종 스탯은 정확히 일치했다.

빌드와 정적 검증:

```text
npm run build       PASS
git diff --check    PASS
Playwright page errors  0
```

Vite의 기존 대형 chunk 경고는 남지만 빌드는 성공한다.

## 비교 산출물

모든 산출물은 `artifacts/terrain-prototype-v2/`에 있다.

- `comparison-render-modes.png`: 동일 상태 legacy/V1/V2
- `comparison-v2-presets-closeup.png`: A/B/C 중앙 확대 비교
- `legacy-same-state.png`
- `v1-prototype-same-state.png`
- `v2-balanced-same-state.png`
- `preset-subtle-full.png`
- `preset-balanced-full.png`
- `preset-readability-full.png`
- 각 화면의 `*-central-closeup.png`
- 각 상태의 `*-debug.json`
- `combat-state-comparison.json`
- `visual-metrics.json`
- `background-variant-diff.json`
- `browser-display-validation.json`
- `preset-balanced-browser-1365x768.png`

중앙 확대본은 게임 카메라 줌을 올리지 않고 `1600 x 900` 원본 캡처의 중앙
구간만 잘랐다.

## 변경 파일과 에셋

주요 코드:

- `src/config/prototypeVisualConfig.ts`
- `src/gfx/battlefieldPrototypeRenderer.ts`
- `src/scenes/LaneBattleScene.ts`

새 V2 에셋:

- `public/assets/battle/lane-battlefield-object-base-v4-prototype-v2.png`

에셋 생성 방식은 원본 자체의 인접 일반 도로 픽셀을 Playwright Canvas에서
불규칙한 완전 불투명 마스크로 복사한 결정적 로컬 변형이다. 다른 게임
자산이나 외부 타일은 포함하지 않았다. V1 placeholder 3종은 그대로
prototype 전용이며 V2도 전환 데칼에 재사용한다.

## 남은 문제

- 유닛 원화는 배경보다 정면에 가까운 시점이고 원본 해상도도 낮다. 확대하면
  실루엣은 읽히지만 회화적 배경과 완전히 같은 화풍/시점이 되지는 않는다.
- foundation은 V1보다 단순하고 접지감이 좋아졌지만 타원형 석재 받침이라는
  임시 형상이다. 최종 아트에서는 도로 석재 패턴과 맞춘 비대칭 footprint
  자산이 더 자연스럽다.
- V2 데칼은 중앙에만 있고 전체 레인에 적용되지 않았다.
- 배경 원경의 벽과 나무는 여전히 한 장의 화폭이므로 동적 오브젝트를 가리는
  occluder가 없다.
- readability는 밀집 텍스트 과잉, subtle은 일반 병종 정보 부족이라는
  명확한 절충점이 있다.

## 추천 및 중단점

기술 추천은 **B. balanced / M**이다.

- 줌 `0.46`과 넓은 전장 범위를 유지한다.
- 기존보다 병종 실루엣이 확실히 크다.
- 타워가 유닛을 압도하지 않는다.
- 유닛/타워 글자와 HP바가 일반 거리에서 읽힌다.
- 중요 이름표만 남겨 readability의 밀집 텍스트 문제를 피한다.
- 지형 데칼이 subtle보다 거점 연결을 분명하게 만들면서 V1처럼 직사각형
  패치로 읽히지 않는다.

사용자 판단 전에는 이 프리셋이나 V2 지형을 전체 맵으로 확장하지 않는다.
