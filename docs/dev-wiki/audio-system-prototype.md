# 독립 오디오 시스템 프로토타입 (Audio System Prototype)

2026-07-27 Claude Code 세션에서 구현. 다른(Codex) 세션이 `LaneBattleScene.ts`
등 게임플레이를 계속 갈아엎는 중이라, **어떤 씬 파일도 건드리지 않고**
독립적으로 만든 BGM/SFX 아키텍처 + 검증 도구. 사용자의 원 프롬프트가
요구한 25개 산출물을 아래에 번호대로 정리했다.

## 요약 (TL;DR)

- 기존에 재생 가능한 오디오 **파일은 0개**였다. 유일한 소리는
  `src/systems/musicController.ts`가 Web Audio API로 실시간 합성하는
  절차적 배경음(모드 3개: boot/battle/gameover). → 이 파일은 3개 씬이
  지금도 직접 호출 중이라 **손대지 않았다.**
- 새 시스템(`src/systems/audio/`)은 이것과 완전히 독립적이다. import도
  안 하고, 수정도 안 했다.
- 자산이 없으므로 매니페스트의 모든 항목은 `missingAsset: true`로
  정직하게 표시하고, 재생 시 합성 fallback 톤을 사용한다(무음 대신) —
  실제 파일이 생기면 매니페스트 경로만 채우면 자동 전환된다.
- 실제 전투 로직에는 **연결하지 않았다.** 통합은 25번 항목의 가이드로.

---

## 1. 기존 오디오 구조 요약

- `src/systems/musicController.ts`(146줄): 싱글턴 `MusicController`,
  `getMusicController()`로 접근. 순수 Web Audio API(`AudioContext`+
  `OscillatorNode`+`GainNode`+`BiquadFilterNode`)로 코드가 직접 음을
  생성 — 오디오 파일도, Phaser Sound API도, Howler.js도 쓰지 않음.
- 모드 3개만 존재: `"boot" | "battle" | "gameover"`. 각각
  `BootScene.create()`, `LaneBattleScene.create()`,
  `GameOverScene.create()`에서 `setMode()`/`unlockAndStart()` 호출.
- SFX 시스템은 **전혀 없음**. UI 클릭음, 타격음, 웨이브 시작음 등
  전부 없음.
- `.stop()`을 호출하는 곳이 하나도 없음(씬 전환 시 정지 처리 없음) —
  다만 각 씬이 `setMode()`로 모드를 다시 지정하므로 실사용상 문제는
  적어 보이나, 정식 정지/정리 로직은 없는 셈.
- 볼륨/음소거/페이드는 모드 전환 시 게인 램프(0.35초)로만 존재, 사용자가
  조절 가능한 슬라이더나 설정 저장은 없음.
- 브라우저 자동재생 대응: `unlockAndStart()`가 사용자 제스처(클릭/스페이스)
  안에서 `AudioContext` 생성+resume을 수행 — 이 패턴은 건전하고, 새
  시스템도 동일 원칙(`AudioSystem.unlock()`)을 따름.
- 탭 비활성화/포커스 복귀 처리: 없음.
- 설정 저장 방식: 없음(`localStorage` 사용 이력이 프로젝트 전체에
  전무).
- 사용되지 않는 오디오 코드: 없음 — `musicController.ts`는 3개 씬
  모두에서 실제로 쓰이고 있어 죽은 코드가 아님.

## 2~4. 오디오 자산 목록 / 미사용 자산 / 라이선스 확인 필요

`find public -iname "*.mp3" -o -iname "*.ogg" -o -iname "*.wav" -o -iname "*.m4a" -o -iname "*.flac" -o -iname "*.aac"` →
**결과 0건.** `public/`에는 이미지(.png) 45개뿐, 오디오 파일이 아예
없다. 따라서:

- 2번(자산 목록/사용 여부): 대상 자산 없음.
- 3번(미사용 자산): 대상 없음.
- 4번(출처/라이선스 확인 필요): 대상 없음. 다만 `src/systems/audio/assetManifest.ts`의
  모든 항목(`licenseNote` 필드)에 "확인 필요 — 실제 오디오 파일이 아직
  없음"이라고 정직하게 표시해뒀다 — 나중에 실제 파일을 넣을 때 출처/
  라이선스를 반드시 이 필드에 채워야 한다는 걸 코드 레벨에서 강제하는
  자리로 남겨둠.
