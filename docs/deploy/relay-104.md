# PvP 릴레이 배포 (104 서버)

대상: `192.168.200.104` (호스트 `stockpredict`) — public 서비스 서버.

## 왜 릴레이만 별도 서버인가

게임 자체는 정적 파일이라 GitHub Pages가 서빙한다. 릴레이는 **상시 떠 있는
프로세스**라 정적 호스팅으로는 불가능하다. 그래서 배포 대상이 둘로 갈린다:

| 구성 요소 | 위치 | 배포 방식 |
|---|---|---|
| 게임(정적) | GitHub Pages | `master` 푸시 시 자동 |
| PvP 릴레이 | 104 `/data/projects/warcrest` | 아래 절차 |

릴레이는 **게임 규칙을 전혀 모른다**(짝짓기·시드 배정·프레임 중계만 한다).
따라서 게임플레이가 바뀌어도 릴레이를 다시 배포할 필요가 없다. 릴레이를
건드려야 하는 경우는 `tools/relay/` 아래가 바뀌었을 때뿐이다.

## 열어야 할 포트: **없음**

이 배포는 **방화벽에 새 구멍을 내지 않는다.** 실측으로 확인한 현재 상태:

| | 상태 |
|---|---|
| 104:443 (HTTPS) | 이미 열려 있고 `profitablestock.co.kr` 유효 인증서로 서비스 중 |
| 104:8790 (릴레이) | 미사용 — **loopback에만 바인딩**하므로 외부 노출 없음 |

구조는 이렇다:

```
브라우저 --(wss:// 443)--> nginx(104) --(ws:// 127.0.0.1:8790)--> 릴레이
```

nginx가 TLS를 종단하고 릴레이의 유일한 클라이언트다. 릴레이는
`RELAY_HOST=127.0.0.1`로 묶여 있어 호스트 밖에서 닿을 수 없다.

**8790을 외부에 열면 안 된다.** 열면 `wss://` 옆에 암호화 없는 `ws://`
경로가 같은 릴레이로 생긴다.

## 104 서버 고정 규칙 (stock_predict `documents/ENVIRONMENT_META.md`)

- production은 **systemd로만** 운영한다. foreground 실행 금지.
- 104는 소스 작업을 하지 않는다. **배포(pull)와 기동만** 한다.
- 기존 사용 포트와 충돌 금지: `8888`(stock_predict), `18888`, `8010`.
  릴레이는 **8790**을 쓴다.

## 1회 준비

`gilgarad` 계정으로 접속한다. **1-1 ~ 1-3은 root가 필요 없다.**

### 1-1. 체크아웃 (배포 키 불필요)

`gilgarad/warcrest`는 **public 저장소**이므로 HTTPS로 그냥 clone된다.
배포 키를 만들지 않는다 — 만들 이유가 없고, 안 만드는 편이 낫다:
프로덕션 서버에 자격증명을 아예 두지 않게 되고, 공개 저장소의 익명 clone은
본질적으로 읽기 전용이라 "쓰기 권한을 실수로 준다"는 사고가 성립하지 않는다.

`/data/projects`는 이미 `gilgarad` 소유라 `sudo mkdir`도 필요 없다.

```bash
git clone https://github.com/gilgarad/warcrest.git /data/projects/warcrest
```

> 저장소가 나중에 private으로 바뀌면 이 단계만 배포 키 방식으로 되돌린다
> (Settings → Deploy keys, **write access는 체크하지 않는다**).

### 1-2. Node 런타임 (conda, sudo 불필요)

104에는 **시스템 Node가 없고**(`apt`에 후보만 있음) 설치하려면 root가
필요하다. 대신 사용자 영역 conda env를 쓴다 — 104에서 이미 쓰는 방식이고
(`stmarket`, `merchant_empires` env가 같은 자리에 있다) root가 필요 없다.

```bash
~/miniconda3/bin/conda create -y -n warcrest -c conda-forge "nodejs>=22.6"
~/miniconda3/envs/warcrest/bin/node --version
```

`>=22.6`인 이유는 릴레이가 `--experimental-strip-types`로 TypeScript를 직접
실행하기 때문이다. 이 경로가 `warcrest-relay.service`의 `ExecStart`에 그대로
박혀 있으므로, env를 다른 이름/자리에 만들면 유닛 파일도 함께 고쳐야 한다.

### 1-3. 의존성 설치

```bash
export PATH=~/miniconda3/envs/warcrest/bin:$PATH
cd /data/projects/warcrest
npm ci   # 릴레이는 ws(devDependency)가 필요하므로 --omit=dev 를 쓰지 않는다
```

### 1-4. systemd 등록 (root 필요)

```bash
sudo cp /data/projects/warcrest/tools/relay/warcrest-relay.service \
        /etc/systemd/system/warcrest-relay.service
sudo systemctl daemon-reload
sudo systemctl enable --now warcrest-relay.service
sudo systemctl status warcrest-relay.service
```

### 1-5. nginx: `wss://` 종단 (root 필요)

