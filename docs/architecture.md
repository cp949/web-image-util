# @cp949/web-image-util 아키텍처

이 문서는 라이브러리의 내부 처리 흐름과 핵심 모듈을 설명합니다. 사용 가이드는 [README](../sub/web-image-util/README.md)를 참고하세요.

## 전체 처리 방식

`processImage()`는 입력 소스를 브라우저에서 렌더링 가능한 이미지 요소로 변환한 뒤, `ImageProcessor` 체이닝 API를 반환합니다. 문자열, URL, Blob/File, ArrayBuffer 계열 입력은 먼저 소스 타입을 판정하고, SVG 입력은 MIME과 내용 스니핑을 함께 확인한 다음 브라우저 렌더링에 맞게 정규화합니다.

체이닝 단계에서는 `resize()`, `blur()` 같은 연산을 즉시 Canvas에 그리지 않고 누적만 합니다. `ImageProcessor`는 타입 상태 전이와 위임만 남긴 얇은 축적기이고, 연산은 `OutputPipeline`(`src/core/output-pipeline.internal.ts`)이 생성 시점부터 보유한 `LazyRenderPipeline`에 직접 쌓입니다. resize 1회 불변식의 런타임 가드와 설정 검증(`validateResizeConfig`)은 `LazyRenderPipeline.addResize` 한 곳이 소유하며, shortcut의 scale/exactWidth 계열도 별도 통로 없이 공개 `resize()` 설정(`fit: 'scale'`, 단일 축 `fit: 'fill'`)으로 합류합니다. 출력 경로 전체(소스 정규화, 포맷/품질 기본값, 인코딩, pool 반환, Result 래핑)는 `OutputPipeline`이 담당합니다. 최종 출력 메서드(`toBlob()`, `toDataURL()`, `toFile()`, `toCanvas()`)가 호출되면 `single-renderer`의 분석기(`analyzeAllOperations`)가 누적 연산을 최종 레이아웃으로 계산하고(fit 모드 계산은 `calculateFinalLayout()` 활용 — scale·단일 축 fill의 원본 크기 해석도 이 시점), 렌더러(`renderLayout`)가 레이아웃 검증·품질 설정·배경색·필터를 적용해 한 번의 `drawImage()`로 렌더링합니다. 결과 canvas는 `CanvasLease`로 반환됩니다.

## 핵심 흐름

1. **입력 처리**: 파일, URL, SVG 등 여러 소스를 `HTMLImageElement`로 변환
2. **연산 누적**: `.resize()`, `.blur()` 같은 체이닝 메서드를 `LazyRenderPipeline`에 저장
3. **일괄 렌더링**: 최종 출력 시점에 단 한 번의 Canvas 처리로 전체 연산 실행
4. **포맷 변환**: Canvas 결과를 Blob, DataURL, File 등으로 변환

## 핵심 특성

- **지연 렌더링**: 중간 Canvas를 만들지 않아 메모리 효율이 높음
- **SVG 호환성 보정**: 브라우저별 SVG 렌더링 차이를 자동 보정
- **타입 안정성**: 잘못된 체이닝(예: `resize()` 중복 호출)을 컴파일 타임에 방지
- **포맷 선택**: 브라우저 지원 여부를 바탕으로 적절한 포맷 선택

## 아키텍처 불변조건

아래 규칙은 기능 추가나 리팩터링 때 우선 확인합니다.

