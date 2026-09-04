# Chrome83 floor-validation 이미지.
#
# 공식 build target(sub/web-image-util/tsdown.config.ts의 target: 'chrome75',
# docs/decisions/ADR-0001-browser-floor-chrome75.md)은 Chrome75다. 이 이미지가
# 실제로 설치하는 건 83인데, Playwright가 page/context 생성 시 무조건 호출하는
# CDP Browser.setDownloadBehavior가 Chrome75/76엔 없고 Chrome82 branch point부터
# 존재하기 때문이다 — Chrome82 미만은 Playwright/CDP가 구조적으로 자동화하지
# 못한다. Debian snapshot 아카이브엔 82.x 빌드가 없어 83.x가 실제 자동 검증이
# 가능한 최소 버전이다. @cp949/inspecta-react의
# packages/inspecta-react/docker/chrome83/Dockerfile이 같은 제약에 먼저 부딪혀
# 검증한 조합(Debian buster-slim + 이 스냅샷 리비전 + 이 Chromium 버전)을 그대로
# 재사용한다 — 새 조합을 골라 새로운 미검증 설치 실패를 만들 이유가 없다.
FROM debian:buster-slim

ARG NODE_VERSION=24.15.0
ARG PNPM_VERSION=11.25.0

RUN set -eux; \
    # 20200712T145349Z(chromium=83.0.4103.116-3)로 고정한다 — 같은 버전의 더
    # 이른 리비전(20200623T204338Z)은 스냅샷 시점 아카이브가 전이 중이었는지
    # libavformat58 의존성이 깨져 apt install이 실패한다(inspecta에서 먼저 확인).
    echo "deb [check-valid-until=no trusted=yes] http://snapshot.debian.org/archive/debian/20200712T145349Z unstable main" > /etc/apt/sources.list; \
    printf 'Acquire::Check-Valid-Until "false";\nAcquire::Retries "5";\n' > /etc/apt/apt.conf.d/99snapshot; \
    apt-get update; \
    # dbus-x11을 먼저 설치해 apt 리졸버가 default-dbus-session-bus 가상 패키지의
    # provider를 systemd 체인(이 스냅샷엔 없음)이 아니라 dbus-x11로 먼저
    # 고정하게 한다 — 순서를 바꾸면 libgtk-3-0이 "not going to be installed"로
    # 걸려 chromium 설치가 막힌다.
    apt-get install -y --no-install-recommends dbus-x11; \
    apt-get install -y --no-install-recommends chromium=83.0.4103.116-3; \
    apt-get install -y --no-install-recommends curl ca-certificates xz-utils; \
    curl -fsSL -o /tmp/node.tar.xz "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz"; \
    mkdir -p /usr/local/lib/nodejs; \
    tar -xJf /tmp/node.tar.xz -C /usr/local/lib/nodejs; \
    rm /tmp/node.tar.xz; \
    export PATH="/usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-x64/bin:${PATH}"; \
    # corepack activate는 pnpm 서명 키가 이 Node 버전 번들 corepack의 키 목록에
    # 없으면 "Cannot find matching keyid"로 실패할 수 있어(키 로테이션 문제)
    # 버전과 무관하게 npm 전역 설치로 이 위험 자체를 피한다.
    npm install -g "pnpm@${PNPM_VERSION}"; \
    rm -rf /var/lib/apt/lists/*

ENV PATH="/usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-x64/bin:${PATH}"
WORKDIR /repo
