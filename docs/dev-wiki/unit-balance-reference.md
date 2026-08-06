# Unit Balance Reference

이 문서는 현재 게임 내부 설정 기준의 병력 기본 수치 표와 실제 적용 공식을
정리한 기준 문서다. 아트/연출과 분리된 전투 밸런스 기준은 여기서 추적한다.

## 기준

- 이동 속도는 현재 전 유닛 공통 정규화 배율값 `1`이다.
- 이 값은 실제 이동 진행값 자체가 아니라, 씬 내부 baseline 속도
  `UNIT_PROGRESS_SPEED = 0.02`에 곱해지는 배율이다.
- 즉 현재 실제 이동 계산은 `actualMovePerSec = 0.02 * speedMultiplier`이며,
  모든 유닛이 `speedMultiplier = 1`인 상태다.
- 공격 속도도 현재 전 유닛 공통 정규화 배율값 `1`이다.
- 현재 실제 공격 주기는 `attackCooldownSec`으로 개별 운용되지만,
  이후 별도 공격속도 차등을 넣을 수 있도록 기준 필드 `attackSpeed = 1`
  을 모든 유닛에 추가해 두었다.
- 공격 사거리는 profile baseline에 고정 배율을 곱하는 방식이 아니라,
  원거리 계열은 병종별 실제 수치를 직접 입력한다.
- baseline 사거리는 다음과 같다.
  - 근접 `1.5`
  - 원거리 `4.5`
  - 지원 `4.4`
- 연구 적용 전 값이 아래 표의 `기본 공격`, `기본 방어`다.
- 연구는 생산 시대(`selectedProductionAgeId`)별로 따로 누적된다.
- 현재 늦은 시대 신규 병종 일부는 기존 유닛 아트를 임시 재사용한다.

## 병력 표