- `resize()`, `blur()` 같은 체이닝 메서드는 Canvas에 즉시 그리지 않고 연산만 누적합니다.
- 체이닝 API의 `blur()`(CSS `ctx.filter`, `single-renderer.internal.ts`)와 `/filters`·`/advanced`의 `BlurFilterPlugin`(픽셀 컨볼루션, `src/filters/plugins/blur-plugins.ts`)은 이름만 같고 무관한 별도 구현입니다 — 병합 대상이 아닙니다.
- 한 체인에서 `resize()`는 한 번만 허용합니다. 타입 상태와 런타임 가드를 함께 유지하며, 런타임 가드·설정 검증·오류 메시지는 `LazyRenderPipeline.addResize` 한 곳이 소유합니다.
- 실제 Canvas 렌더링은 출력 메서드 호출 시점에 한 번만 수행합니다.
- 내부 렌더링 Canvas는 `CanvasPool`에서 획득하고, 소유권은 `CanvasLease` handle(`src/base/canvas-lease.internal.ts`)로 관리합니다. 파생물 출력(`toBlob()` 등)은 `consume()`으로 사용 후 pool에 반환하고, `toCanvas()`/`toCanvasDetailed()`는 `detach()`로 소유권을 사용자에게 이전합니다(pool 미반환).
- pool에서 빌린 canvas는 module 밖으로 내보내지 않습니다. 결과 canvas를 호출자에게 직접 반환하는 경로(composition, 고해상도 처리)는 pool을 거치지 않는 사용자 소유 canvas(`createOwnedCanvas`)를 사용합니다. pool이 release 시점에 픽셀을 지우므로, 빌린 canvas를 그대로 반환하면 호출자는 빈 canvas를 받게 됩니다.
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
| `src/processor.ts` | `processImage()` 팩토리와 `ImageProcessor` 체이닝 API — 연산 축적과 타입 상태 전이만 담당하는 얇은 축적기 |
| `src/core/output-pipeline.internal.ts` | 출력 경로 deep module — 소스 정규화, 파이프라인 구성·누적 연산 재생, resize 1회 런타임 가드, 포맷/품질 기본값, 인코딩, `CanvasLease` consume/detach, Result 래핑 |
| `src/core/source-converter/index.ts` | `convertToImageElement` 오케스트레이션 |
| `src/core/source-converter/detect.internal.ts` | 공유 소스 facts를 내부 로더 verdict(`SourceType`)로 투영. **내부 라우팅 정책**(`hasInternalSvgMetadataHint` — MIME·파일명 중 하나라도 SVG면 보수적으로 SVG 경로)을 소유하며 Blob URL 로더도 이 술어를 쓴다 |
| `src/utils/source-utils/source-facts.internal.ts` | 문자열 transport·포맷 힌트와 Blob MIME·파일명 facts의 단일 판정점. 소비자 정책은 담지 않는다 |
| `src/utils/source-utils/byte-signature.internal.ts` | 매직바이트 → 이미지 포맷 판정의 단일 facts(`detectFormatFromBytes`). bmp/tiff/ico처럼 공개 `ImageFormat`이 표현 못 하는 값도 낸다 — 접는 판단은 소비자(`image-info`의 `formatFromBytes`, blob loader의 `detectMimeTypeFromBuffer`) 몫이다 |
| `src/utils/source-utils/blob-projection.internal.ts` | Blob facts → **공개 진단 정책**(`resolveMimeFirstBlobFormat` — MIME 우선, 모호할 때만 파일명). 내부 라우팅 정책과 의도적으로 다르며 공개 판정과 `image-info`가 공유 |
| `src/svg-contract.internal.ts` | SVG 처리 계약 leaf — `MAX_SVG_BYTES`, `SvgSanitizerMode`. core와 진단 API가 같은 방향으로 공유 |
| `src/utils/browser-capabilities/memory.internal.ts` | 메모리 예산 단일 facts(`readMemoryBudget`) + GC 요청 메커니즘(`requestMemoryRelief`). probe는 `setMemoryProbe`로 주입 가능한 어댑터이고 fallback은 단일 값 하나다. 소비자 6곳(canvas-pool, performance-utils, error-handler, auto-memory-manager, high-res-manager, tiled-processor)이 각자의 임계값 정책만 로컬로 남긴다 |
| `src/core/source-converter/options.internal.ts` | 내부 옵션 타입과 fetch 기본값 상수 |
| `src/core/source-converter/svg/` | SVG 안전 경로 — `data-url.internal.ts`, `loader.internal.ts`, `safety.internal.ts` |
| `src/core/source-converter/url/` | HTTP/Blob URL 로더 — `policy.internal.ts`, `fetch-guards.internal.ts`, `loader.internal.ts` |
| `src/core/source-converter/loaders/` | 형태별 입력 변환기 — `string.internal.ts`, `blob.internal.ts`, `canvas.internal.ts` |
| `src/utils/image-decode.internal.ts` | 이미지 디코드의 단일 소유 모듈 — img 생성, `src` 할당 전 속성 설정, objectURL 수명, 오류 래핑. img 구동 방식만 어댑터로 갈린다 |
| `src/utils/svg-detection.ts` | `isInlineSvg()` 등 SVG 문자열 판정 |
| `src/utils/svg-sanitizer.ts` | `sanitizeSvgForRendering()`, `sanitizeSvg()` (deprecated alias) — 경량 집행 엔진(정규식 메커니즘) |
| `src/utils/svg-threat-policy.internal.ts` | SVG 위협 정책 단일 소유자 — URI 참조 판정, CSS 참조·위험 구문 정책, 금지 요소 목록, XXE 절단. 경량·strict 두 집행 엔진과 진단 수집기, intake guard가 공유 |
| `src/utils/inspect-svg.ts` | SVG 문자열 진단 API — 부수효과 없이 findings·dimensions·sanitizer 추천을 반환하는 진단 레이어 |
| `src/utils/inspect-svg-source.ts` | SVG 입력 source(`string`/`Blob`/`File`/`URL`) 진단. 기본 fetch 없음, `inspectSvg()` 위임으로 본문 분석 |
| `src/utils/prefix-svg-ids.ts` | SVG `id`와 fragment reference를 prefix하는 standalone 정규화 유틸 — 파이프라인 외부, `@cp949/web-image-util/utils` 서브패스 |
| `src/svg-sanitizer/inspect-sanitization.ts` | sanitizer 정책 영향 진단 API — `inspectSvgSanitization()`. 정책별 stage 카운트를 반환하며 파이프라인 외부의 진단 레이어다. strict는 동적 import. |
| `src/svg-sanitizer/core.internal.ts` | DOMPurify 기반 strict sanitizer 본체 — `sanitizeSvgStrict()` / `sanitizeSvgStrictDetailed()` 구현. `preprocess.internal.ts`(BOM/XML 선언/DOCTYPE 제거), `enforce-dom-policy.internal.ts`(`<script>`/`on*` 강제 제거), `postprocess.internal.ts`(잔여 외부 참조 검사)와 함께 동작 |
| `src/svg-sanitizer/index.ts` | `@cp949/web-image-util/svg-sanitizer` 서브패스 배럴 — `sanitizeSvgStrict`, `sanitizeSvgStrictDetailed`, `inspectSvgSanitization` export |
| `src/core/lazy-render-pipeline.internal.ts` | 연산 누적과 최종 렌더링 트리거 |
| `src/core/single-renderer.internal.ts` | 누적 연산 분석(`analyzeAllOperations`)과 최종 Canvas drawImage 렌더링(`renderLayout` → `CanvasLease`) |
| `src/filters/plugin-system.ts` | 필터 플러그인 레지스트리·실행 — `registerFilter`/`applyFilter`/`applyFilterChain`/`validateFilterChain`. `/advanced`·`/filters`(재노출) 전용, 메인 체이닝 파이프라인과는 별개 시스템 |
| `src/filters/plugins/blur-plugins.ts` | `BlurFilterPlugin`(`name: 'blur'`)·`SharpenFilterPlugin`·`EmbossFilterPlugin`·`EdgeDetectionFilterPlugin` — 2-pass Gaussian 컨볼루션 등 픽셀 단위 구현. 체이닝 API의 `blur()`(CSS `ctx.filter`, 위 `single-renderer.internal.ts` 행)와 이름만 같고 서로 무관하다 |
| `src/base/high-res-detector.internal.ts` | 이미지 크기 분석(`analyzeImage`)과 고해상도 처리 진입 게이트(`shouldUseHighResolutionPath`) 단일 소유 — `AutoHighResProcessor`가 이 게이트를 쓴다(유일한 진입점). `AutoHighResProcessor` 커스텀 픽셀 임계값은 유지한다 |
| `src/base/high-res-manager.ts` | advanced 고해상도 경로의 매니저 — 이미지 분석·전략 선택·메모리 점검(압박 시 `CanvasPool.clear()` + GC 요청)만 담당하고 실행은 전략 adapter에 위임 |
| `src/base/resize-strategy.internal.ts` | 고해상도 전략 seam — `RESIZE_STRATEGY_ADAPTERS` 레지스트리(direct/stepped/tiled)와 전략별 튜닝 지식(품질 매핑·단계 수·동시성·타일 크기·예상 시간 배수). tiled는 `analysis.estimatedMemoryMB`(64MB 경계)로 light(옛 chunked)/heavy 두 preset을 내부에서 고른다. 전략 추가 = adapter 1개 + 맵 1행 |
| `src/base/canvas-utils.internal.ts` | canvas 생성·인코딩 leaf — `createOwnedCanvas`(호출자 소유 canvas, advanced 전 경로가 사용), `applySmoothing`(quality→imageSmoothing 매핑 정본), `canvasToBlob`(통합 인코더) |
| `src/types/resize-config.ts` | ResizeConfig 타입 시스템 |