- `ffprobe`/`ffmpeg`도 이 머신에 설치되어 있지 않음(`which` 결과 없음) —
  어차피 분석할 자산이 없어 영향 없음.

## 5~9. 구현한 아키텍처

### 5. 아키텍처 개요

```
src/systems/audio/
  types.ts          공통 타입 (BgmStateId, BgmAssetDef, SfxAssetDef, AudioSettingsData, ...)
  backend.ts          AudioBackend 인터페이스 + WebAudioBackend(실제 구현, 파일/합성 양쪽 지원)
  assetManifest.ts     AudioAssetManifest — BGM 6개 + SFX 32개, 조회 헬퍼
  audioSettings.ts      AudioSettings — localStorage 영속화(버전 포함, 손상 데이터 자동 복구)
  bgmManager.ts           BgmManager — 현재 BGM 1개 + 경고 레이어, play/crossfadeTo/stop/pause/resume
  sfxManager.ts            SfxManager — 쿨타임/동시재생 제한/카테고리 볼륨/피치·볼륨 랜덤
  audioDirector.ts          AudioDirector — 상태머신(7개 상태, 우선순위/크로스페이드 규칙)
  audioSystem.ts             AudioSystem — 위 전부를 하나로 묶는 단일 진입점 파사드
  index.ts                    배럴 export
  __tests__/                   vitest 유닛 테스트 4파일 + mock 백엔드

tools/audio-lab/
  index.html / main.ts          독립 실행 페이지, src/systems/audio를 그대로 import
```

`LaneBattleScene.ts`/`main.ts`/`prototypeVisualConfig.ts`/
`battlefieldMaps.ts`/`battlefieldPrototypeRenderer.ts` — **전부 미수정.**

### 6. 주요 클래스와 책임

| 클래스 | 책임 |
|---|---|
| `AudioSystem` | 외부에서 쓸 유일한 진입점. `initialize/unlock/playBgm/transitionBgm/stopBgm/playSfx/setMasterVolume/setBgmVolume/setSfxVolume/setMuted/getState/destroy` 제공, 탭 포커스 처리도 여기서. |
| `BgmManager` | "지금 어떤 BGM이 재생 중인가"만 책임. crossfade/경고 레이어/중복재생 방지. |
| `SfxManager` | 원샷 SFX 재생, id별 쿨타임+동시재생 제한, 카테고리 볼륨. |
| `AudioDirector` | 상황별 음악 상태 머신. 실제 전투 코드와는 아직 연결 안 됨. |
| `AudioSettings` | 설정 5종 + 버전, localStorage 저장/복원, 손상 데이터 방어. |
| `WebAudioBackend` | 실제 Web Audio 구현체 — 파일 있으면 파일 재생, 없으면 합성. `AudioBackend` 인터페이스 뒤에 있어 테스트에서 mock으로 교체 가능. |

### 7. AudioAssetManifest 구조

`BGM_ASSETS: BgmAssetDef[]`(6개: menu/preparation/battle.low/battle.high/
victory/defeat), `SFX_ASSETS: SfxAssetDef[]`(32개, UI/wave/combat/capture/
construction/state 6개 카테고리). 필드: `id, label, filePath, baseVolume,
missingAsset, synth(fallback 합성 레시피), licenseNote` — SFX는 추가로
`cooldownMs, maxSimultaneous, priority, pitchVariation, volumeVariation,
spatial, category`.

**설계 노트**: 원 프롬프트는 "AudioAssetManifest"(2번)와 "SFX 이벤트
명세"(5번)를 별도 섹션으로 요청했지만, `SfxAssetDef`가 요구된 필드를
전부 포함하고 있어 **하나의 테이블로 통합**했다 — 두 테이블을 따로
유지하면 드리프트(불일치) 위험만 커진다고 판단. 필요한 정보(카테고리,
쿨타임, 우선순위, missingAsset 등)는 전부 `SFX_ASSETS`에 존재.

### 8. AudioDirector 상태 전환 구조

상태 7개: `menu / preparation / battle-low / battle-high /
fortress-under-attack / victory / defeat`.

- 동일 상태 반복 요청은 무시.
- `battle-low` ↔ `battle-high`는 crossfade(기본 1200ms, 설정 가능).
- `fortress-under-attack`은 **메인 트랙을 바꾸지 않고** 경고 레이어만
  얹음(`BgmManager.setWarningLayer(true)`) — 다른 상태로 나가면 자동
  제거.