| 시대 | 유닛 ID | 표시명 | 역할 | 기본 HP | 기본 공격 | 기본 방어 | 사거리 프로필 | 사거리 배율 | 실제 사거리 | 공격 속도 | 공격 간격(초) | 이동 속도 |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 석기 | `stone_slinger` | 투석 | 원거리 | 30 | 5 | 2 | ranged | 0.67 | 3 | 1 | 1.3 | 1 |
| 석기 | `stone_axeman` | 도끼 | 근접 | 50 | 9 | 3 | melee | 1 | 1.5 | 1 | 1.0 | 1 |
| 청동기 | `bronze_swordsman` | 청동검 | 근접 | 60 | 12 | 5 | melee | 1 | 1.5 | 1 | 0.95 | 1 |
| 청동기 | `bronze_spearman` | 청동창 | 근접 | 60 | 11 | 5 | melee | 1.47 | 2.21 | 1 | 1.05 | 1 |
| 초기 철기 | `archer` | 활 | 원거리 | 45 | 7 | 3 | ranged | 1 | 4.5 | 1 | 2.0 | 1 |
| 철기 | `iron_swordsman` | 철검 | 근접 | 70 | 16 | 8 | melee | 1.07 | 1.61 | 1 | 0.9 | 1 |
| 철기 | `iron_spearman` | 철창 | 근접 | 70 | 15 | 7 | melee | 1.6 | 2.4 | 1 | 1.0 | 1 |
| 후기 철기 | `knight` | 기사 | 근접 | 100 | 22 | 10 | melee | 1.2 | 1.8 | 1 | 1.45 | 1 |
| 르네상스 | `musketeer` | 총병 | 원거리 | 50 | 12 | 4 | ranged | 0.89 | 4 | 1 | 2.1 | 1 |
| 르네상스 | `pikeman` | 장창병 | 근접 | 70 | 20 | 9 | melee | 1.73 | 2.6 | 1 | 1.0 | 1 |
| 르네상스 | `heavy_cavalry` | 중기병 | 근접 | 120 | 24 | 12 | melee | 1.27 | 1.91 | 1 | 1.35 | 1 |
| 근대 초기 | `rifleman` | 소총병 I | 원거리 | 60 | 18 | 6 | ranged | 1.22 | 5.5 | 1 | 1.8 | 1 |
| 근대 초기 | `grenadier` | 척탄병 I | 원거리 | 60 | 22 | 6 | ranged | 0.67 | 3 | 1 | 2.0 | 1 |
| 근대 초기 | `light_cavalry` | 경기병 | 근접 | 90 | 23 | 10 | melee | 1.2 | 1.8 | 1 | 1.25 | 1 |
| 근대 초기 | `cannon_i` | 대포 I | 원거리 | 50 | 30 | 8 | ranged | 1.56 | 7 | 1 | 2.6 | 1 |
| 근대 후기 | `rifleman_late` | 소총병 II | 원거리 | 70 | 22 | 6 | ranged | 1.33 | 6 | 1 | 1.65 | 1 |
| 근대 후기 | `grenadier_late` | 척탄병 II | 원거리 | 70 | 25 | 6 | ranged | 0.89 | 4 | 1 | 1.85 | 1 |
| 근대 후기 | `cavalry` | 기병대 | 근접 | 120 | 28 | 12 | melee | 1.27 | 1.91 | 1 | 1.2 | 1 |
| 근대 후기 | `cannon_ii` | 대포 II | 원거리 | 70 | 36 | 8 | ranged | 1.78 | 8 | 1 | 2.35 | 1 |
| 현대 초기 | `infantry` | 보병 | 원거리 | 70 | 30 | 10 | ranged | 1.33 | 6 | 1 | 1.45 | 1 |
| 현대 초기 | `machine_gunner` | 기관총병 | 원거리 | 70 | 32 | 26 | ranged | 1.22 | 5.5 | 1 | 0.8 | 1 |
| 현대 초기 | `shock_trooper` | 돌격병 | 근접 | 70 | 36 | 13 | melee | 1.13 | 1.7 | 1 | 0.8 | 1 |
| 현대 초기 | `artillery_i` | 포병 I | 원거리 | 80 | 42 | 20 | ranged | 2.22 | 10 | 1 | 2.45 | 1 |
| 현대 중기 | `automatic_rifleman` | 자동소총병 | 원거리 | 70 | 34 | 20 | ranged | 1.48 | 6.5 | 1 | 1.0 | 1 |
| 현대 중기 | `support_gunner` | 지원화기병 | 원거리 | 70 | 30 | 24 | ranged | 0.91 | 4 | 1 | 1.15 | 1 |
| 현대 중기 | `mobile_infantry` | 기동병 | 원거리 | 70 | 38 | 30 | ranged | 1.14 | 5 | 1 | 0.95 | 1 |
| 현대 중기 | `artillery_ii` | 포병 II | 원거리 | 90 | 50 | 26 | ranged | 2.73 | 12 | 1 | 2.15 | 1 |
| 현대 중기 | `tank` | 전차 | 원거리 | 150 | 45 | 50 | ranged | 2 | 9 | 1 | 1.9 | 1 |
| 현대 후기 | `special_forces` | 특수보병 | 원거리 | 80 | 38 | 22 | ranged | 1.56 | 7 | 1 | 0.9 | 1 |
| 현대 후기 | `heavy_gunner` | 중화기병 | 원거리 | 80 | 36 | 20 | ranged | 0.91 | 4 | 1 | 1.0 | 1 |
| 현대 후기 | `breakthrough_trooper` | 돌파병 | 근접 | 110 | 52 | 22 | melee | 1.27 | 1.91 | 1 | 0.75 | 1 |
| 현대 후기 | `mobile_artillery` | 자주포 | 원거리 | 120 | 64 | 18 | ranged | 2.67 | 12 | 1 | 1.85 | 1 |
| 현대 후기 | `modern_tank` | 현대 전차 | 원거리 | 200 | 60 | 60 | ranged | 2.27 | 10 | 1 | 1.6 | 1 |
| 석기/청동기 | `supply_wagon` | 보급 | 지원 | 28 | 0 | 1 | support | 0.68 | 3 | 1 | 1.2 | 1 |
| 철기 | `supply_wagon` | 보급 | 지원 | 40 | 0 | 3 | support | 0.8 | 3.5 | 1 | 1.2 | 1 |
| 르네상스 | `supply_wagon` | 보급 | 지원 | 60 | 0 | 8 | support | 0.91 | 4 | 1 | 1.2 | 1 |
| 근대 | `supply_wagon` | 보급 | 지원 | 80 | 0 | 14 | support | 1.02 | 4.5 | 1 | 1.2 | 1 |
| 현대 초기 | `supply_wagon` | 보급 | 지원 | 120 | 0 | 30 | support | 1.14 | 5 | 1 | 1.2 | 1 |
| 현대 중기/후기 | `supply_wagon` | 보급 | 지원 | 140 | 0 | 40 | support | 1.25 | 5.5 | 1 | 1.2 | 1 |