진단 API의 판정 기준은 층별로 다르다: `inspectSvg()`/`inspectSvgSource()`는 변환 경로 intake guard(`assertSafeSvgContent`)의 거부 기준을, `inspectSvgSanitization()`은 선택한 정책의 sanitizer가 실제 치환하는 기준을 따른다. 판정 규칙 자체는 위협 정책 모듈(`src/utils/svg-threat-policy.internal.ts`)이 단일 소유하며, 두 sanitizer의 동작 차이는 동치성 코퍼스(`sub/web-image-util/tests/security/sanitizer-equivalence.corpus.ts`)가 전수 고정한다. 이 정합은 `sub/web-image-util/tests/unit/utils/svg-inspection-axis-alignment.test.ts`가 고정하며, 사용자 관점 서술은 [SVG-SECURITY.md](../SVG-SECURITY.md)의 "진단 API의 판정 기준 차이" 절에 있다.

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

진입점 간 심볼 중복은 두지 않습니다. 변환·포맷·이미지 정보·소스 판정·브라우저 기능 감지 유틸은 루트가 단독 소유하고, `/utils`는 SVG 전용 진단·변형 도구(`inspectSvg`, `inspectSvgSource`, `prefixSvgIds`, `SvgOptimizer`)만 노출합니다. `src/index.ts`는 `src/utils/index.ts` 배럴을 경유하지 않고 각 하위 모듈에서 직접 재노출합니다.

