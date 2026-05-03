# @cp949/web-image-util

> 웹 브라우저를 위한 이미지 처리 라이브러리 모노레포입니다.

Canvas 2D API를 기반으로 리사이즈, SVG 처리, 포맷 변환 기능을 제공합니다. 저장소는 메인 라이브러리와 예제 앱, 공용 설정 패키지로 구성되어 있습니다.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## 소개

이 저장소의 중심은 `@cp949/web-image-util` 패키지입니다. 브라우저 환경에서 이미지를 다루는 작업을 체이닝 API로 구성할 수 있고, SVG 입력 처리와 여러 출력 포맷 변환을 함께 제공합니다.

루트 README는 저장소 전체를 소개하는 문서이고, 실제 라이브러리 사용법과 API는 [sub/web-image-util/README.md](sub/web-image-util/README.md)에 정리되어 있습니다.

## 주요 특징

- 체이닝 API 기반 이미지 처리
- TypeScript 타입 지원
- 브라우저 네이티브 API 기반 구현
- SVG 입력 감지와 렌더링 지원
- SVG sanitizer 정책 선택 지원
- 이미지 치수, 입력 포맷, 투명도, 소스 타입 조회 유틸리티
- Data URL 변환과 출력 포맷/파일명 계산 유틸리티
- WebP, JPEG, PNG 출력 지원
- ES 모듈 기반 트리 셰이킹 지원

## 설치

```bash
npm install @cp949/web-image-util
```

## 빠른 시작

```typescript
import { processImage } from '@cp949/web-image-util';

const thumbnail = await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .toBlob({ format: 'webp', quality: 0.8 });

const banner = await processImage(source)
  .resize({ fit: 'cover', width: 1200, height: 400, background: '#ffffff' })
  .blur(2)
  .toBlob({ format: 'jpeg', quality: 0.85 });
```

더 자세한 예제와 API 설명은 [sub/web-image-util/README.md](sub/web-image-util/README.md)를 참고하세요.

SVG sanitizer 옵션별 보안 범위는 [SVG-SECURITY.md](SVG-SECURITY.md)에 별도로 정리되어 있습니다.

## LLM 지원

배포되는 패키지에는 `llm.txt` 파일이 함께 포함됩니다.

이 파일은 AI 도구가 라이브러리의 공개 API, 사용 패턴, 제약 사항을 이해하는 데 참고할 수 있는 문서입니다.

## 저장소 구성

이 저장소는 `Turbo`와 `pnpm workspaces`를 사용하는 모노레포입니다.

- `sub/web-image-util/`: 메인 라이브러리 패키지
- `sub/typescript-config/`: 공용 TypeScript 설정
- `apps/exam/`: Next.js 기반 예제 앱

## 예제 앱

`apps/exam/`에는 라이브러리 기능을 확인할 수 있는 예제 앱이 포함되어 있습니다.

```bash
pnpm install
pnpm dev:exam
```

실행 후 `http://localhost:3000`에서 확인할 수 있습니다.

## 개발 명령어

| 목적 | 명령 |
| --- | --- |
| 배포 패키지 빌드 | `pnpm build` |
| 빌드 watch | `pnpm build:watch` 또는 `pnpm dev` |
| 예제 앱 실행 | `pnpm dev:exam` |
| 타입체크 | `pnpm typecheck` |
| lint / 자동 수정 | `pnpm lint` / `pnpm lint:fix` |
| format / 검사 | `pnpm format` / `pnpm format:check` |
| 테스트 | `pnpm test` |
| 루트 운영 스크립트 테스트 | `pnpm test:scripts` |
| 브라우저 테스트 | `pnpm test:browser` |
| 커버리지 | `pnpm test:coverage` |
| CI 검증 | `pnpm verify:ci` |
| 릴리스 검증 | `pnpm verify:release` |
| npm 배포 | `pnpm publish:npm` |

`pnpm test:scripts`는 루트 운영 스크립트 테스트를 실행합니다. 루트 스크립트 테스트는 `tests/unit/scripts/**`에 두고, 패키지 라이브러리 테스트는 `sub/web-image-util/tests/**`에서 관리합니다. `pnpm verify:ci`는 `test:scripts`를 먼저 실행한 뒤 Turbo 기반 타입체크, lint, format 검사, Node 테스트, 계약 테스트를 실행합니다.

## 배포

npm 배포는 루트에서 다음 스크립트로 실행합니다.

```bash
pnpm publish:npm
```

이 스크립트는 `@cp949/web-image-util` 패키지를 빌드한 뒤 `npm publish --access=public`을 실행합니다.

배포 전에는 `pnpm verify:release`를 실행하고, [Release Checklist](docs/release-checklist.md)를 따라 문서, 스크립트, 배포 산출물이 실제 코드와 같은지 확인합니다.

## 문서

- [라이브러리 문서](sub/web-image-util/README.md)
- [예제 앱 문서](apps/exam/README.md)
- [릴리스 체크리스트](docs/release-checklist.md)
- [llm.txt 운영 가이드](docs/llm-txt.md)
- [설계 결정 기록](docs/design/README.md)
- [프로젝트 가이드](CLAUDE.md)

## 라이선스

MIT License

## 링크

- [npm 패키지](https://www.npmjs.com/package/@cp949/web-image-util)
- [GitHub 저장소](https://github.com/cp949/web-image-util)
- [이슈](https://github.com/cp949/web-image-util/issues)
- [릴리스](https://github.com/cp949/web-image-util/releases)
