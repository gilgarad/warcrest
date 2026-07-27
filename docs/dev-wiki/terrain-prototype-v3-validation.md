# 중앙 거점 프로토타입 V3 검증

기준 브랜치: `terrain-prototype-central`

검증 URL 기본형:

```text
/?terrain=prototype-v2&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=warcrest-central-v1
```

이번 단계는 V2 중앙 지형을 전체 맵으로 확장하지 않고 유닛·타워의 실화면
크기, 월드 텍스트, 방향 전환, 공격 표현, 고정 요새 규칙과 접지만 검증한다.
카메라 줌과 전투 수치, 이동/공격/점령/웨이브 로직은 유지했다.

## 1. 세 크기 프리셋 전체 화면

- 비교: `artifacts/terrain-prototype-scale-v3/comparison-scale-presets-full.png`
- 개별: `scale-compact-full.png`, `scale-recommended-full.png`,
  `scale-large-full.png`
- 지형 블렌드 `preset=balanced`와 별도로 `scale=compact|recommended|large`를
  사용한다. 기존 `subtle|balanced|readability` 의미는 바꾸지 않았다.

## 2. 중앙 전투 구역 확대

- 비교: `artifacts/terrain-prototype-scale-v3/comparison-scale-presets-closeup.png`
- 각 캡처는 같은 `1365 x 768`, seed, 카메라와 12유닛 검증 장면이다.
- Large는 고정 요새 이름이 상단 HUD와 충돌하기 시작해 혼잡도 상한으로
  적합하고 기본값으로는 과하다.

## 3. 유닛별 실제 CSS 높이

불투명 픽셀 bounds를 브라우저 Canvas로 측정하고, 프레임의 투명 여백을
제외한 실루엣 높이를 CSS 픽셀로 맞췄다.

| 프리셋 | 투석병 | 도끼병 | 보급병 |
| --- | ---: | ---: | ---: |
| Compact | 90.24px | 97.76px | 106px |
| Recommended | 96px | 104px | 116px |
| Large | 101.76px | 110.24px | 124px |

## 4. 타워별 실제 CSS 높이

| 프리셋 | 일반 건설 타워/폐허 | 중앙 고정 요새 |
| --- | ---: | ---: |
| Compact | 132px | 148px |
| Recommended | 144px | 162px |
| Large | 154px | 174px |

타워 원본 `1254 x 1254`의 불투명 bounds는 `x=298..952`,
`y=93..1128`이다. 기단 anchor는 임의 오프셋이 아니라 실제 최하단
`1128 / 1254 = 0.89952`를 사용한다.

## 5. 이름표와 레벨의 실제 CSS 크기

- Compact: 일반 유닛 12.95px, 고정 요새 16.09px
- Recommended: 일반 유닛 14.13px, 고정 요새 16.88px
- Large: 일반 유닛 14.13px, 고정 요새 18.06px
- 선택/hover 유닛은 프리셋별 14/15/16px 목표를 별도로 사용한다.
- 보조 정보 목표는 12/13/13px이다.

## 6. 텍스트 뭉개짐 원인과 수정

원인은 `1600 x 900` 내부 캔버스를 `1365 x 768` CSS 크기로 0.85333배
축소하고, 카메라 줌 0.46과 역스케일을 거친 작은 Text texture에 3px
outline과 blur shadow를 다시 축소한 다중 리샘플링이었다. V3는 실제
canvas CSS scale과 camera zoom으로 필요한 월드 font size를 먼저 계산해
Text 자체를 큰 해상도로 rasterize한다. Text resolution은 DPR을 반영해
최소 2, 최종 위치는 카메라 변환 후 정수 캔버스 픽셀에 맞춘다. 작은 글자의
blur shadow는 제거하고 외곽선은 최종 CSS 약 1.15px로 제한했다.

## 7. 방향 에셋 지원 표

