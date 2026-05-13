# @cp949/web-image-util 아키텍처

이 문서는 라이브러리의 내부 처리 흐름과 핵심 모듈을 설명합니다. 사용 가이드는 [README](../sub/web-image-util/README.md)를 참고하세요.

## 전체 처리 방식

`processImage()`는 입력 소스를 브라우저에서 렌더링 가능한 이미지 요소로 변환한 뒤, `ImageProcessor` 체이닝 API를 반환합니다. 문자열, URL, Blob/File, ArrayBuffer 계열 입력은 먼저 소스 타입을 판정하고, SVG 입력은 MIME과 내용 스니핑을 함께 확인한 다음 브라우저 렌더링에 맞게 정규화합니다.

체이닝 단계에서는 `resize()`, `blur()` 같은 연산을 즉시 Canvas에 그리지 않고 `LazyRenderPipeline`에 누적합니다. 최종 출력 메서드(`toBlob()`, `toDataURL()`, `toFile()`, `toCanvas()`)가 호출되면 `ResizeCalculator`가 fit 모드와 최종 레이아웃을 계산하고, `OnehotRenderer`가 한 번의 `drawImage()` 중심 렌더링으로 품질 설정, 배경색, 포맷 변환까지 처리합니다.

## 핵심 흐름

1. **입력 처리**: 파일, URL, SVG 등 여러 소스를 `HTMLImageElement`로 변환
2. **연산 누적**: `.resize()`, `.blur()` 같은 체이닝 메서드를 `LazyRenderPipeline`에 저장
3. **배치 렌더링**: 최종 출력 시점에 단 한 번의 Canvas 처리로 전체 연산 실행
4. **포맷 변환**: Canvas 결과를 Blob, DataURL, File 등으로 변환

## 핵심 특성

- **지연 렌더링**: 중간 Canvas를 만들지 않아 메모리 효율이 높음
- **SVG 호환성 보정**: 브라우저별 SVG 렌더링 차이를 자동 보정
- **타입 안정성**: 잘못된 체이닝(예: `resize()` 중복 호출)을 컴파일 타임에 방지
- **포맷 선택**: 브라우저 지원 여부를 바탕으로 적절한 포맷 선택

## 아키텍처 불변조건

아래 규칙은 기능 추가나 리팩터링 때 우선 확인합니다.

- `resize()`, `blur()` 같은 체이닝 메서드는 Canvas에 즉시 그리지 않고 연산만 누적합니다.
- 한 체인에서 `resize()`는 한 번만 허용합니다. 타입 상태와 런타임 가드를 함께 유지합니다.
- 실제 Canvas 렌더링은 출력 메서드 호출 시점에 한 번만 수행합니다.
- 내부 렌더링 Canvas는 `CanvasPool`을 통해 획득하고 반환합니다.
- `toCanvas()`와 `toCanvasDetailed()`의 반환 Canvas는 사용자 소유이므로 pool에 반환하지 않습니다.
- 공개 진입점은 `sub/web-image-util/package.json`의 `exports` 필드에 선언된 경로로 제한합니다.
- SVG 입력은 단순 문자열 검사로 분기하지 않고 `source-converter/`의 다단계 판정 경로를 사용합니다.

## Canvas Pool

라이브러리는 내부적으로 Canvas Pool을 사용해 Canvas 객체를 재사용합니다. 매 처리마다 새 Canvas를 생성·파괴하는 대신, 완료된 Canvas를 풀에 반환하여 다음 처리에 재사용합니다.

- **GC 압력 감소**: 반복 처리 시 Canvas 생성·소멸로 인한 Garbage Collection 빈도를 줄입니다.
- **처리 비용 감소**: 반복 처리에서 Canvas 생성 오버헤드를 줄입니다.
- **자동 관리**: 별도 설정 없이 `toBlob()`, `toDataURL()`, `toFile()` 사용 시 자동으로 작동합니다.