게임 페이지는 HTTPS(GitHub Pages)로 서빙된다. **HTTPS 페이지는 평문 `ws://`
소켓을 열 수 없다**(브라우저가 mixed content로 차단하며, 원인 안내 없이 연결
실패로만 보인다). 따라서 릴레이는 반드시 `wss://`로 노출해야 한다.

대상 파일은 `/etc/nginx/sites-enabled/stock_predict`이고, 넣을 자리는
`server_name profitablestock.co.kr ...` 이면서 `listen 443 ssl`인 블록이다
(같은 파일에 `test.` / `test.autotrade.` 블록이 함께 있으니 주의).

그 블록에는 이미 `location / { proxy_pass http://127.0.0.1:8888; }`가 있다.
아래를 **같은 블록 안에** 추가하면 된다 — nginx는 더 긴 prefix를 먼저 고르므로
`/warcrest-relay` 요청만 릴레이로 가고 나머지는 8888로 그대로 간다.

```nginx
location /warcrest-relay {
    proxy_pass http://127.0.0.1:8790;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;   # 대전 중 유휴 시간에 끊기지 않도록
}
```

`Upgrade`/`Connection` 헤더가 없으면 WebSocket 핸드셰이크가 일반 HTTP로
처리되어 조용히 실패한다. `proxy_read_timeout` 기본값(60s)도 대전 중 끊김의
흔한 원인이다.

반영은 **문법 검사를 통과한 뒤에만** 한다. 이 파일은 운영 중인
`profitablestock.co.kr`을 함께 서빙하므로, 잘못된 설정으로 reload하면 릴레이가
아니라 **본 서비스가 죽는다.**

```bash
sudo cp /etc/nginx/sites-available/stock_predict{,.bak-$(date +%F)}
sudo nginx -t && sudo systemctl reload nginx   # -t 실패 시 reload 하지 않는다
```

## 2. 클라이언트가 릴레이를 찾게 하기

클라이언트는 기본적으로 **접속한 페이지와 같은 오리진**의 `/relay`를 본다.
로컬 개발에서는 맞지만 배포판에서는 GitHub Pages를 가리키게 되므로, 빌드 시
주소를 넣어야 한다.

`.github/workflows/deploy-pages.yml`의 빌드 단계에 추가:

```yaml
- name: Build
  run: npm run build
  env:
    VITE_RELAY_URL: wss://profitablestock.co.kr/warcrest-relay
```

## 3. 갱신 배포

릴레이 코드(`tools/relay/`)가 바뀐 경우에만 필요하다.

```bash
export PATH=~/miniconda3/envs/warcrest/bin:$PATH
cd /data/projects/warcrest
git pull --ff-only
npm ci
sudo systemctl restart warcrest-relay.service
```

## 4. 확인

```bash
# 104에서: 프로세스와 포트
sudo systemctl status warcrest-relay.service
ss -lntp | grep 8790

# 로그 (릴레이는 접속/매칭을 남긴다)
sudo journalctl -u warcrest-relay.service -f
```

브라우저에서 실제 매칭까지 확인하려면 **서로 다른 두 브라우저 프로필/창**에서
게임을 열고 각각 `온라인 대전 → 상대 찾기`를 누른다. 한쪽만 눌렀을 때는
대기 상태로 남아 있는 것이 정상이다(두 명이 모여야 짝이 지어진다).

## 현재 배포 상태 (2026-08-14)

104에서 실제로 확인한 것과 남은 것:

| 단계 | 상태 |
|---|---|
| 1-1 체크아웃 | 완료 — `3c2542b`, 브랜치 `issue-7-pvp-sim-render-split` |
| 1-2 Node | 완료 — conda env `warcrest`, **v26.6.0** (strip-types 동작 확인) |
| 1-3 `npm ci` | 완료 |
| 릴레이 동작 | 완료 — `127.0.0.1:8790` 바인딩, 2인 매칭 전 항목 통과 |
| 1-4 systemd | **미완 (root 필요)** |
| 1-5 nginx | **미완 (root 필요)** |

체크아웃이 `master`가 아니라 브랜치인 것은 PvP PR이 아직 병합 전이기 때문이다.
병합 후에는 `git checkout master && git pull --ff-only`로 돌려놓는다.

104에서 돌린 매칭 검증이 확인한 것: 한 명만 대기 중일 때는 짝지어지지 않음,
두 명이 모이면 **같은 시드 / 반대 진영** 배정, 프레임이 상대에게만 중계됨
(보낸 쪽으로 에코되지 않음), 한쪽이 끊기면 상대에게 통보됨.

## 알려진 제약

- 릴레이는 매치 상태를 메모리에만 들고 있다. 재시작하면 **진행 중인 대전이
  끊긴다.** 게임 상태는 각 클라이언트가 갖고 있으므로 서버가 데이터를 잃는
  것은 아니지만, 그 판은 이어갈 수 없다.
- 인증이 없다. 대기열에 들어온 순서대로 짝을 짓는다. 공개 배포 시에는
  최소한의 남용 방지(연결 수 제한 등)를 검토해야 한다.
- 친구 초대는 presence/계정 모델이 없어 현재 자동 대기열로 폴백한다.