| 유닛 | 정면 | 후면 | 좌 | 우 | 좌상/우상/좌하/우하 | flip | 방향별 프레임 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 석기 투석병 | 3/4 한 방향 | 없음 | 우측 원본 flip | 원본 | 없음 | 가능 | 없음 |
| 석기 도끼병 | 3/4 한 방향 | 없음 | 우측 원본 flip | 원본 | 없음 | 가능 | 없음 |
| 석기 보급병 | 3/4 한 방향 | 없음 | 우측 원본 flip | 원본 | 없음 | 가능 | 없음 |
| 이후 시대 token | 정적 도형 | 없음 | 대칭/flip | 정적 원본 | 없음 | 코드상 가능 | 없음 |

이동 중 실제 화면 이동 벡터, 공격 중 대상 x 벡터, 정지 중 마지막 facing을
사용한다. 0.35 world-px dead zone과 공격 시간 facing lock을 두었다. 없는
대각선/후면 그림을 회전으로 가장하지 않는다.

## 8. 애니메이션 지원 표

| 유닛 | idle | walk | attack | hit | death | 실제 연결 |
| --- | --- | --- | --- | --- | --- | --- |
| 석기 투석병 | 1장 | 2장 교대 | 1장 | procedural flash/impact | 없음 | 연결 |
| 석기 도끼병 | 1장 | 2장 교대 | 1장 | procedural flash/impact | 없음 | 연결 |
| 석기 보급병 | 1장 | 2장 교대 | 1장 | procedural flash/impact | 없음 | 치유 시 연결 |
| 이후 시대 token | 정적 | 전용 아트 없음 | 전용 아트 없음 | procedural | 없음 | fallback 이동/반동 |

전용 attack이 없는 token은 prototype fallback으로 근접은 ground anchor를
유지한 짧은 전진/복귀, 원거리는 작은 반동/투사체를 사용한다. 캐릭터 회전과
squash는 사용하지 않는다.

## 9. 기존 공격이 보이지 않았던 원인

도끼병과 보급병은 에셋 부재가 아니었다. 도끼 attack은 연결돼 있었지만
0.24초와 작은 화면 크기 때문에 식별이 어려웠다. 보급병은 attack 이미지가
있어도 치유 코드에서 `attackAnimTime`을 시작하지 않는 트리거 누락이었다.
이를 0.48초 시각 상태로 동기화하고 보급 치유에도 연결했다. 이후 시대
token은 실제 attack 원화가 없으므로 fallback 대상이다.

## 10. 근접 공격 연속 프레임

- `artifacts/terrain-prototype-scale-v3/comparison-melee-attack-sequence.png`
- 실제 도끼 attack pose에 준비/전진/복귀 오프셋을 적용하며 ground anchor와
  원본 종횡비를 유지한다.

## 11. 원거리 공격 연속 프레임

- `artifacts/terrain-prototype-scale-v3/comparison-ranged-attack-sequence.png`
- 실제 투석 attack pose와 발사 반동을 사용한다.
- 실제 전투 코드가 만든 투사체 정지 프레임:
  `artifacts/terrain-prototype-scale-v3/ranged-projectile-actual.png`

## 12. 좌우·대각선 이동 방향

- 화면: `artifacts/terrain-prototype-scale-v3/direction-showcase.png`
- 수치: `direction-validation.json`
- 검증 벡터는 우하 `(+, +)`, 우상 `(+, -)`, 좌하 `(-, +)`, 좌상
  `(-, -)` 네 경우를 포함한다. 우측 두 경우는 원본, 좌측 두 경우는
  `flipX=true`였다. 대각선 전용 원화는 없으므로 수직 성분은 facing art를
  바꾸지 않는다.

## 13. 고정 요새 UI

- 손상: `fixed-fortress-damaged-repair-ui.png`, `repair-fortress`만 노출
- 최대 HP: `fixed-fortress-max-hp-ui.png`, 행동 버튼 없음
- 파괴: `rebuild-fortress`만 노출
- 병참/조달/폐기/교체는 허용되지 않는다.

## 14. 일반 건설 거점 UI