## SVG 입력 처리 파이프라인

`source-converter/`의 SVG 감지 로직은 라이브러리의 핵심 기술입니다. 단순 문자열 검사(`includes('<svg')`나 `startsWith('<?xml')`)에 의존하지 않고 모듈 호출 순서로 다단 검증합니다. 본 흐름이 SVG 입력 처리의 단일 출처이며 진단 API(`inspectSvg`, `inspectSvgSource`)도 동일한 헬퍼를 재사용합니다.

| 단계 | 모듈 | 역할 |
| --- | --- | --- |
| 1 | `classifyStringSource()` / `inspectBlobMetadata()` *(source-utils/source-facts.internal.ts)* → `detectSourceTypeAsync()` *(source-converter/detect.internal.ts)* | 대소문자를 정규화한 scheme·경로 힌트와 Blob MIME·파일명 facts를 만든 뒤 내부 로더 verdict로 투영. Blob은 크기 상한을 먼저 검사하고 필요한 경우 본문 4KB 스니핑 |
| 2 | `isInlineSvg()` *(utils/svg-detection.ts)* | 인라인 SVG XML 후보 검출 |
| 3 | `stripXmlPreambleAndNoise()` *(utils/svg-detection.ts)* | BOM, XML 선언, 주석, DOCTYPE 정리 후 재판정 |
| 4 | `sniffSvgFromBlob()` *(utils/svg-detection.ts)* | Blob 첫 4KB sniff |
| 5 | `parseSvgFromDataUrl()` *(source-converter/svg/data-url.internal.ts)* | Data URL decode + SVG 추출 |
| 6 | `assertSafeSvgContent()` *(source-converter/svg/safety.internal.ts)* | sanitize 후 잔여 외부 참조 fail-closed 차단 |
| 7 | `convertSvgToElement()` *(source-converter/svg/loader.internal.ts)* | SVG 정규화 + 고품질 브라우저 렌더링용 `HTMLImageElement` 변환 |

