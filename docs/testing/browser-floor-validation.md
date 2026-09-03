# Chrome 83(Podman) Floor Validation

Chrome 75가 공식 브라우저 하한선이지만 Playwright/CDP가 Chrome 82 미만을 자동화할 수 없어([ADR-0001](../decisions/ADR-0001-browser-floor-chrome75.md)), 고정된 Chrome 83 컨테이너로 대체 검증한다. **기본 `verify:ci`/`test:browser`/GitHub Actions에는 연결되어 있지 않다 — 필요할 때만 로컬에서 수동 실행한다.**

## 사전 요구사항

- [Podman](https://podman.io/) 설치.
- 저장소 루트에서 `pnpm install`, `pnpm --filter @cp949/web-image-util build` 실행 가능한 상태.

## 컨테이너 이미지 빌드

```bash
podman build -t web-image-util-chrome83 -f sub/web-image-util/docker/chrome83/Dockerfile sub/web-image-util
```

## 검증 실행

```bash
podman run --rm -it \
  -v "$(pwd)":/repo:Z \
  -w /repo \
  web-image-util-chrome83 \
  bash -lc "pnpm install --frozen-lockfile && pnpm --filter @cp949/web-image-util test:browser:chrome83-floor"
```

`test:browser:chrome83-floor`는 내부적으로 다음을 수행한다.

1. `pnpm build` — `tsdown.config.ts`의 `target: 'chrome75'`로 `dist/index.js`를 다시 빌드한다.
2. `browser-test-floor/vite.chrome83.config.ts`(`build.target: 'chrome75'`)로 `dist/index.js`를 직접 import하는 fixture를 production build한다.
3. `vite preview`로 정적 서빙하고, `browser-test-floor/playwright.config.ts`의 `chrome83-floor` project(컨테이너 안의 `/usr/bin/chromium`, Chromium 83.0.4103.116-3)로 `browser-test-floor/chrome83-floor.spec.ts`를 실행한다.

## 결과 해석

- **통과 = "Chrome 83 자동 검증 통과"** 다. "Chrome 75 실행"을 의미하지 않는다 — Chrome 75/76에는 CDP `Browser.setDownloadBehavior`가 없어 Playwright가 애초에 이 버전들을 구동하지 못한다.
- Chrome 75~82 구간은 이 방법으로도 검증되지 않는다. `check:browser-target`(es-check, dist 문법 감사)과 `check:browser-compat`(런타임 API 정적 감사) 두 정적 검사만 이 구간을 커버하며, 이 둘은 매 CI에서 자동 실행된다.

## 이 검증을 CI에 연결하지 않는 이유

Podman 컨테이너 실행은 모든 기여자·CI 환경에 상시 요구하기엔 비용이 크고(이미지 빌드 시간, Podman 설치 요구), opt-in으로 유지하기로 결정했다([ADR-0001](../decisions/ADR-0001-browser-floor-chrome75.md) 참고). 메이저·마이너 릴리스 전 실행을 권장한다([release-checklist.md](../release-checklist.md)).
