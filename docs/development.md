# 개발 가이드

이 문서는 저장소에서 작업할 때 자주 확인하는 규칙만 모았습니다. 상세 아키텍처는 [architecture.md](./architecture.md)를 참고하세요.

## 프로젝트 구조

| 경로 | 역할 |
| --- | --- |
| `sub/web-image-util/` | 배포 대상 패키지 `@cp949/web-image-util` |
| `sub/web-image-util/src/processor.ts` | `processImage()`와 `ImageProcessor` 체이닝 API |
| `sub/web-image-util/src/core/` | 소스 변환, 지연 렌더링, Canvas 렌더링 파이프라인 |
| `sub/web-image-util/src/svg-sanitizer/` | DOMPurify 기반 SVG strict 정화 |
| `sub/web-image-util/tests/` | 라이브러리 단위, 통합, 계약, 보안, 브라우저 테스트 |
| `tests/unit/scripts/` | 루트 운영 스크립트 테스트 |
| `apps/demo/` | Vite + React 기반 학습용 데모 앱 (큐레이션된 6개 데모) |

## 명령어

루트에서 실행합니다.

| 목적 | 명령 |
| --- | --- |
| 빌드 | `pnpm build` |
| 타입체크 | `pnpm typecheck` |
| 린트 | `pnpm lint` |
| 포맷 검사 | `pnpm format:check` |
| 라이브러리 Node 테스트 | `pnpm test:node` |
| 브라우저 테스트 | `pnpm test:browser` |
| 루트 스크립트 테스트 | `pnpm test:scripts` |
| CI 검증 | `pnpm verify:ci` |
| 릴리스 검증 | `pnpm verify:release` |
| 데모 앱 | `pnpm dev:demo` |
| 데모 앱 빌드 | `pnpm build:demo` |

## 작업 규칙

- 런타임 타겟은 브라우저입니다. Node 전용 API는 라이브러리 런타임 경로에 추가하지 않습니다.
- TypeScript strict를 유지합니다.
- 린트와 포맷은 Biome가 담당합니다. ESLint/Prettier 설정을 추가하지 않습니다.
- 소스 주석과 테스트 제목은 한국어로 작성합니다.
- 모듈 최상위에서 전역 패치, 자동 등록, 네트워크 호출 같은 부수효과를 만들지 않습니다.
- 내부 에러는 `ImageProcessError` 또는 에러 헬퍼를 통해 코드 기반으로 다룹니다.
- 새 공개 API는 `package.json` exports와 contract 테스트를 함께 갱신합니다.

## 의존성 관리

### DOMPurify는 dependencies에 둔다

`dompurify`는 `peerDependencies`로 옮기지 않습니다. `@cp949/web-image-util/svg-sanitizer`의
`sanitizeSvgStrict()`가 내부에서 직접 import하는 보안 구현 의존성이며, 호출자가 주입하는
plugin/adapter가 아닙니다.

- DOMPurify 취약점이 발견되면 `@cp949/web-image-util`도 함께 dependency bump, lockfile 갱신, 보안 테스트 검증, 패치 릴리스를 수행합니다.
- peer dependency로 바꾸면 소비자가 DOMPurify 설치와 버전 선택 책임을 갖게 되어, `sanitizeSvgStrict()`의 "설치하면 동작하는 보안 API" 계약이 약해집니다.
- strict sanitizer는 DOMPurify 결과 위에 라이브러리 강제 정책을 후처리로 적용합니다. DOMPurify 버전 변화는 정제 결과에 영향을 줄 수 있으므로 이 패키지의 검증 범위에 포함합니다.
- 기본 SVG 처리 경로는 lightweight이며, strict 경로에서만 DOMPurify 기반 서브패스를 동적으로 로드합니다. 번들 크기 최적화와 dependency 소유권은 별개입니다.

### Node 24.15 이상 및 jsdom 30

- 저장소의 Node 최소 버전은 `24.15.0`입니다. 개발자 환경에서는 Node `24.20.x` 이상을 사용할 수 있습니다.
- `jsdom@30.0.1`을 사용하므로 Node 24.15 이상 환경에서 jsdom+canvas 이미지 처리와 format detection 회귀를 검증합니다.
- Node 24.15 기준 CI 검증은 `pnpm verify:ci`로 수행합니다.

## 테스트 기준

- jsdom 단위 테스트는 타입 계약, 에러 경로, 호출 순서, 순수 계산 검증에 사용합니다.
- 실제 픽셀 품질, MIME fallback, 브라우저별 SVG 렌더링은 `test:browser`로 검증합니다.
- SVG 보안 정책 변경은 `sub/web-image-util/tests/security/`와 `SVG-SECURITY.md`를 함께 갱신합니다.
- 루트 운영 스크립트 테스트는 `tests/unit/scripts/`에 두고 라이브러리 동작 테스트와 섞지 않습니다.