수정 시 다양한 케이스 테스트, XSS·canvas 오염 방지를 함께 고려해야 합니다.

## SVG 입력 fetch 정책

원격 URL 입력의 fetch 동작은 단일 출처 헬퍼/상수에서 결정됩니다. 변환 경로(`processImage()` 내부의 source-converter)와 진단 경로(`inspectSvgSource()`)가 동일한 정책을 공유하기 때문에 한쪽만 동작이 갈리지 않습니다.

| 모드 | HTTP 메서드 | 본문 소비 | 사용처 |
| --- | --- | --- | --- |
| `'never'` | 없음 | × | 정책 검증만 (`inspectSvgSource()` 기본값) |
| `'metadata'` | HEAD | × | MIME/Content-Length 진단 |
| `'body'` | GET | ○ (1회) | byte cap 내 본문 sniff |

정책 헬퍼/상수의 단일 출처는 다음 모듈입니다.

- `src/svg-contract.internal.ts` — `MAX_SVG_BYTES` (SVG 입력 byte cap의 단일 정의)
- `src/core/source-converter/options.internal.ts` — `DEFAULT_FETCH_TIMEOUT_MS`, `DEFAULT_ALLOWED_PROTOCOLS`
- `src/core/source-converter/url/policy.internal.ts` — `checkAllowedProtocol()`, `hasExplicitUrlScheme()`, `isProtocolRelativeUrl()`, `isAbortLikeError()`, `normalizePolicyUrl()`
- `src/core/source-converter/url/fetch-guards.internal.ts` — 원격 본문 가드의 단일 소유 모듈
  - `createFetchAbortHandle()` — timeout + AbortSignal 합성. `AbortSignal.timeout`/`AbortSignal.any`를 우선 쓰고, 없으면 수동 타이머·리스너로 폴백하며 `dispose()`가 둘 다 정리한다.
  - `assertDeclaredSizeWithinLimit()` / `checkResponseSize()` — Content-Length 기반 byte cap 사전 검증. 초과가 확인되면 본문 스트림을 취소한 뒤 오류를 던진다.
  - `readGuardedResponseStream()` — 본문 스트림 누적 byte cap 강제. 초과 시 reader를 취소하며, 취소 실패는 삼켜 byte cap 오류 코드를 보존한다.
  - `readWholeBody()` — 스트림이 없는 응답의 전체 읽기와 실패 래핑.
  - `readCheckedBlobResponse()` — 바이너리 어댑터(`{ blob, bytes }` 반환).
  - `readTruncatedResponsePrefix()` — 절단 읽기 어댑터. 상한까지만 읽고 스트림을 취소하며 초과를 오류로 올리지 않는다. 스트림이 없는 응답은 절단할 수 없으므로 빈 결과를 반환한다(본문 전체를 메모리에 올리지 않는다).

상한 초과 처리는 두 갈래입니다. **거부 읽기**(`readGuardedResponseStream` 계열)는 오류를 던지고, **절단 읽기**(`readTruncatedResponsePrefix`)는 상한까지만 읽습니다. 앞부분 바이트만 필요한 스니핑 경로가 후자를 사용합니다.

상한 값과 오류 코드는 호출자가 주입하므로 디코드 방식만 어댑터로 갈라집니다. 텍스트 어댑터는 `src/core/source-converter/svg/safety.internal.ts`의 `readCheckedTextResponse()`이며, 같은 가드 위에 `MAX_SVG_BYTES`와 `SVG_BYTES_EXCEEDED`를 주입합니다.

진단 모듈(`src/utils/inspect-svg-source.ts`)과 이미지 메타데이터 모듈(`src/utils/image-info/remote-fetch.internal.ts`)은 위 헬퍼/상수를 그대로 import해 fetch 정책을 적용합니다. 신규 정책/가드 함수를 별도로 신설하지 않는 것이 RM-004 결정 D14의 단일 출처 원칙입니다. byte cap을 사용자 옵션으로 상향하는 것은 금지되며, `options.byteLimit`은 `MAX_SVG_BYTES` 이하로만 허용됩니다. 같은 이유로 `fetchImageFormat()`의 `sniffBytes`도 `MAX_SNIFF_BYTES`(64KiB)를 넘길 수 없습니다.