`.toCanvas()` 또는 `.toCanvasDetailed()`를 사용하면 Canvas 객체를 직접 받습니다. 이 경우 Canvas는 풀에 자동 반환되지 않으므로 사용이 끝나면 참조를 해제하면 됩니다. 대용량 반복 작업에서는 `toBlob()`을 사용하여 Canvas 수명 주기를 자동으로 관리하는 것을 권장합니다.

## 핵심 모듈

| 파일 | 역할 |
| --- | --- |
| `src/processor.ts` | `processImage()` 팩토리와 `ImageProcessor` 체이닝 API |
| `src/core/source-converter.ts` | 위 서브모듈의 공개 API(`convertToImageElement`, `detectSourceType`, `getImageDimensions`)를 모은 배럴 |
| `src/core/source-converter/index.ts` | `convertToImageElement` / `getImageDimensions` 오케스트레이션 |
| `src/core/source-converter/detect.ts` | `detectSourceType()`과 `SourceType` 정의 |
| `src/core/source-converter/options.ts` | 내부 옵션 타입과 `MAX_SVG_BYTES` 등 상수 |
| `src/core/source-converter/svg/` | SVG 안전 경로 — `data-url.ts`, `loader.ts`, `safety.ts` |
| `src/core/source-converter/url/` | HTTP/Blob URL 로더 — `policy.ts`, `fetch-guards.ts`, `loader.ts` |
| `src/core/source-converter/loaders/` | 형태별 입력 변환기 — `string.ts`, `blob.ts`, `canvas.ts` |
| `src/utils/svg-detection.ts` | `isInlineSvg()` 등 SVG 문자열 판정 |
| `src/utils/svg-sanitizer.ts` | `sanitizeSvgForRendering()`, `sanitizeSvg()` (deprecated alias) |
| `src/utils/inspect-svg.ts` | SVG 문자열 진단 API — 부수효과 없이 findings·dimensions·sanitizer 추천을 반환하는 진단 레이어 |
| `src/utils/inspect-svg-source.ts` | SVG 입력 source(`string`/`Blob`/`File`/`URL`) 진단. 기본 fetch 없음, `inspectSvg()` 위임으로 본문 분석 |
| `src/utils/prefix-svg-ids.ts` | SVG `id`와 fragment reference를 prefix하는 standalone 정규화 유틸 — 파이프라인 외부, `@cp949/web-image-util/utils` 서브패스 |
| `src/svg-sanitizer/inspect-sanitization.ts` | sanitizer 정책 영향 진단 API — `inspectSvgSanitization()`. 정책별 stage 카운트를 반환하며 파이프라인 외부의 진단 레이어다. strict는 동적 import. |
| `src/svg-sanitizer/core.ts` | DOMPurify 기반 strict sanitizer 본체 — `sanitizeSvgStrict()` / `sanitizeSvgStrictDetailed()` 구현. `preprocess.ts`(BOM/XML 선언/DOCTYPE 제거), `enforce-dom-policy.ts`(`<script>`/`on*` 강제 제거), `postprocess.ts`(잔여 외부 참조 검사)와 함께 동작 |
| `src/svg-sanitizer/index.ts` | `@cp949/web-image-util/svg-sanitizer` 서브패스 배럴 — `sanitizeSvgStrict`, `sanitizeSvgStrictDetailed`, `inspectSvgSanitization` export |
| `src/core/lazy-render-pipeline.ts` | 연산 누적과 최종 렌더링 트리거 |
| `src/core/single-renderer.ts` | 누적 연산 분석 및 단일 렌더링 진입점 |
| `src/core/onehot-renderer.ts` | 최종 Canvas drawImage 렌더링 |
| `src/types/resize-config.ts` | ResizeConfig 타입 시스템 |

## 공개 API 표면

새 export를 추가하거나 제거할 때는 `sub/web-image-util/package.json`의 `exports` 필드, 배럴 파일, contract 테스트를 함께 갱신합니다.

