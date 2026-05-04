# Changelog

이 파일은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식을 따르며, 이 프로젝트는 [Semantic Versioning](https://semver.org/lang/ko/)을 사용합니다.

## [Unreleased]

### 변경

- `ImageProcessError` 시그니처가 `(message, code, options?: { cause, details })`로 변경되었습니다. 기존 `originalError` 위치 인자는 제거되고 표준 `error.cause` 필드로 대체됩니다.
- `ImageProcessError`와 `ImageErrorCode`의 런타임 정의를 경량 모듈 `src/errors.ts`로 분리했습니다. svg-sanitizer 서브패스는 이 경량 모듈을 사용합니다.
- 모든 라이브러리 throw 메시지를 영어로 통일했습니다. 메시지 텍스트로 분기하던 코드는 `error.code`로 마이그레이션해야 합니다.
- SVG 위험 요소 차단, URL 검증 실패, 크기 초과 등은 `error.details` 객체에 구조화된 컨텍스트(`reason`, `url`, `actualBytes`, `maxBytes` 등)를 함께 노출합니다.

### 제거

- `ImageProcessError`의 `originalError` 필드와 `suggestions[]` 필드.
- `ImageSourceError`, `ImageConversionError`, `ImageCanvasError`, `ImageResizeError` 서브클래스. `ImageProcessError + code`로 대체합니다.
- `utils/data-url`의 `INVALID_DATA_URL_MESSAGE`/`INVALID_SVG_DATA_URL_MESSAGE` 문자열 상수 export.

### 추가

- 새 에러 코드: `OPTION_INVALID`, `SVG_INPUT_INVALID`, `SVG_DOMPURIFY_INIT_FAILED`, `SVG_NODE_COUNT_EXCEEDED`, `SVG_BYTES_EXCEEDED`, `INVALID_DATA_URL`, `INVALID_SVG_DATA_URL`.
- `ImageProcessError` 옵션 객체의 `details` 필드와 `ImageProcessErrorOptions`, `ImageErrorDetails`, `ImageErrorDetailsByCode` 타입 export.

## [2.0.36]

### 변경

- SVG sanitizer가 안전한 embedded `data:image/*` 참조를 보존하도록 정책을 보강합니다.
- `data:image/svg+xml` 참조는 nested SVG를 재정제한 canonical base64 Data URL만 허용하도록 정리합니다.

### 수정

- Fabric.js 등에서 만든 SVG의 정상 embedded image가 sanitizer 이후 사라질 수 있는 문제를 수정합니다.
- embedded Data URL의 크기 한도와 nested SVG 깊이 한도 회귀 테스트를 보강합니다.

## [2.0.35]

### 추가

- Canvas Pool의 최대 보관 크기와 브라우저 포맷 지원 캐시를 공개 API에서 조회할 수 있도록 보강합니다.

### 변경

- 브라우저 포맷 지원 판정을 메모이제이션해 반복 변환 시 불필요한 Canvas 생성 비용을 줄입니다.
- `HTMLImageElement` 로딩 핸들러 정리 흐름을 통합해 성공/실패 경로의 이벤트 핸들러 해제를 더 일관되게 처리합니다.

### 수정

- fetch 폴백 경로에서 타이머가 남을 수 있는 문제를 수정합니다.
- SVG CSS escape 우회 페이로드와 unquoted `url(...)` 파싱 경계를 보강합니다.
- `toBlob()` 콜백 내부에서 예외가 발생해도 내부 Canvas가 Canvas Pool에 반환되도록 보장합니다.

## [2.0.34]

### 추가

- 호스트 앱이 입력을 사전 검사할 수 있도록 세 가지 공개 유틸리티 API를 추가합니다.
  - `estimateDataURLPayloadByteLength()`: Data URL payload를 디코딩하지 않고 byte 크기만 추정합니다. `invalid: 'null'` 옵션으로 malformed 입력에서 throw 대신 `null`을 받을 수 있습니다.
  - `decodeSvgDataURL()`: SVG Data URL을 동기적으로 UTF-8 text로 decode합니다. sanitizer/DOMParser는 호출 측 정책에 위임합니다.
  - `fetchImageSourceBlob()`: URL을 fetch만 수행해 Blob과 응답 메타데이터를 반환합니다. `allowedProtocols`, `maxBytes`, `timeoutMs`, `abortSignal`을 모두 결합 지원합니다.
- 새 에러 코드 `SOURCE_BYTES_EXCEEDED`를 추가합니다. `Content-Length` 사전 거부와 stream 누적 byte 초과 시 reader.cancel()이 모두 적용됩니다.

### 변경

- 신규 API의 한글 JSDoc과 README 사용 예시를 보강합니다.

## [2.0.33]

### 추가

- `processImage(source, { svgSanitizer })` 옵션을 추가해 SVG 입력에만 `lightweight`, `strict`, `skip` 정책을 선택 적용할 수 있습니다.
- 신뢰할 수 없는 SVG는 source 타입을 직접 분기하지 않고 `svgSanitizer: 'strict'`로 DOMPurify 기반 strict 정제를 opt-in할 수 있습니다.

### 변경

- SVG 문자열, Data URL, URL 응답, Blob/File, Blob URL, ArrayBuffer/Uint8Array 입력별 strict 정책 테스트를 보강합니다.

## [2.0.32]

### 변경

- 이미지 포맷 조회 API를 로컬 판정용 `getImageFormat()`과 네트워크 응답 스니핑용 `fetchImageFormat()`으로 명확히 분리합니다.
- `fetchImageFormat()`을 루트와 `@cp949/web-image-util/utils` 공개 API, README, `llm.txt` 생성 목록에 반영합니다.
- URL/body 스니핑 경계와 Content-Type fallback 테스트를 보강해 배포 전 검증 범위를 넓힙니다.
- `FilterPlugin`/`FilterOptions`의 기본 파라미터 타입은 `unknown`이며, 기본 필터 모음은 범용 호출용으로 넓게 노출하고 개별 플러그인 export에서 정밀한 파라미터 타입을 보존합니다.

### 호환성 깨지는 변경

- 공개 타입의 `any`를 줄여 출력 포맷, 파일명, 필터 플러그인 파라미터를 더 엄격하게 검사합니다. 느슨한 `any`에 기대던 소비자 코드는 새 타입 오류가 발생할 수 있습니다.

## [2.0.31]

### 변경

- README.md의 배포 준비 버전을 최신 패치 버전으로 정리합니다.
- 배포 전 패키징 검증 대상에 `llm.txt`와 새 유틸리티 API 문서가 포함되도록 릴리스 문서를 유지합니다.

## [2.0.30]

### 추가

- `detectImageSourceType()`, `detectImageSourceInfo()` 등 원격 로드 없이 입력 형태를 판정하는 소스 감지 유틸리티를 추가합니다.

### 변경

- 이미지 포맷, Data URL, 이미지 정보, 투명도 검사 유틸리티를 공개 API와 문서에 정리합니다.
- `llm.txt` 생성 목록에 새 유틸리티 함수들을 등록해 LLM용 API 인덱스를 최신 상태로 유지합니다.

## [2.0.29]

### 수정

- SVG 호환성 보정에서 `xlink:href`를 DOM selector에 의존하지 않고 순회 기반으로 현대화합니다.
- 기존 `href`가 있는 SVG 요소는 값을 보존하면서 legacy `xlink:href`만 제거합니다.