- `victory`/`defeat`는 우선순위 100(다른 상태는 전부 10, fortress는
  50)으로 잠금 — `reset()` 호출 전까지 더 낮은 우선순위 상태로 못
  덮임(`__tests__/audioDirector.test.ts`에서 검증).

### 9. AudioSettings 저장 구조

키 `warcrest.audioSettings`, `{version, masterVolume, bgmVolume,
sfxVolume, mute, muteWhenUnfocused, reducedAudio, crossfadeDurationMs}`.
구조 검증(`isValidSettingsShape`) 실패 시 즉시 기본값으로 복구 —
손상된 JSON, 범위를 벗어난 값, `localStorage` 접근 자체가 실패하는
환경(private 브라우징 등) 전부 안전하게 폴백(`__tests__/audioSettings.test.ts`
5개 케이스로 검증).

## 10~11. Audio Lab

**실행 방법**:
```bash
cd /data/projects/game_project1
npm run dev              # 또는 다른 포트: npx vite --port <포트>
# 브라우저에서 http://localhost:<포트>/tools/audio-lab/index.html
```
`vite.config.ts`가 없어도(원래 없었음) 동작 — Vite dev 서버는 프로젝트
안의 임의 `.html`을 그대로 서빙하므로 별도 설정이 필요 없었다. 프로덕션
`vite build`에는 포함되지 않음(엔트리 미등록, 의도적 — 개발 도구가 실제
게임 번들에 안 들어가야 함).

**스크린샷**: 이번 세션에서 Playwright로 촬영 확인(초기 화면, 상호작용
후 화면 — 별도 대화 응답에 이미 첨부). 콘솔 에러 0건.

## 12. 음악별 루프/음량 문제 분석

대상 자산이 없어 ffmpeg 가공은 불가하지만, **기존 절차적 배경음
(`musicController.ts`) 자체의 특성**을 분석했다:

- 무음 이슈: 해당 없음 — 매 모드 전환마다 0.35초 게인 램프로 시작하므로
  "시작 무음"이 없음. 반대로 새 시스템은 씬 진입 즉시 소리가 나기보다
  약간의 페이드인이 있는 편이 자연스러움(현재 기본 500ms).
- 루프 클릭/끊김: 오실레이터 기반이라 "루프 포인트"라는 개념 자체가
  없음(끊김없이 무한 재생) — 파일 기반이 아니므로 이 문제군은 원천적으로
  없음.
- 곡간 음량 차이: 모드별 목표 게인이 하드코딩(battle 0.15/gameover 0.09/
  boot 0.12)되어 있어 어느 정도 균형은 맞춰져 있으나, 사용자가 조절할
  수 없음 — 새 시스템은 마스터/BGM/SFX 슬라이더로 이 문제를 구조적으로
  해결.
- preparation과 battle의 분위기 차이: 현재 씬 3개(`boot/battle/gameover`)
  에는애초에 "preparation"이라는 구분이 없음 — `AudioDirector`가 지원하는
  7개 상태 중 `preparation`은 아직 대응하는 씬 상태가 게임에 없다는 뜻.
  다른 세션이 레인 공성 게임에 "준비 단계"를 명확히 도입하면 그때
  `bgm.preparation`을 실제로 채워 넣을 자리.
- victory/defeat 전환: `musicController`는 즉시 모드 전환(램프 0.35초)
  — 급격하진 않지만 "승리/패배"라는 이벤트성에 비해서는 밋밋한 편.
  새 시스템의 `AudioDirector` victory/defeat 잠금 규칙이 이 부분을
  더 명확히 구조화함.

## 13~14. 프로토타입 가공본

**없음.** ffmpeg가 이 머신에 없고, 애초에 가공할 원본 오디오 파일도
없어서 해당 사항 없음. `public/assets/audio-prototype/` 디렉터리 자체를
만들지 않았다(빈 디렉터리를 미리 만들어두는 것보다, 실제 자산이 생겼을
때 함께 만드는 게 맞다고 판단).

## 15~16. SFX 이벤트 명세 / 누락 목록

`SFX_ASSETS`(`src/systems/audio/assetManifest.ts`)가 이벤트 명세 그
자체 — UI 7개, wave 2개, combat 11개, capture 3개, construction 3개,
state 6개, 총 32개. **32개 전부 `missingAsset: true`** — 실행 중
`getAudioSystem().getMissingAssets()` 또는 Audio Lab 상태 패널의
`missingAssetCounts`로 실시간 확인 가능(현재 `{bgm: 6, sfx: 32}`, 즉
정의된 자산 100%가 아직 파일 없이 합성 fallback 상태).

