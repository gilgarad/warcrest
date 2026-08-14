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

### 1-1. 배포 전용 키 (pull만 가능)

GitHub 저장소 Settings → Deploy keys → Add deploy key.
**"Allow write access"는 체크하지 않는다** — 104는 읽기만 하면 되고, 쓰기
권한을 주면 프로덕션 서버가 저장소를 되밀 수 있게 된다.

```bash
# 104에서
ssh-keygen -t ed25519 -f ~/.ssh/warcrest_deploy -N "" -C "warcrest-deploy-104"
cat ~/.ssh/warcrest_deploy.pub   # 이 값을 Deploy key로 등록
```

`~/.ssh/config`에 호스트 별칭을 만들어 이 키만 쓰도록 고정한다:

```
Host github-warcrest
  HostName github.com
  User git
  IdentityFile ~/.ssh/warcrest_deploy
  IdentitiesOnly yes
```

### 1-2. 체크아웃

```bash
sudo mkdir -p /data/projects/warcrest
sudo chown gilgarad:gilgarad /data/projects/warcrest
git clone github-warcrest:gilgarad/warcrest.git /data/projects/warcrest
cd /data/projects/warcrest
npm ci --omit=dev --include=dev   # 릴레이는 ws(devDependency)가 필요하다
```

### 1-3. systemd 등록

```bash
sudo cp /data/projects/warcrest/tools/relay/warcrest-relay.service \
        /etc/systemd/system/warcrest-relay.service
sudo systemctl daemon-reload
sudo systemctl enable --now warcrest-relay.service
sudo systemctl status warcrest-relay.service
```

### 1-4. nginx: `wss://` 종단

게임 페이지는 HTTPS(GitHub Pages)로 서빙된다. **HTTPS 페이지는 평문 `ws://`
소켓을 열 수 없다**(브라우저가 mixed content로 차단하며, 원인 안내 없이 연결
실패로만 보인다). 따라서 릴레이는 반드시 `wss://`로 노출해야 한다.

기존 `profitablestock.co.kr` 서버 블록에 추가:

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
cd /data/projects/warcrest
git pull --ff-only
npm ci --omit=dev --include=dev
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

## 알려진 제약

- 릴레이는 매치 상태를 메모리에만 들고 있다. 재시작하면 **진행 중인 대전이
  끊긴다.** 게임 상태는 각 클라이언트가 갖고 있으므로 서버가 데이터를 잃는
  것은 아니지만, 그 판은 이어갈 수 없다.
- 인증이 없다. 대기열에 들어온 순서대로 짝을 짓는다. 공개 배포 시에는
  최소한의 남용 방지(연결 수 제한 등)를 검토해야 한다.
- 친구 초대는 presence/계정 모델이 없어 현재 자동 대기열로 폴백한다.