- `artifacts/terrain-prototype-scale-v3/buildable-point-options-ui.png`
- 빈 아군 거점에서 `요새`, `병참`, `조달소` 세 선택지를 노출한다.
- 일반 거점과 고정 요새는 같은 타워 에셋을 사용할 수 있지만
  `pointType`, 허용 건물, 수리/재건/폐기 정책은 별도 데이터다.

## 15. 고정 요새 액션 자동 검증

`playwright-validation.json` 결과 `pass: true`, page error 0건이다.

| 상태 | 정책 액션 | 실제 보이는 버튼 |
| --- | --- | --- |
| 손상 | repair-fortress | repair-fortress |
| 최대 HP | 없음 | 없음 |
| 파괴 | rebuild-fortress | rebuild-fortress |
| 일반 빈 거점 | tower/supply/mint | tower/supply/mint |

## 16. foundation과 기단

- `artifacts/terrain-prototype-scale-v3/comparison-foundation-grounding.png`
- 타워 기단 최하단을 거점 groundY에 놓고, foundation 중심과 contact AO,
  방향성 그림자를 같은 점에서 계산한다. Scale 프리셋에 맞춰 foundation만
  중앙 테스트 영역에서 1.32/1.48/1.60배 보정한다.

## 17. 주요 변경 파일

- `src/config/prototypeVisualConfig.ts`
- `src/data/capturePointDefinitions.ts`
- `src/scenes/LaneBattleScene.ts`
- 이 검증 문서와 하네스 로그
- `artifacts/terrain-prototype-scale-v3/` 비교·수치·테스트 결과

## 18. Build

`npm run build` 통과. Vite의 기존 bundle size 경고만 남는다.

## 19. Diff 검사

`git diff --check` 통과.

## 20. Playwright

`1365 x 768`, DPR 1에서 세 프리셋, 12유닛 밀집, 근접/원거리 공격,
네 이동 벡터, 고정/일반 거점 UI를 검증했다. page error는 0건이다.

## 21. 전투 snapshot

`combat-state-comparison.json`에서 같은 정지 상태의 legacy와 V2 canonical
전투 상태는 정확히 같다. 이전 V2 기준과 `rules`, `unitStats`도 정확히
일치한다. 바뀐 것은 표시 크기/앵커/텍스트/facing과 명시적으로 요구된
고정 요새 행동 정책뿐이다.

## 22. 의도적으로 변경한 시각·UI 상태

- 유닛/타워 실루엣 CSS 크기
- 투명 여백 bounds에 따른 ground origin
- 고해상도 월드 Text와 중요도별 표시
- 이동/공격 facing 및 attack pose 유지 시간
- projectile의 V2 CSS 표시 크기와 발사 anchor
- 고정 요새와 일반 거점의 제목·행동 버튼
- 중앙 foundation/contact shadow 크기

## 23. 추가 아트 필요 목록

- 석기 3병종: 후면, 좌/우 원본 쌍, 네 대각선, 공격 windup/impact/recovery,
  hit, death 프레임
- 이후 시대 전 병종: idle/walk/attack/hit/death와 방향 세트
- projectile: 투석 회전/잔상, 화살 release, 총구 flash 전용 프레임
- 고정 요새와 일반 요새를 시각적으로 구분하는 전용 silhouette

현재 코드는 없는 원화를 완료된 것처럼 가장하지 않고 flip/fallback 범위를
명시한다.

## 24. 기술 추천

`recommended`를 다음 검토 후보로 추천한다. 투석 96px, 도끼 104px, 보급
116px, 일반 타워 144px, 고정 요새 162px로 요청 범위 안에 있고, 12유닛
밀집에서도 Compact보다 병종과 attack pose가 분명하다. Large는 고정 요새
라벨이 HUD와 충돌해 상한 비교에는 유용하지만 기본값으로는 과하다.

사용자 승인에 따라 `recommended`를 기본 크기 프리셋으로 확정했다. 비교와
회귀 확인을 위한 `scale=compact|recommended|large` 및 기존 지형 프리셋은
그대로 유지한다. 이 결정은 크기 기본값만 확정하며 중앙 지형을 전체 맵으로
확장하거나 전투 수치를 변경하지 않는다.
