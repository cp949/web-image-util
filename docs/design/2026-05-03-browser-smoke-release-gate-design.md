# browser smoke release gate 설계

## 배경

`test:browser`는 실제 Chromium에서 Canvas, Image, Blob, SVG 렌더링 경로를 확인한다. 이 검증은 Node.js/happy-dom mock 테스트가 보장하지 못하는 실제 브라우저 동작을 다루므로 릴리스 전 신뢰도에 중요하다.

다만 Playwright Chromium 설치, 캐시 상태, CI 실행 환경에 영향을 받을 수 있어 현재 빠른 기본 CI gate인 `verify:ci`에 바로 포함하면 코드 변경과 무관한 실패 가능성이 커진다.

## 결정

루트 `verify:ci`는 빠른 기본 gate로 유지한다. 단, 루트 운영 스크립트 계약을 빠른 gate에서 놓치지 않도록 `test:scripts`를 `verify:ci`의 선행 단계로 둔다. 대신 `verify:release`를 추가해 릴리스 전 필수 검증을 한 명령으로 묶는다.

## 스크립트 계약

루트 scripts에 다음 명령을 추가한다.

```bash
pnpm verify:release
```

이 명령은 `scripts/verify-release.mjs`를 통해 아래 순서로 실행한다. 각 단계는 시작 로그를 출력하고, 실패하면 해당 명령의 exit code로 종료한다.

- `pnpm verify:ci` (`test:scripts` 포함)
- `pnpm --filter @cp949/web-image-util test:browser`
- `cd sub/web-image-util && npm pack --dry-run`

## 문서 계약

- 루트 README와 패키지 README는 `verify:ci`와 `verify:release`의 역할을 구분한다.
- 루트 `scripts/**` 테스트는 `tests/unit/scripts/**`에서 관리하고, 패키지 테스트와 분리한다.
- `CLAUDE.md`는 개발자가 작업 중 빠르게 확인할 gate와 릴리스 전 gate를 혼동하지 않도록 명령 설명을 갱신한다.
- `docs/release-checklist.md`의 배포 전 최소 검증은 `pnpm verify:release` 중심으로 정리한다.

## 비범위

- `test:browser`를 `verify:ci`에 포함하지 않는다.
- coverage gate 정책은 바꾸지 않는다.
- GitHub Actions나 외부 CI 설정은 이번 변경에서 추가하지 않는다.

## 재검토 조건

CI에서 Playwright Chromium 설치와 캐시가 안정화되고 실행 시간이 충분히 예측 가능해지면, `test:browser`를 `verify:ci`에 포함할지 다시 검토한다.
