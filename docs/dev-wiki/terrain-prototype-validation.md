# 중앙 거점 지형 프로토타입 검증

## 범위

`terrain-rendering-plan.md`의 0단계와 1단계만 구현한다.

- 기존 원경 매트 배경 유지
- 중앙 거점 주변 `8 x 8` 논리 셀만 하이브리드 지형 렌더링
- 고정 고각 쿼터뷰 유지
- TypeScript `BattlefieldMapSpec` 사용
- 맵 규격은 저장 형식과 분리하여 이후 Tiled JSON adapter가 같은 런타임
  규격을 만들 수 있게 함
- 구조물 footprint와 우회 슬롯은 데이터만 정의
- footprint는 이번 단계에서 이동 차단에 연결하지 않음
- 웨이브, 전투, 점령, 이동, 충돌 시스템은 교체하지 않음

## 에셋 조사와 선택

기존 저장소에는 다음 자산이 있었다.

- 한 장으로 완성된 전장 배경 이미지
- 투명 배경의 본진, 타워 상태별 이미지, 나무, 바위
- 석기 시대 유닛과 동작 프레임

반복 가능한 잔디/흙/석재 지형 타일, 전환 데칼, foundation, 방향성 접지
그림자는 없었다. `lane-battlefield-base-v3.png`의 빈 지면은 현재 사용하는
`lane-battlefield-object-base-v4.png`와 시점과 조명이 달라 직접 잘라 쓰지
않았다.

선택은 **C. 임시 프로토타입용 텍스처 신규 생성**이다. 다음 파일은
production asset이 아니며 파일명에 `prototype-placeholder`를 명시했다.

- `public/assets/prototype-terrain/prototype-placeholder-grass-v1.png`
- `public/assets/prototype-terrain/prototype-placeholder-dirt-v1.png`
- `public/assets/prototype-terrain/prototype-placeholder-stone-v1.png`

생성 방식:

- Codex built-in `image_gen`
- 거의 탑다운에 가까운 고각 지면
- 현재 배경과 맞는 저채도 올리브/움버/회색 팔레트
- 균일한 좌상단 자연광
- 지평선, 건물, 유닛, 큰 장식물, 텍스트 제외
- 기존 게임 자산을 입력 또는 복제 대상으로 사용하지 않음

## 구현 구조

### 런타임 맵 규격

`src/data/battlefieldMaps.ts`의 `BattlefieldMapSpec`은 다음을 정의한다.

- 지형 패치와 셀 재질
- 월드 중심점과 회전
- 구조물 socket
- 구조물 footprint
- 우회 슬롯
- 이동 차단 여부

이 타입은 TypeScript 파일, Tiled JSON 등의 저장 형식을 포함하지 않는다.
향후 adapter는 외부 저장 데이터를 이 런타임 규격으로 변환해야 한다.

### 프로토타입 렌더러

`src/gfx/battlefieldPrototypeRenderer.ts`가 다음을 담당한다.

- 중앙 패치의 잔디/흙/석재 계층
- 인접한 같은 재질 셀의 렌더 밴드 합성
- 중앙 타워 foundation
- 중앙 타워 방향성 접지 그림자
- 전체 prototype 오브젝트의 즉시 표시/숨김

논리 데이터는 `8 x 8` 셀을 유지한다. 개별 반투명 셀을 그대로 그리면 셀
경계가 격자선으로 보였으므로, 렌더 단계에서 인접한 같은 재질 행만 하나의
밴드로 합성한다.

### presentation 교정

- 석기 유닛은 원본 프레임 종횡비를 유지한다.
- 유닛 origin은 발 부근 `0.88`을 ground anchor로 사용한다.
- 유닛 그림자는 발 위치에 붙이고 좌상단 광원에 맞춰 약간 우하단으로 이동한다.
- 타워, 유닛, 그림자, HP바, 이름표, 선택 표시, 투사체 시작/목표점을
  ground anchor 기준으로 다시 계산한다.
- 동적 오브젝트는 `groundY` 기반 depth 공식을 사용한다.

## 재현 가능한 실행

개발 서버:

```bash
npm run dev -- --host 127.0.0.1 --port 5188 --strictPort
```

기존 렌더링:

```text
http://127.0.0.1:5188/?terrain=legacy&camera=central&seed=warcrest-central-v1
```

프로토타입 렌더링:

```text
http://127.0.0.1:5188/?terrain=prototype&camera=central&seed=warcrest-central-v1
```

- `camera=central`: 중앙 거점을 동일한 카메라 중심으로 재현
- `seed=warcrest-central-v1`: Phaser 난수 시드를 고정
- `terrain=legacy|prototype`: 최초 렌더 모드 선택
- 전투 중 `T`: 두 렌더 모드 즉시 전환

브라우저 콘솔 비교:

```js
const control = window.__terrainPrototypeControl;
control.focusCentral();
control.setPaused(true);
control.setEnabled(false); // legacy
control.setEnabled(true);  // prototype
control.snapshot();        // 현재 비교 상태
```

같은 실행을 정지한 뒤 표시 모드만 바꾸므로 게임 상태와 애니메이션 시간이
진행되지 않은 상태에서 비교할 수 있다.

## 기준 수치

`window.__gameDebug.verification`과 캡처 JSON에 다음 값을 기록한다.

- 월드: `7000 x 3900`
- 카메라 줌: `0.46`
- 웨이브 주기: `90초`
- 기본 진행 속도 계수: `0.02`
- 사거리 변환 계수: `0.013`
- 아군 간격: `0.013`
- 교전 간격: `0.022`
- 점령 반경: `0.06`
- 초당 점령 속도: `0.36`
- 양쪽 본진 HP: `400`
- 레인 행 간격: `42`
- 모든 병종의 HP, 공격, 방어, 사거리, 속도, 공격 주기, 회복량

## 비교 산출물

- 구현 전 원본:
  `artifacts/terrain-prototype/baseline-preimplementation.png`
- 구현 전 debug:
  `artifacts/terrain-prototype/baseline-preimplementation-debug.json`
- 동일 상태 legacy:
  `artifacts/terrain-prototype/baseline-legacy.png`
- 동일 상태 prototype:
  `artifacts/terrain-prototype/prototype-central.png`
- 나란히 비교:
  `artifacts/terrain-prototype/comparison-side-by-side.png`
- 양쪽 debug:
  `artifacts/terrain-prototype/baseline-legacy-debug.json`
  `artifacts/terrain-prototype/prototype-debug.json`
- 비교 결과:
  `artifacts/terrain-prototype/comparison-result.json`

동일 실행을 정지하고 모드만 바꾼 결과, `terrainMode`를 제외한 snapshot의
JSON이 정확히 일치했다. 즉 이번 프로토타입 전환은 전투 상태를 변경하지
않았다.

## 현재 판단

확인된 점:

- 낮은 강도의 구조화된 석재/흙 재질은 기존 원경 배경 위에 덧붙일 수 있다.
- foundation과 접지 그림자는 타워와 지면의 연결감을 개선한다.
- 유닛 강제 정사각형 왜곡을 제거해 원본 실루엣을 보존할 수 있다.
- 기존 `progress + laneRow` 전투를 유지한 상태로 렌더 계층을 추가할 수 있다.

남은 문제:

- placeholder 재질과 배경 도로의 붓 터치 및 석재 크기가 완전히 같지는 않다.
- 패치가 충분히 은은하지만 양 끝과 재질 경계는 자세히 보면 구분된다.
- 유닛 원본이 배경보다 낮은 시점의 정면 인물화라 종횡비 교정만으로 화풍과
  카메라 각도 문제를 해결할 수 없다.
- 배경에 구워진 원형 거점 패드 위에 새 foundation을 얹으므로 최종 단계에는
  중앙 패드가 제거된 지면 청크가 필요하다.
- 중앙 타워 이외의 건물, 배경 오브젝트 가림, footprint 충돌은 아직 기존
  상태다.

이 상태에서 전체 레인으로 확장하지 않는다. 다음 단계 전에 지형 혼합 강도,
foundation 형태, 유닛 재제작 우선순위를 사용자에게 확인한다.