| npm 경로 | 소스 진입점 |
| --- | --- |
| `@cp949/web-image-util` | `src/index.ts` |
| `@cp949/web-image-util/advanced` | `src/advanced-index.ts` |
| `@cp949/web-image-util/presets` | `src/presets/index.ts` |
| `@cp949/web-image-util/utils` | `src/utils/index.ts` |
| `@cp949/web-image-util/filters` | `src/filters/plugins/index.ts` |
| `@cp949/web-image-util/svg-sanitizer` | `src/svg-sanitizer/index.ts` |

## SVG 입력 처리 파이프라인

`source-converter/`의 SVG 감지 로직은 라이브러리의 핵심 기술입니다. 단순 문자열 검사(`includes('<svg')`나 `startsWith('<?xml')`)에 의존하지 않고 모듈 호출 순서로 다단 검증합니다. 본 흐름이 SVG 입력 처리의 단일 출처이며 진단 API(`inspectSvg`, `inspectSvgSource`)도 동일한 헬퍼를 재사용합니다.

| 단계 | 모듈 | 역할 |
| --- | --- | --- |
| 1 | `detectSourceType()` *(source-converter/detect.ts)* | string/Blob/File/URL 분기 |
| 2 | `isInlineSvg()` *(utils/svg-detection.ts)* | 인라인 SVG XML 후보 검출 |
| 3 | `stripXmlPreambleAndNoise()` *(utils/svg-detection.ts)* | BOM, XML 선언, 주석, DOCTYPE 정리 후 재판정 |
| 4 | `sniffSvgFromBlob()` *(source-converter/svg/data-url.ts)* | Blob 첫 4KB sniff |
| 5 | `parseSvgFromDataUrl()` *(source-converter/svg/data-url.ts)* | Data URL decode + SVG 추출 |
| 6 | `assertSafeSvgContent()` *(source-converter/svg/safety.ts)* | sanitize 후 잔여 외부 참조 fail-closed 차단 |
| 7 | `convertSvgToElement()` *(source-converter/svg/loader.ts)* | SVG 정규화 + 고품질 브라우저 렌더링용 `HTMLImageElement` 변환 |

수정 시 다양한 케이스 테스트, XSS·canvas 오염 방지를 함께 고려해야 합니다.

## SVG 입력 fetch 정책

원격 URL 입력의 fetch 동작은 단일 출처 헬퍼/상수에서 결정됩니다. 변환 경로(`processImage()` 내부의 source-converter)와 진단 경로(`inspectSvgSource()`)가 동일한 정책을 공유하기 때문에 한쪽만 동작이 갈리지 않습니다.

| 모드 | HTTP 메서드 | 본문 소비 | 사용처 |
| --- | --- | --- | --- |
| `'never'` | 없음 | × | 정책 검증만 (`inspectSvgSource()` 기본값) |
| `'metadata'` | HEAD | × | MIME/Content-Length 진단 |
| `'body'` | GET | ○ (1회) | byte cap 내 본문 sniff |

정책 헬퍼/상수의 단일 출처는 다음 두 모듈입니다.

- `src/core/source-converter/options.ts` — `MAX_SVG_BYTES`, `DEFAULT_FETCH_TIMEOUT_MS`, `DEFAULT_ALLOWED_PROTOCOLS`
- `src/core/source-converter/url/policy.ts` — `checkAllowedProtocol()`, `hasExplicitUrlScheme()`, `isProtocolRelativeUrl()`, `isAbortLikeError()`, `normalizePolicyUrl()`, `isBlockedSvgPolicyRef()`, `isSvgResourcePath()`
- `src/core/source-converter/url/fetch-guards.ts` — `createFetchAbortHandle()`(timeout + AbortSignal 합성), `checkResponseSize()`(Content-Length 기반 byte cap 사전 검증)

진단 모듈(`src/utils/inspect-svg-source.ts`)은 위 헬퍼/상수를 그대로 import해 fetch 정책을 적용합니다. 신규 정책/가드 함수를 별도로 신설하지 않는 것이 RM-004 결정 D14의 단일 출처 원칙입니다. byte cap을 사용자 옵션으로 상향하는 것은 금지되며, `options.byteLimit`은 `MAX_SVG_BYTES` 이하로만 허용됩니다.
