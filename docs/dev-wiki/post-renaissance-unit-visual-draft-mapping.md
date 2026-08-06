# Post-Renaissance Unit Visual Draft Mapping

이 문서는 2026-08-03에 생성한 `르네상스 이후 신규 병종` 및 `시대별 보급대`
시안 보드를 실제 유닛 ID에 대응시키는 매핑 기록이다.

중요:

- 이번 단계는 **시안 보드 생성 + 유닛 ID 매핑**까지다.
- 아직 런타임 생산 자산(8방향 x 4포즈 png 세트) 교체는 하지 않았다.
- 사용자가 지적한 대로, 기존 `색 변화 + 장비 오버레이` 중심 placeholder 방식 대신
  **새 실루엣/장비 구성을 가진 새 시안**을 먼저 고정하는 목적이다.
- 모든 시안은 기존 게임 유닛 풋프린트에서 크게 벗어나지 않도록, 서쪽을 보는
  생산 유닛 시점/비율을 유지하는 쪽으로 생성했다.

## Draft Boards

- [Support Wagon Age Drafts](./visual-drafts/support-wagon-age-drafts-2026-08-03.png)
- [Renaissance / Industrial Early Drafts](./visual-drafts/renaissance-industrial-early-drafts-2026-08-03.png)
- [Industrial Late / Transition Drafts](./visual-drafts/industrial-late-modern-early-drafts-2026-08-03.png)
- [Modern Early / Mid Infantry Drafts](./visual-drafts/modern-early-mid-infantry-drafts-2026-08-03.png)
- [Modern Heavy Drafts](./visual-drafts/modern-heavy-drafts-2026-08-03.png)

## Pose Master Boards

- [Late Era Human Pose Board](./visual-drafts/late-era-human-pose-board-2026-08-06-5col.png)
- [Late Era Heavy Pose Board](./visual-drafts/late-era-heavy-pose-board-2026-08-03.png)
- [Support Evolution Pose Board](./visual-drafts/support-evolution-pose-board-2026-08-06-5col.png)
- [Modern Combat Pose Board](./visual-drafts/modern-combat-pose-board-2026-08-06-5col.png)
- [Mechanized Pose Board](./visual-drafts/mechanized-pose-board-2026-08-06-5col.png)

위 보드들은 `idle / walk-a / walk-b / walk-c / attack(or support-action)` 구성을 가진
후속 생산 기준 시트다. 기존 컬럼형 시안 보드가 “어떤 병종으로 갈지”를
고정하는 목적이었다면, 이 포즈 보드는 “실제 프레임을 어떤 자세로 만들지”를
고정하는 목적이다.

보급대 포즈 보드 주의:

- 보급대의 세 번째 포즈는 `2인 상호작용 장면`이 아니라, **보급대 단독
  heal/support 모션**이어야 한다.
- 즉, 대상 병사가 프레임 안에 같이 들어오면 안 된다.
- 런타임 기준으로는 `자기 장비를 펼치고 의무/보급/수리 동작을 수행하는`
  식의 단일 유닛 애니메이션으로 해석한다.

## Runtime Production Status

- `tools/asset-qa/generate_pose_board_production_assets.py`를 통해, 포즈 보드에서
  직접 `public/assets/production/units/`용 8방향 x 5포즈 png 세트를 생성하도록
  했다.
- 이번 생성 대상은 후기 시대 병종과 시대별 보급대 prefix까지 포함한
  총 29개 family다.
  - 예: `pikeman`, `rifleman-late`, `artillery-ii`, `modern-tank`,
    `supply-wagon-renaissance`, `supply-wagon-modern`
- 보급대는 더 이상 단일 `supply-wagon-*` 세트만 보지 않고, 시대 그룹별
  prefix(`supply-wagon-ancient`, `-iron`, `-renaissance`, `-industrial`,
  `-modern`)를 런타임에서 선택하도록 배선했다.

## Support Wagon Mapping

