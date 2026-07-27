# 5개 후속 이슈 수정 검증

기준 커밋은 `f1850aa` 이후 문서 커밋이 반영된 `1b842b8`이다. 작업 브랜치는
`terrain-prototype-central`이며, 다른 세션의 `project_development.md` 변경은
수정하거나 스테이징하지 않았다.

## 1. 보급대 마나와 치유량

### 확정 원인

로스터 비례식으로 1회 치유량은 10에서 6으로 줄었지만, 1.2초마다 자원 제한
없이 계속 발동했다. 3명에게 초당 총 5 HP를 영구 공급해 체감 유지력이 여전히
과도했다.

### 변경

- 현재 3인 로스터 기준 1회 총 치유량 `4`
- 마나 `18/18`, 1회 비용 `6`, 초당 회복 `1.25`
- 초기 세 번 발동 후 마나가 고갈되고, 이후 약 4.8초를 모아 다음 치유 발동
- 모든 시대가 실제 전투 로스터 수를 참조해 같은 계산식 사용
- 보급대 HP바 아래에 파란 마나 게이지 표시

균일 피해 모델의 생존 시간은 무보급 약 `11.33초`, 과거 5인 무제한 기준
약 `25.5초`, 새 마나 게이트 약 `14초`다. 전투 결과는 실제 전투 AI가 아닌
수치 선택용 통제 모델이며 회귀 기준은 단위 테스트에 고정했다.

사람 확인 자료:

- `artifacts/support-mana/01-full-mana.png`
- `artifacts/support-mana/02-depleted-after-three-heals.png`
- `artifacts/support-mana/03-waiting-for-mana.png`
- `artifacts/support-mana/04-recovered-cast.png`
- `artifacts/support-mana/support-mana-timeline.json`

## 2. BGM 실제 가청성

### 확정 원인

unlock, director, mute와 BGM voice 상태 흐름은 끊기지 않았다. 실제 문제는
백엔드에 공통 출력 버스가 없어 신호를 검증할 수 없던 점과, 낮은 악기별
gain에 `1100/1700Hz` 로우패스가 겹쳐 실제 출력 에너지가 지나치게 낮았던
점이다. Audio Lab도 `AudioSystem.initialize()`를 생략해 게임과 다른 초기화
경로를 쓰고 있었다.

### 변경과 실측

- 모든 BGM/SFX를 `output bus -> AnalyserNode -> destination`으로 통합
- 실제 마스터 출력의 RMS, peak, frame RMS, waveform 계측 API 추가
- Audio Lab도 정식 initialize 경로 사용
- battle-low/high 필터를 `2200/3600Hz`로 열고 긴장도별 orchestration gain
  `1.7/2.05` 적용

| 상태 | 변경 전 RMS | 변경 후 RMS |
|---|---:|---:|
| battle-low | 0.005560 | 0.009096 |
| battle-high | 0.006773 | 0.012835 |
| mute | 0.000081 | 0.000001 |

사람 확인 자료는 `artifacts/audio-signal/before-waveform.svg`,
`after-waveform.svg`, 두 phase의 `signal.json`이다. 이는 재생 함수 호출 여부가
아니라 destination 직전 실제 신호 에너지를 측정한다. 브라우저/OS 이후의
물리 스피커 고장은 웹 앱에서 검증할 수 없다.

## 3. 이동 방향 모션

### 확정 원인과 변경

`facingX`는 이동 벡터에서 정상 계산됐지만 최종 `flipX`가
`terrainMode === "prototype-v2"`일 때만 적용됐다. 쿼리 없는 당시 기본 모드는
`prototype`이어서 일반 플레이에서 좌우 반전이 사라졌다. 방향별 원화는 없기
때문에 기존 단일 방향 pose와 `flipX` 방식은 유지하고 지형 모드 조건만 제거했다.

`artifacts/unit-direction/`에 왼쪽 3프레임과 오른쪽 3프레임, 각 프레임의
motion/facing/flip 값이 있다. 왼쪽은 모두 `motion.x < 0`, `facingX=-1`,
`flipX=true`; 오른쪽은 반대 조건을 만족했다.

## 4. 통짜 배경 제거 아키텍처 1단계

### 재진단

기존 V2도 통짜 매트의 길, 벽, 나무, 조명 위에 저알파 타일을 얹는 구조였다.
알파를 높이면 서로 다른 원근과 디테일이 충돌하고, 낮추면 매트가 계속 장면을
지배한다. 매트 내부 요소는 depth/footprint가 없으므로 유닛 가림에도 참여할
수 없다. 따라서 알파 조정으로는 통합 월드에 도달할 수 없다.

