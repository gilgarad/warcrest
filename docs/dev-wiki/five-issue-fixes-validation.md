# 5개 이슈 수정과 전체 레인 지형 확장 검증

## 범위와 기준

- 브랜치: `terrain-prototype-central`
- 작업 기록: 별도 GitHub Issue 없이 `docs/dev-wiki/log.md` fallback 사용
- 다른 세션 변경: `project_development.md`는 작업 시작 전부터 수정 상태였고
  이번 작업에서 읽기 외 수정·스테이징하지 않았다.
- 각 항목을 순서대로 구현하고 매 단계 `npm run build`, `npm test`를
  실행했다.

## 1. 보급대 회복량

과거 전투 유닛 5기 기준 총 회복량 10을 현재 로스터 크기에 비례시킨다.

```text
healPower = 10 * currentBattlelineCount / 5
```

모든 현재 시대 로스터의 전투 유닛 수가 3이므로 회복량은 6, 주기는 기존
`1.2초`를 유지한다. `getSupportHealPower(ageId)`가 실제 로스터를 조회하므로
향후 로스터가 바뀌어도 같은 기준이 적용된다.

균일 피해 모델(HP 34, 초당 피해 3) 검증 결과:

| 조건 | 생존 시간 |
|---|---:|
| 보급대 없음 | 11.33초 |
| 과거 5기 + 회복 10 | 25.50초 |
| 현재 3기 + 비례 회복 6 | 25.50초 |
| 현재 3기 + 기존 회복 10 | 153.00초 |

이는 전투 AI 전체를 재작성하지 않는 단위 시뮬레이션이며 실제 체감은 추가
플레이 조정 대상이다.

## 2. 30초 웨이브

- `WAVE_INTERVAL_SEC`: `90 -> 30`
- 즉시 웨이브 토큰 쿨다운: 기존 확정 규칙인 직전 웨이브 후 `10초` 유지
- AI 토큰 임계값: 기존 `22 / 90` 비율을 상수화해 30초 주기에서는
  `7.333...초`로 계산

따라서 토큰은 10초 뒤 열리고, AI는 다음 정규 웨이브가 약 7.33초보다 더
남았을 때만 사용한다. 30초 주기 대부분에서 무조건 참이 되는 회귀를 막았다.

## 3. 절차형 오디오 개선

이 Codex 세션에는 실제 오디오 파일 생성 도구가 없었다. 외부 자산을
가장하지 않고 Web Audio 합성을 개선했으며 매니페스트는 BGM 6개/SFX
33개 모두 `missingAsset: true`를 유지한다. `licenseNote`에는 외부 파일이
아닌 런타임 합성임을 명시했다.

- BGM: 32/48스텝 프레이즈, 저음 현악 지속층, 금관층, 베이스, 리드,
  pulse, 타악층을 상태별로 조합했다. `battle-high`는 `battle-low`보다
  레이어 밀도와 긴장도가 높다.
- 베기: high-pass/band-pass 노이즈와 하강 피치 transient를 겹친 `blade`
- 충격: 저역 노이즈와 sine/triangle thump를 겹친 `impact`
- 피격/사망: formant 대역과 breath noise를 이용한 `grunt`
- 치유: 시간차를 둔 sine/triangle partial과 sparkle noise의 `healChime`
- `sfx.support.heal`을 실제 회복량이 0보다 큰 `tickSupport()` 이벤트에만
  연결했다.

Audio Lab은 각 버튼에 `data-asset-id`를 제공한다. Playwright가 저강도에서
고강도로 전환하고 네 음색 계열과 힐 차임을 각각 재생해 `lastError=null`,
활성 BGM 존재, 누락 개수 `{ bgm: 6, sfx: 33 }`, 콘솔/HTTP 오류 0을 확인한다.

## 4. 키보드 전용 지형 전환

등록 장면을 다시 조사한 결과 키보드가 유일한 사용자 경로인 기능은
`LaneBattleScene`의 `keydown-T`뿐이었다. 지형 모드는 제품 기능이 아니라
비교 검증용이므로 일반 플레이에서 리스너를 등록하지 않는다.