| 시대 그룹 | 보드 | 컬럼 | 시안 설명 |
| --- | --- | ---: | --- |
| 석기 / 청동기 | Support Wagon Age Drafts | 1 | 원시 운반 프레임, 바구니/가죽/모피 |
| 철기 전 구간 | Support Wagon Age Drafts | 2 | 창/상자/금속 보강이 들어간 병참 운반수 |
| 르네상스 | Support Wagon Age Drafts | 3 | 화약통/캔버스 롤/가죽 하네스 |
| 근대 전 구간 | Support Wagon Age Drafts | 4 | 금속 브레이스와 탄약 상자 중심의 야전 하울러 |
| 현대 초기 | Support Wagon Age Drafts | 5 | 무전/의무/강화 배낭을 포함한 현대 초기 병참병 |
| 현대 중기 / 후기 | Support Wagon Age Drafts | 6 | 하드케이스/모듈팩 중심의 현대형 보급 오퍼레이터 |

## Battle Unit Mapping

| 유닛 ID | 표시명 | 보드 | 컬럼 | 시안 설명 |
| --- | --- | --- | ---: | --- |
| `pikeman` | 장창병 | Renaissance / Industrial Early Drafts | 1 | 르네상스 장창 보병 |
| `heavy_cavalry` | 중기병 | Renaissance / Industrial Early Drafts | 2 | 장갑 기병 |
| `rifleman` | 소총병 I | Renaissance / Industrial Early Drafts | 3 | 초기 근대 소총수 |
| `grenadier` | 척탄병 I | Renaissance / Industrial Early Drafts | 4 | 초기 근대 척탄병 |
| `rifleman_late` | 소총병 II | Industrial Late / Transition Drafts | 1 | 후기 근대 소총수 |
| `grenadier_late` | 척탄병 II | Industrial Late / Transition Drafts | 2 | 후기 근대 척탄병 |
| `cavalry` | 기병대 | Industrial Late / Transition Drafts | 3 | 후기 근대 기병 |
| `cannon_ii` | 대포 II | Industrial Late / Transition Drafts | 4 | 후기 근대 포대 |
| `infantry` | 보병 | Modern Early / Mid Infantry Drafts | 1 | 현대 초기 기본 보병 |
| `machine_gunner` | 기관총병 | Modern Early / Mid Infantry Drafts | 2 | 벨트급탄식 중화기 보병 |
| `shock_trooper` | 돌격병 | Modern Early / Mid Infantry Drafts | 3 | 근접 돌입형 전투원 |
| `automatic_rifleman` | 자동소총병 | Modern Early / Mid Infantry Drafts | 4 | 자동화기 기반 기동 사수 |
| `support_gunner` | 지원화기병 | Modern Early / Mid Infantry Drafts | 5 | 더 무거운 지원화기 운용병 |
| `mobile_infantry` | 기동병 | Modern Early / Mid Infantry Drafts | 6 | 경량화된 기동형 병사 |
| `artillery_i` | 포병 I | Modern Heavy Drafts | 1 | 현대 초기 포병 |
| `artillery_ii` | 포병 II | Modern Heavy Drafts | 2 | 현대 중기 포병 |
| `tank` | 전차 | Modern Heavy Drafts | 3 | 현대 중기 전차 |
| `special_forces` | 특수보병 | Modern Heavy Drafts | 4 | 정찰/특작형 전투원 |
| `heavy_gunner` | 중화기병 | Modern Heavy Drafts | 5 | 장비 중량감이 큰 중화기 운용병 |
| `mobile_artillery` | 자주포 | Modern Heavy Drafts | 6 | 중장비 메카나이즈드 계열 시안 |
| `modern_tank` | 현대 전차 | Modern Heavy Drafts | 6 | 자주포보다 더 무겁게 갈 현대 전차 계열 시안 |

## Next Step

- 새 포즈 마스터 보드를 기준으로, 병종별로 서쪽 기준
  `idle / walk-a / walk-b / walk-c / attack` 프레임을 실제 게임용
  production png 세트로 분해한다.
- 보급대는 `idle / walk-a / walk-b / walk-c / heal-support` 5포즈를 같은
  체적과 방향 안에서 이어지는 단일 유닛 애니메이션으로 제작한다.
- 그 다음 기존 `public/assets/production/units/<prefix>-<dir>-<pose>.png`
  계약에 맞춰 8방향 x 4포즈 생산 자산으로 정규화한다.