## 현재 구현 공식

### 연구 배율

- 레벨별 배율:
  - `researchMultiplier(level) = 1 + 0.1 * level`
- 스폰 시 공격/방어 적용:
  - `spawnAttack = round(baseAttack * researchMultiplier(attackLevel))`
  - `spawnDefense = round(baseDefense * researchMultiplier(defenseLevel))`
- 연구 레벨 상한:
  - 석기/청동기 `10`
  - 철기 전 구간 `20`
  - 르네상스/근대 전 구간 `30`
  - 현대 전 구간 `40`

### 병력 대 병력 피해

- 소모도 반영 기본 공격력:
  - `damageBase = attack * (1 - attrition)`
- 병참 버프 반영 후 방어 차감:
  - `finalDamage = max(1, round(damageBase * attackBuffMultiplier - defense))`

### 병력 대 타워 피해

- 타워도 동일하게 실제 방어력으로 감산:
  - `finalTowerDamage = max(1, round((attack * (1 - attrition)) * attackBuffMultiplier - towerDefense))`

### 사거리 계산

- 유닛 사거리:
  - `unitRange = baseRangeByProfile[rangeProfile] * rangeMultiplier`
- 진행 거리 환산:
  - `rangeProgress = unitRange * RANGE_TO_PROGRESS`
- 현재 `RANGE_TO_PROGRESS = 0.013`

### 타워 사거리 계산

- 타워는 시대별 참조 원거리 병종을 가진다.
  - 석기/청동기 `stone_slinger`
  - 초기 철기/중기 철기 `archer`
  - 후기 철기/르네상스 `musketeer`
  - 근대 초기 `cannon_i`
  - 근대 후기 `cannon_ii`
  - 현대 초기 `artillery_i`
  - 현대 중기 `artillery_ii`
  - 현대 후기 `mobile_artillery`
- 실제 진행 거리:
  - `towerRangeProgress = referenceUnit.range * 1.2 * RANGE_TO_PROGRESS`

### 본진 피해

- 본진 직접 타격은 병력 공격력 대신 공격 주기 기반 공식을 사용:
  - `baseDamage = max(1, round(5.8 * attackCooldownSec * (1 - attrition)))`

### 보급 치유

- `healPower`를 사거리 내 부상 아군에게 체력 비율이 낮은 순서대로 분배한다.
- 각 대상 적용량:
  - `appliedHeal = min(missingHp, max(1, remainingHeal))`
- 총합이 0보다 클 때만 치유가 실제 발생한다.

### 처치 보상

- 시대별 총 자원량:
  - `totalReward = round(killGoldBase)`
- 항상 `gold = 1`, `wood = 1`, `food = 1`에서 시작한다.
- 남은 `totalReward - 3`은 `gold/wood/food` 중 하나에 1씩 무작위 분배된다.

## 비고

- 현재 병력 간 이동 속도 차등은 의도적으로 꺼져 있다.
- 차후 속도 차등을 재도입할 때도 이 문서의 `이동 속도 1`은
  "baseline `0.02`에 곱하는 배율 기준값"으로 유지한다.
- 차후 원거리 병종 차등 사거리를 재도입할 때도, 현재의
  `rangeMultiplier = 1`을 sling baseline 기준으로 확장한다.
