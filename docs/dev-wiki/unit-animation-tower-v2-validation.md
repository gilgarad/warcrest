# Unit Animation and Tower Volley V2 Validation

Date: 2026-07-27
Branch: `terrain-prototype-central`
Baseline: `19b3aef`

## 1. 잘림과 위치 이동의 확정 원인

기존 포즈 PNG는 완성된 투명 sheet를 동일 폭으로 단순 분할한 결과였다.
실제 alpha bounds를 측정하자 여러 `walk-b` 프레임이 `x=0`과 캔버스
최우측에 동시에 닿았고, 옆 포즈의 발·천·팔 조각도 들어 있었다. 원본
`stone-*-sheet.png`의 캐릭터는 서로 독립된 alpha component로 완전하게 남아
있었으므로 원본 sheet의 각 component를 다시 추출했다.

코드에도 보조 원인이 있었다. 포즈별 `visibleHeightRatio`로 매 프레임의 전체
캔버스를 다시 확대해, 웅크린 포즈와 선 포즈의 신체 배율이 서로 달라졌다.
피격 시 `setTintFill(0xffffff)`도 80ms 동안 내부 디테일을 지워 하얗게 찢어진
실루엣처럼 보였다.

수정 후 등록된 모든 프레임은 `1152x1024`, ground anchor `(450, 900)`을
공유한다. alpha 최하단은 모두 `y=899`이고 좌우 경계에 닿는 프레임은 없다.
표시 배율은 현재 프레임의 alpha 높이가 아니라 유닛별 고정 reference 높이로
계산한다. 피격 효과는 디테일이 남는 warm tint로 변경했다.

비교 자료:

- `artifacts/unit-animation-tower-v2/stone-axeman-before-pose-comparison.png`
- `artifacts/unit-animation-tower-v2/stone-axeman-after-pose-comparison.png`
- slinger와 supply도 같은 경로의 `before/after-pose-comparison.png`
- `normalized-frame-metrics.json`

## 2. 돌도끼 공격 시퀀스

기존 attack 이미지는 도끼를 머리 위에 든 wind-up 한 장뿐이라 실제 공격은
전신 lunge로만 읽혔다. 프로젝트의 기존 돌도끼 외형을 참조해 ImageGen으로
wind-up, downward contact, low recover 3단계 전용 스트립을 생성하고 chroma
제거 후 공용 캔버스에 정규화했다. `attackProgress`가 3개 프레임을 순서대로
선택하므로 이후 프레임을 늘려도 씬의 switch 문은 바뀌지 않는다.

증거는 `stone-axeman-attack-windup.png`, `contact.png`, `recover.png`와
`axeman-attack-sequence.json`이다.

## 3. 청동창병 편입

청동창병은 더 이상 `token-spear`를 사용하지 않는다. 실제 청동 비늘 갑옷,
원형 방패, 청동 창을 가진 idle/walk-a/walk-b/attack-windup/attack-contact
자산을 제작했다. `UNIT_ANIMATION_REGISTRY`에서 석기 3종과 동일한
`UnitAnimationDefinition` 인터페이스와 공용 anchor 정책을 사용한다.

`bronze-wave-real-spearman.png`과 `bronze-wave-snapshot.json`은 실제 bronze
roster를 스폰했고 pose가 `bronze-spearman-idle`이며 token fallback이 아님을
보인다.

## 4. 타워 x2 판정

조사 시점의 코드는 스펙은 단발형이었지만 `tickWatchtower()` 내부에 이미
하드코딩된 두 번의 launch가 있어 실제로는 `6 x 2`였다. 즉 프롬프트의
"구조적으로 1발" 가설은 최신 baseline에는 완전히 맞지 않았다. 문제는 두
발이라는 의미가 데이터에 없고 투석병과 위력·공속도 달랐다는 점이었다.