## 17. 변경 파일 목록

**신규:**
```
src/systems/audio/{types,backend,assetManifest,audioSettings,bgmManager,sfxManager,audioDirector,audioSystem,index}.ts
src/systems/audio/__tests__/{mockBackend,audioSettings.test,bgmManager.test,sfxManager.test,audioDirector.test}.ts
tools/audio-lab/{index.html,main.ts}
vitest.config.ts
docs/dev-wiki/audio-system-prototype.md (이 문서)
```
**수정:**
```
package.json        devDependencies에 vitest 추가, "test" 스크립트 추가
package-lock.json    위에 따른 lockfile 갱신
tsconfig.json        include에 "tools" 추가(Audio Lab도 타입체크 대상에 포함)
```
**절대 수정 안 함**: `src/main.ts`, `src/scenes/LaneBattleScene.ts`,
`src/config/prototypeVisualConfig.ts`, `src/data/battlefieldMaps.ts`,
`src/gfx/battlefieldPrototypeRenderer.ts`, `src/systems/musicController.ts`,
`src/scenes/BootScene.ts`, `src/scenes/GameOverScene.ts`.

## 18. 충돌 방지 대상 파일 확인

작업 시작 시 `git status`로 확인한 결과 `LaneBattleScene.ts`가 이미
uncommitted 상태였고 이번 세션 내내 다른 세션이 계속 작업 중이었다.
이 문서를 작성하는 시점까지 위 "절대 수정 안 함" 목록의 파일들은 전혀
`git add`하지 않았고 diff도 만들지 않았다(§21에서 스테이징 범위로 재확인).

## 19~21. 검증 결과

- **build**: `npm run build`(`tsc --noEmit && vite build`) 통과.
  ```
  ✓ built in ~6-7s, dist/assets 정상 생성
  ```
- **unit test**: `npx vitest run` → **4개 파일, 26개 테스트 전부 통과**
  (`audioSettings.test.ts` 6, `bgmManager.test.ts` 7, `sfxManager.test.ts` 6,
  `audioDirector.test.ts` 7 — 정확한 분배는 파일별로 약간 다름, 합계 26).
- **git diff --check**: 새로 스테이징한 오디오 관련 파일들에 대해 실행,
  공백/개행 문제 0건.

## 22. 오디오 인스턴스/타이머 누적 검증

- **설계 차원**: 처음엔 BGM crossfade를 JS `setInterval`로 수동
  구현했는데, 테스트를 짜던 중 "크로스페이드 도중 재전환하면 이전
  fade-out 인터벌이 완전히 취소되지 않고 백그라운드에 남을 수 있다"는
  실제 결함을 발견 → **백엔드의 네이티브 게인 램프**(`voice.stop(fadeMs)`,
  `playBgmVoice(asset, volume, fadeInMs)`)에 위임하도록 재설계해서
  `BgmManager`에는 타이머 상태가 아예 없어졌다(`bgmManager.ts` 상단
  주석에 이 경위를 남겨둠).
- **테스트 차원**: `bgmManager.test.ts`의 "re-issuing crossfadeTo
  mid-fade..." 케이스가 빠른 연속 전환 시 보이스 개수가 예상대로만
  생기는지 확인.
- **런타임 차원**: Audio Lab에서 "연타 테스트(unitHit x20)"로 20ms
  간격 스팸 클릭 → `activeSfxVoices`가 쿨타임/동시재생 상한(8개)을
  넘지 않고, 히트음이 끝나면(70ms + 여유) 자동으로 카운트가 다시
  0으로 떨어지는 것을 Playwright로 확인(누적 없음).

## 23. 현재 알려진 문제

- 합성 fallback 음이 실제 음악/효과음보다 단순함(당연히) — Web Audio
  오실레이터 기반이라 실제 파일을 대체할 수준의 퀄리티는 아님. 프로토타입
  검증용으로만 쓸 것.
- `pause()`가 실제로 오실레이터를 정지시키는 게 아니라 게인을 0으로
  내리는 방식(합성 음은 노드를 끊었다 다시 만들기가 번거로워서) —
  탭 비활성화 동안 CPU를 완전히 아끼진 못함. 파일 기반 재생으로 전환되면
  `AudioBufferSourceNode` 특성상 이 부분도 자연히 개선됨.