`remote-fetch.internal.ts`의 두 공개 함수는 정책 적용 방식이 다릅니다. `fetchImageSourceBlob()`은 `allowedProtocols`를 옵션으로 받아 무조건 검사하고, `fetchImageFormat()`은 `DEFAULT_ALLOWED_PROTOCOLS`를 고정으로 쓰되 명시적 스킴 또는 protocol-relative 입력일 때만 검사합니다(상대 경로는 브라우저 자산 로딩 경로를 유지 — `url/loader.internal.ts`와 같은 규칙). 두 함수 모두 `createFetchAbortHandle()`로 타임아웃/중단을 결합하며, `fetchImageFormat()`은 기본 30초, `fetchImageSourceBlob()`은 기본 무제한입니다.

## 이미지 디코드

`HTMLImageElement`에 소스를 붙이고 로드 완료를 기다리는 동작은 `src/utils/image-decode.internal.ts`가 단일 소유합니다. 변환 경로(Blob·URL·SVG·element·canvas)와 출력 경로(`toElement()`), 진단 보조(`getBlobDimensions()`)가 모두 이 모듈을 경유하므로 핸들러 해제와 objectURL revoke 규칙이 호출처마다 갈리지 않습니다.

모듈이 소유하는 것과 어댑터가 소유하는 것을 나눕니다.

| 소유자 | 책임 |
| --- | --- |
| 모듈 | img 생성(`createImageElement()` 경유), `crossOrigin`·`decoding` 설정(**`src` 할당 전**), objectURL 생성·revoke, 실패의 `ImageProcessError` 조립 |
| 어댑터 | img를 로드 완료 상태까지 구동 — 핸들러 등록·해제와 `src` 할당 |

입력별 진입점은 3개입니다.

- `decodeImageFromUrl(src, options)` — data URL·object URL·일반 URL
- `decodeImageFromBlob(blob, options)` — objectURL을 만들어 디코드하고 성공·실패와 무관하게 revoke
- `decodeExistingImage(img, options)` — 이미 소스가 붙은 element의 완료 대기. `complete && naturalWidth > 0`이면 핸들러를 붙이지 않고 즉시 반환하며, `src`를 재할당하지 않습니다(재할당은 진행 중인 로드를 다시 시작시킵니다)

`options.errorCode`에는 기본값을 두지 않습니다. `loadImageFromUrl()`의 `transport` 매개변수와 같은 이유로, 새 호출자가 인자를 빠뜨렸을 때 오류 코드가 조용히 다른 값으로 떨어지는 대신 컴파일 타임에 드러나게 합니다. 메시지는 `options.message`로 주입하며, `Failed to load image: ${url}`처럼 입력을 담은 진단 메시지를 유지하기 위해 통합하지 않습니다.

어댑터는 `setImageDecodeAdapter()` / `resetImageDecodeAdapter()`로 교체합니다. 테스트가 실제 디코딩 없이 호출처를 구동하기 위한 진입점이며 `.internal` 모듈에만 존재합니다 — 어떤 배럴에도 export하지 않습니다. 어댑터는 실패 원인만 던지고 `ImageProcessError` 조립에 관여하지 않으므로, 어댑터를 바꿔도 호출처가 관찰하는 오류 코드와 메시지는 같습니다.

디코드 타임아웃은 도입하지 않았습니다. 필요해지면 `createFetchAbortHandle()`과 같은 형태로 **모듈에** 추가합니다 — 타임아웃은 정책이고 어댑터는 구동 방식만 가릅니다.

`src/utils/browser-capabilities/format-detection.internal.ts`의 포맷 지원 프로브는 이 모듈을 쓰지 않습니다. 실패 시 reject하지 않고 `resolve(false)`하며 자체 `setTimeout` 상한을 갖는 다른 오류 계약이기 때문입니다.