### 대안과 선택

- 전체 소형 타일맵: 논리는 명확하지만 전이 타일 제작량과 반복 위험이 큼
- 기존 하이브리드: 현재 구조와 호환되지만 근본 한계가 이미 확인됨
- 청크 월드 표면: 현재 큰 고정 레인에 적합하고 향후 culling/다인 레인 확장 가능

1단계는 세 번째를 선택했다. 새 `BattlefieldWorldRenderer`가 월드 전체의 모든
지면 픽셀을 불투명 청크로 소유하고, 도로와 거점 foundation도 맵 명세에서
그린다. `BattlefieldMapSpec.terrainProps`는 나무/바위의 footprint와 occlusion
참여 여부를 명시한다. `world-surface`에서는 두 baked matte 이미지를 모두
숨기며 쿼리 없는 기본 모드도 이 모드다. 기존 progress/laneRow 전투 어댑터와
수치는 변경하지 않았다.

전후 자료는 `artifacts/world-surface/`의 `prototype-v2-*`와
`world-surface-*` 아군/중간/중앙/적군 4쌍이다. 동일 정지 상태의 canonical
gameplay snapshot은 정확히 일치했다.

### 남은 시각 문제와 중단 판단

아키텍처 진전은 분명하지만 현재 3종 `prototype-placeholder-*` 텍스처만으로는
넓은 잔디가 반복되고 도로 전이와 원경 장식 밀도가 부족하다. 이 단계 결과를
완성 아트로 확대하지 않았다. 다음 단계는 구조를 되돌리거나 알파를 조정하는
것이 아니라 전용 청크/경계/원경 아트와 prop 세트를 제작하는 작업이어야 한다.

## 5. 일반 거점과 고정 요새

### 확정 원인

액션 데이터와 실행 로직에는 구멍이 없었다. 고정 요새는 수리/재건 외 건설과
폐기가 차단된다. 인접 거리도 기본 줌 화면 기준 `528.77px`, `445.43px`로
충분했다. 혼동 원인은 동일한 타워 텍스처와 작은 크기 차이였다. 재현 중에는
밀집 유닛의 interactive hit area가 거점 클릭을 가로채는 문제도 확인했다.

### 변경과 검증

- ImageGen으로 넓은 성채, 4개 바스티온, 청록 신호석을 가진 전용
  `fixed-fortress-v1.png` 생성
- 손상 상태도 성채 실루엣을 유지하고 HP 비율에 따라 색만 변경
- 거점마다 시각적으로 투명한 최상단 선택 hit zone을 두어 밀집 전투 중에도 선택
- 실제 캔버스 클릭 후 고정 요새는 `repair-fortress`만, 일반 거점은
  `build-supply-depot`, `build-mint`만 노출됨을 검증

에셋은 Codex 내장 ImageGen으로 생성한 프로젝트 전용 원본이며 외부 게임
자산을 복제하지 않았다. 생성 프롬프트는 "broad squat hexagonal stone
citadel, four short corner bastions, central raised command keep, teal diamond
beacon"을 핵심으로 기존 프로젝트 타워/본진을 화풍 참고 이미지로 사용했다.
크로마키 제거 후 RGBA PNG로 저장했다.

사람 확인 자료:

- `artifacts/capture-point-distinction/fixed-fortress-clicked.png`
- `artifacts/capture-point-distinction/buildable-point-clicked.png`
- `artifacts/capture-point-distinction/interaction-and-distance.json`

## 검증 명령

```bash
npm run build
npm test
npx playwright test tools/validation/support-mana.spec.ts tools/validation/audio-signal.spec.ts tools/validation/unit-direction.spec.ts tools/validation/world-surface.spec.ts tools/validation/capture-point-distinction.spec.ts --workers=1
git diff --check
```

최종 결과:

- `npm run build`: 통과 (`tsc --noEmit`, Vite production build)
- `npm test`: 12개 파일, 58개 테스트 통과
- 신규 Playwright 체감 검증: 5개 모두 통과
- 기존 오디오/전체 레인 Playwright 회귀: 6개 모두 통과
- `git diff --check`: 통과

Vite의 단일 번들 크기 경고(약 1.63 MB)는 기존 구조상 남아 있으며 이번 5개
독립 이슈의 동작 결과에는 영향을 주지 않는다.