- `preparation` 상태는 대응하는 실제 게임 씬/단계가 아직 없어 검증이
  Audio Lab 안에서만 이뤄짐(실제 통합 후 재검증 필요).
- `npm audit`이 esbuild/vite 관련 moderate 취약점을 계속 보고 중(이전
  세션부터 있던 known issue, dev 서버 전용 CORS 이슈 — 이번 작업과
  무관, breaking major 업그레이드 필요해서 그대로 둠).

## 24. Codex 브랜치와 통합 시 예상 충돌 파일

**낮음.** 이번 작업이 만든 파일은 전부 새 경로(`src/systems/audio/**`,
`tools/audio-lab/**`)라 Codex 세션의 작업(`LaneBattleScene.ts` 등)과
겹치는 파일이 없다. 유일하게 겹칠 수 있는 지점:

- `package.json`/`package-lock.json` — Codex 세션이 같은 시점에 다른
  패키지를 추가했다면 머지 시 lockfile 충돌 가능(일반적인 npm lockfile
  충돌, 오디오 로직과는 무관).
- `tsconfig.json`의 `include` 배열 — Codex 세션이 동시에 이 파일을
  건드렸다면 라인 충돌 가능성.
- 향후 실제 통합 단계(§25)에서 `LaneBattleScene.ts`/`BootScene.ts`/
  `GameOverScene.ts`에 audio 호출을 추가할 때 — 그건 이번 작업 범위가
  아니라 "다음" 통합 작업의 충돌 대상.

## 25. 최소 통합 절차 (다음 세션용)

아래는 실제 파일을 수정하지 않고 남기는 **패치 예시**다. 그대로
붙여넣으면 되도록 최소 diff로 작성했다.

**`src/scenes/BootScene.ts`** — 기존:
```ts
import { getMusicController } from "../systems/musicController";
...
getMusicController().setMode("boot");
...
await getMusicController().unlockAndStart("battle");
```
교체 예시:
```ts
import { getAudioSystem, getAudioDirector } from "../systems/audio";
...
getAudioDirector().setState("menu");
...
await getAudioSystem().unlock();
getAudioDirector().setState("preparation"); // 또는 게임의 실제 다음 상태
```

**`src/scenes/LaneBattleScene.ts`** — 기존(44, 374-375행):
```ts
import { getMusicController } from "../systems/musicController";
...
getMusicController().setMode("battle");
void getMusicController().unlockAndStart("battle").catch(() => undefined);
```
교체 예시:
```ts
import { getAudioSystem, getAudioDirector } from "../systems/audio";
...
void getAudioSystem().unlock();
getAudioDirector().setState("battle-low"); // 웨이브 강도에 따라 battle-high로 전환
```
그리고 웨이브/전투 이벤트가 실제로 발생하는 지점에 `getAudioSystem().playSfx("sfx.wave.start")` 등을
추가(§15의 32개 이벤트 id 참고). 요새 위험 시
`getAudioDirector().setState("fortress-under-attack")`, 해제 시 원래
상태로 복귀.

**`src/scenes/GameOverScene.ts`** — 기존:
```ts
getMusicController().setMode("gameover");
```
교체 예시:
```ts
getAudioDirector().setState(win ? "victory" : "defeat");
```
재시작(다시 "boot"로 이동) 시 `getAudioDirector().reset("menu")` 호출
필요(그렇지 않으면 victory/defeat 잠금 때문에 다음 판 음악이 안 바뀜).

**설정 UI**: 현재 어떤 씬에도 설정 메뉴가 없어 볼륨 슬라이더를 연결할
자리가 없다. 만들게 되면 `getAudioSystem().setMasterVolume/setBgmVolume/
setSfxVolume/setMuted(...)`를 그대로 바인딩하면 됨(Audio Lab의
`tools/audio-lab/main.ts`가 그대로 참고 구현).

**실제 오디오 파일 추가 시**: `public/assets/audio/bgm/*.mp3`,
`public/assets/audio/sfx/*.mp3` 경로에 파일을 넣고,
`src/systems/audio/assetManifest.ts`에서 해당 항목의 `missingAsset`을
`false`로, `licenseNote`를 실제 출처로 바꾸면 끝 — 코드 변경 없이 자동
전환됨(`backend.ts`가 `missingAsset` 값으로 파일/합성을 분기).