| 공격 주체 | 발수 | 발당 피해 | 주기 | 한 volley 피해 |
| --- | ---: | ---: | ---: | ---: |
| 석기 투석병 | 1 | 7 | 1.3초 | 7 |
| 변경 전 타워 | 2(하드코딩) | 6 | 2.0초 | 12 |
| 변경 후 타워 | 2(스펙) | 7 | 1.3초 | 14 |

이번 선택은 총합 유지가 아니라 사용자 요구 그대로 투석병 한 기와 같은 탄을
두 발 발사하는 실제 x2 화력이다. `TowerAttackPattern`에
`projectileCount`, `perProjectileDamage`, `spreadWorldPx`를 명시했다.
`tower-two-stones-in-flight.png`와 `tower-volley-snapshot.json`은 서로 다른
좌표의 stone projectile 2개를 동시에 보존한다.

## 5. 구조 변경

- `src/presentation/units/unitAnimationRegistry.ts`: 유닛별 포즈 배열, asset
  manifest, 공용 canvas/anchor/reference scale
- `src/presentation/units/unitPresentation.ts`: 프레임 크기와 origin 계산
- `src/systems/lane-units/unitStats.ts`: 유닛 스탯과 유닛 투사체 종류
- `src/systems/lane-combat/towerAttack.ts`: 시대별 다중 탄 공격 패턴
- `src/systems/lane-combat/projectileLauncher.ts`: 공용 projectile 생성과
  포물선 이동

`LaneBattleScene`은 spawn 상태, 전투 orchestration, Phaser 객체 연결만 맡고
위 모듈의 public API를 호출한다. 파일은 3378줄에서 3356줄로 소폭 줄었으며,
이번 이슈와 무관한 경제·점령·웨이브 로직은 이동하지 않았다.

## 에셋 생성 출처

기존 석기 idle/walk/slinger/supply attack은 저장소 원본 sheet의 alpha
component를 재추출했다. 돌도끼 새 공격 3단계와 청동창병은 Codex 내장
ImageGen으로 생성한 프로젝트 전용 원본이다. 외부 게임 자산을 복제하지
않았다. 생성 프롬프트의 핵심은 다음과 같다.

- 돌도끼: 동일 캐릭터의 wind-up/downward-contact/low-recover 3패널,
  동일 발선과 크기, flat magenta chroma 배경
- 청동창: 동일 캐릭터의 idle/walk A/walk B/wind-up/contact, 청동 비늘갑옷,
  원형 방패와 완전한 창, 동일 발선, flat magenta chroma 배경

## 검증

```bash
npm run build
npm test
npx playwright test \
  tools/validation/unit-animation-tower-v2.spec.ts \
  tools/validation/unit-direction.spec.ts \
  tools/validation/support-mana.spec.ts \
  tools/validation/capture-point-distinction.spec.ts \
  tools/validation/world-surface.spec.ts \
  tools/validation/terrain-full-lane.spec.ts \
  --workers=1
```

- production build 성공. 기존 bundle 크기 경고만 남았다.
- Vitest `14`개 파일, `65`개 테스트 통과.
- 관련 Playwright `11`개 통과(`3.3m`). 포즈 정규화, 공격 3단계, 실제
  bronze roster, 동시 투사체 2개, 방향 반전과 기존 지형·보급·거점 회귀를
  함께 검증했다.
- 기존 `terrain-full-lane.spec.ts`가 이미 추가된 `world-surface` 순환 모드를
  반영하지 않아 `prototype-v2 -> legacy`를 기대하던 테스트만 런타임 정의에
  맞게 `prototype-v2 -> world-surface`로 정정했다. 게임 동작은 바꾸지 않았다.
- 타워 스냅샷의 두 돌은 X축으로 `26.1` world px 떨어져 있으며 테스트는
  `20` world px 초과를 단언한다.

## 남은 범위

bronze swordsman과 철기 유닛은 아직 token fallback이다. 이번 registry에
자산 정의만 추가하면 같은 골격으로 편입할 수 있지만, 요청 범위를 넘어 새
아트를 임의 생성하지 않았다.
