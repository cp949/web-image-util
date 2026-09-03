# ADR-0001: Chrome 75 브라우저 하한선 정책

## 상태

Accepted

## 배경

- `sub/web-image-util/tsdown.config.ts`가 빌드 타깃을 `chrome75`로 고정한다 — Chrome 75 이상에서 문법적으로 동작하는 산출물을 만드는 것이 목표다.
- Playwright/CDP는 Chrome 82 미만을 구조적으로 자동화할 수 없다(`Browser.setDownloadBehavior`가 Chrome 82부터 존재).
- Debian snapshot 아카이브에는 82.x 빌드가 없어 83.x가 실제 자동 검증이 가능한 최소 버전이다.
- 참고 구현: `@cp949/inspecta-react`가 동일한 문제를 먼저 겪고 같은 결론(Chrome75 빌드 타깃 + Chrome83 Podman 대체 검증)에 도달했다.

## 결정

1. 빌드 타깃(`chrome75`)을 유지한다. `sub/web-image-util/scripts/check-browser-compat.mjs`(런타임 API 감사)와 `check:browser-target`(es-check, dist 문법 감사)이 매 CI에서 회귀를 감시한다.
2. Chrome 75 자동 실행 검증 공백은 고정된 Chrome 83 컨테이너(Podman, Debian buster-slim, `snapshot.debian.org` 스냅샷으로 Chromium 83.0.4103.116-3 고정)로 대신한다. 결과는 "Chrome 83 자동 검증 통과"로만 기록하고 "Chrome 75 실행"으로 표기하지 않는다.
3. Chrome 83(Podman) floor validation은 기본 `verify:ci`/`test:browser`/GitHub Actions 어디에도 연결하지 않는다. 필요할 때 로컬에서 `pnpm --filter @cp949/web-image-util test:browser:chrome83-floor`로 수동 실행한다.
4. Chrome 75~82 구간은 자동 실행 검증 수단이 없다는 사실을 README에 명시한다. 정적 검사(문법·API)만 이 구간을 커버한다.

## 근거

- Playwright/CDP 자동화 한계는 기술적 사실이며 하한선 완화가 아니다.
- Chrome 83 컨테이너를 상시 CI에 연결하면 모든 기여자의 빌드가 느려지고 Podman 미설치 환경에서 실패한다 — 실익보다 비용이 크다.
- `AbortSignal.timeout`/`AbortSignal.any`는 이미 `typeof` 가드로 폴백이 구현되어 있어 Chrome 75 지원을 위한 별도 코드 변경이 필요하지 않았다.

## 영향

- browser floor validation 완료조건은 "Chrome 83(Podman) 자동 검증 통과, opt-in"만 요구한다.
- 신규 코드가 Chrome 75 미만 런타임 API를 가드 없이 추가하면 `check:browser-compat`가 CI에서 실패시킨다. 의도적으로 추가하려면 `sub/web-image-util/browser-compat-allowlist.json`에 등록해야 한다.
- 이 결정은 `@cp949/web-image-util`에 한정된다. `apps/demo`는 대상이 아니다.