- 일반 URL: `T` 입력 무반응
- QA URL: `?terrainDebug=1`일 때만
  `legacy -> prototype -> prototype-v2` 순환
- 장면 종료 시 리스너 해제
- Boot의 Space와 Audio Settings의 ESC/M/화살표는 동일 기능의 포인터 UI가
  있으므로 보조 단축키로 유지
- 미등록 `DungeonScene`의 WASD는 변경하지 않음

Vitest와 실제 Chromium 키 입력으로 일반/QA 두 경로를 모두 검증했다.

## 5. 전체 플레이 레인 하이브리드 지형

전체 원경을 순수 타일맵으로 교체하지 않았다. 승인된 구조인 **원경 매트
배경 + 플레이 가능 레인의 구조화 타일/데칼 + 논리 셀**을 확장했다.

- `BattlefieldMapSpec.lanePath`가 기존 5개 progress/world 노드의 단일
  원본이 됐다. 장면 이동 경로와 지형 생성이 같은 데이터를 사용한다.
- 5개 노드 사이에 4개 연속 레인 세그먼트를 생성했다.
- 각 세그먼트는 8행이며 전체 `368`개 논리 셀을 가진다.
- 셀은 중앙 stone, 양쪽 dirt, 외곽 grass 재질과 결정적 variant를 가진다.
- V2 렌더러는 세그먼트 실제 길이/폭을 사용해 저알파 재질 밴드와 길이에
  비례한 불규칙 데칼을 렌더링한다. 세그먼트는 240 world px 겹쳐 굴곡
  연결부가 끊기지 않는다.
- 세 거점 모두 footprint, ground foundation, contact/directional shadow,
  bypass slot을 가진다.
- V1 중앙 8x8 비교 맵은 별도 spec으로 보존했다.
- 기존 1254x1254 prototype 잔디/흙/석재 텍스처만 재사용했고 새 외부
  에셋이나 전체 배경 재생성은 없었다.
- 명시된 범위대로 셀과 footprint를 실제 충돌/이동 차단에는 연결하지 않았다.

동일 실행을 정지한 뒤 legacy와 V2를 전환해 렌더 전용 presentation 필드를
제외한 자원, 일꾼, 본진 HP, 웨이브, 유닛 논리 좌표/HP, 거점, 규칙과 스탯이
정확히 같음을 확인했다. 아군측 `0.20`, 중간 `0.50`, 중앙 `0.588`, 적군측
`0.84` 카메라 캡처로 전체 세그먼트 연결도 확인했다.

## 검증 결과

```text
npm run build                         PASS
npm test                              PASS (12 files, 57 tests)
npm run test:e2e                      PASS (4 Playwright tests)
terrain-full-lane.spec.ts             PASS (2 Playwright tests)
git diff --check                      PASS
```

산출물:

- `artifacts/audio-integration/audio-lab-layered-synthesis.png`
- `artifacts/audio-integration/playwright-audio-validation.json`
- `artifacts/terrain-full-lane/before-central.png`
- `artifacts/terrain-full-lane/after-central.png`
- `artifacts/terrain-full-lane/after-player-side.png`
- `artifacts/terrain-full-lane/after-middle.png`
- `artifacts/terrain-full-lane/after-enemy-side.png`
- `artifacts/terrain-full-lane/before-snapshot.json`
- `artifacts/terrain-full-lane/after-snapshot.json`

## 남은 판단

- 합성음의 “웅장함/타격감”은 자동 테스트로 취향을 판정할 수 없다. Audio
  Lab과 실제 전투에서 사용자가 청취한 뒤 음량, pitch, 레이어 밀도를
  피드백해야 한다.
- 원경 매트 내부 벽·나무는 여전히 occluder가 아니며 논리 셀도 아직 충돌에
  연결되지 않았다. 이는 기존 단계 계획의 footprint/occlusion/이동 통합
  후속 범위다.
- 외곽 두 거점의 원형 패드는 원경 매트에 구워진 상태다. 현재 저알파 레인과
  foundation은 자연스럽게 중첩되지만, 최종 아트 단계에서 배경 variant로
  제거할지는 시각 검토 후 결정한다.
