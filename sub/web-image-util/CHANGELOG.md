# Changelog

이 파일은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식을 따르며, 이 프로젝트는 [Semantic Versioning](https://semver.org/lang/ko/)을 사용합니다.

## [Unreleased]

### 추가

- Added: `resize()`가 `{ fit: 'scale', scale }` 설정을 받습니다. 원본 크기 기준 배율 리사이즈이며 균일 배율(`scale: 1.5`)과 축별 배율(`scale: { sx: 2 }`, `{ sy: 0.5 }`, `{ sx: 2, sy: 0.75 }`)을 지원합니다. shortcut `scale()`/`scaleX()`/`scaleY()`/`scaleXY()`와 동일한 동작입니다.
- Added: `{ fit: 'fill' }`에서 `width` 또는 `height` 한 축만 지정할 수 있습니다. 생략한 축은 원본 비율로 계산됩니다. shortcut `exactWidth()`/`exactHeight()`와 동일한 동작입니다.

### 보안

- Security: 경량(lightweight) SVG sanitizer의 위협 정책을 strict와 단일 모듈로 통일하고 다음 구멍을 폐쇄했습니다. 두 정책의 동작 차이는 동치성 코퍼스 테스트로 전수 고정됩니다.
  - `href`/`xlink:href`/`src` 판정을 denylist(`http:`/`https:`/`//`/`data:`/`javascript:`)에서 allowlist(내부 프래그먼트 `#id`와 안전한 `data:image/*`만 보존)로 반전했습니다. 미지 스킴(`vbscript:`, `file:`, `ftp:`, `blob:`, `mailto:` 등)과 bare 상대 경로가 보존되던 동작이 폐쇄됩니다.
  - `fill`/`filter`/`mask` 등 CSS presentation 속성 11종의 외부 `url()`이 정제 없이 통과하던 격차를 폐쇄했습니다. 문자열 인자 `@import`/`expression()`/`image-set()`/`-moz-binding`도 strict와 같이 값 단위로 폐기합니다.
  - DOCTYPE/`<!ENTITY>` 선언(XXE 표면)을 경량 경로에서도 절단합니다.
  - `attributeName`으로 `href`를 타겟팅하는 `<animate>`/`<set>` 요소를 제거합니다(좌표 애니메이션 등 일반 animate/set은 보존).
  - HTML 엔티티로 숨긴 CSS 위협은 값 전체를 폐기합니다(fail-closed).

### 변경

- Changed (**Breaking**): `@cp949/web-image-util/utils` 서브패스가 SVG 전용 진단·변형 도구 4개(`inspectSvg`, `inspectSvgSource`, `prefixSvgIds`, `SvgOptimizer`)만 노출합니다. 기존에 이 서브패스가 노출하던 나머지 47개 value export는 모두 루트 진입점(`@cp949/web-image-util`)에 같은 이름으로 이미 존재하던 중복이었고, 이제 루트가 단독 소유합니다.
  - 이동 대상: 변환(`ensureBlob`·`ensureBlobDetailed`·`ensureDataURL`·`ensureDataURLDetailed`·`ensureFile`·`ensureFileDetailed`·`ensureImageElement`·`ensureImageElementDetailed`), Data URL(`blobToDataURL`·`dataURLToBlob`·`decodeSvgDataURL`·`estimateDataURLPayloadByteLength`·`estimateDataURLSize`·`isDataURLString`), 포맷(`formatToMimeType`·`getOutputFilename`·`isSupportedOutputFormat`·`mimeTypeToImageFormat`·`mimeTypeToOutputFormat`·`replaceImageExtension`·`resolveOutputFormat`), 이미지 정보(`fetchImageFormat`·`fetchImageSourceBlob`·`getImageAspectRatio`·`getImageDimensions`·`getImageFormat`·`getImageInfo`·`getImageOrientation`), 이미지 검사(`hasTransparency`), 소스 판정(`detectImageSourceInfo`·`detectImageSourceType`·`detectImageStringSourceInfo`·`detectImageStringSourceType`), SVG 정규화·정화(`enhanceBrowserCompatibility`·`enhanceSvgForBrowser`·`isInlineSvg`·`sanitizeSvg`·`sanitizeSvgForRendering`), 브라우저 기능 감지(`analyzePerformanceFeatures`·`BrowserCapabilityDetector`·`DEFAULT_DETECTION_OPTIONS`·`detectBrowserCapabilities`·`detectFormatSupport`·`detectSyncCapabilities`·`FEATURE_PERFORMANCE_WEIGHTS`·`getOptimalProcessingMode`·`PROCESSING_MODE_DESCRIPTIONS`).
  - 마이그레이션은 import 경로 한 줄 변경입니다. `import { ensureBlob } from '@cp949/web-image-util/utils'` → `import { ensureBlob } from '@cp949/web-image-util'`. 함수 시그니처와 동작은 바뀌지 않습니다.
  - 대응 타입 export도 같은 기준으로 이동했습니다(`EnsureBlobOptions`, `ImageInfo`, `ImageSourceType`, `BrowserCapabilities`, `SvgCompatibilityOptions` 등). `/utils`에는 SVG 4개 도구의 타입(`InspectSvgReport`, `InspectSvgSourceReport`, `SvgIdPrefixResult`, `SvgOptimizationOptions` 등)만 남습니다.
  - 루트 진입점의 export 목록은 변하지 않습니다. 루트에서 가져오던 코드는 영향받지 않습니다.
- Changed (**Breaking**): `/advanced`의 필터 플러그인 표면이 모듈 함수 한 벌로 단일화되었습니다. 같은 기능을 매니저 객체와 모듈 함수로 이중 노출하던 구조를 정리한 것입니다.
  - `filterManager` export가 제거되었습니다. `filterManager.applyFilter()`/`applyFilterChain()`/`getAvailableFilters()`는 같은 이름의 모듈 함수를 그대로 사용하세요. `filterManager.register()`는 `registerFilter()`, `filterManager.validateFilterChain()`은 신설 export `validateFilterChain()`으로 대체됩니다.
  - `filterManager`를 통해서만 도달할 수 있던 `unregister()`·`getPlugin()`·`getAllPlugins()`·`getPluginsByCategory()`·`getSystemInfo()`는 대체 없이 제거되었습니다. 등록 해제 경로는 사라지며, 같은 이름으로 다시 `registerFilter()`하면 덮어쓰기는 그대로 동작합니다.
  - `initializeFilterSystem()`이 전역 객체에 노출하던 `WebImageUtil.filters.manager`가 제거되었습니다. `WebImageUtil.filters.register`는 유지됩니다.
- Changed (**Breaking**): 필터 플러그인 타입에서 판독하는 코드가 없던 선택 멤버를 제거했습니다. 객체 리터럴로 이 필드를 함께 넘기던 코드는 초과 속성 검사에 걸립니다.
  - `FilterPlugin.preview`·`FilterPlugin.canOptimizeWith` 제거. 기본 제공 플러그인(`BrightnessFilterPlugin`·`GrayscaleFilterPlugin`·`BlurFilterPlugin`의 `preview`, `SaturationFilterPlugin`의 `canOptimizeWith`)에서도 함께 사라지며, `createFilterPlugin()`도 더 이상 `preview`를 채우지 않습니다.
  - `FilterChain.preview`·`FilterChain.name`·`FilterOptions.id` 제거.
- Changed (**Breaking**): 파일명 확장자 정책이 `toFile()`과 `ensureFile()` 공통 정본 하나로 통일되었습니다. 기존에는 두 경로가 서로 다른 규칙을 썼습니다. 통일된 규칙은 다음과 같습니다.
  - JPEG 계열의 권장 확장자는 `jpg`입니다. `ensureFile(src, 'photo.png', { format: 'jpeg' })`의 결과가 `photo.jpeg`에서 `photo.jpg`로 바뀝니다. 공개 함수 `replaceImageExtension()`/`getOutputFilename()`도 같습니다.
  - 확장자가 이미 같은 포맷을 가리키면 표기를 보존합니다(`photo.jpeg` + `jpeg` → `photo.jpeg`, `photo.jpg` + `jpeg` → `photo.jpg`). 이에 따라 `ensureFile()`이 같은 포맷·같은 파일명 입력에서 원본 `File`을 재사용하고 불필요한 재인코딩을 하지 않습니다.
  - 이미지 확장자가 아니어도 마지막 확장자를 교체하고, 쿼리·해시(`?v=1`, `#preview`)를 제거합니다. `toFile('photo.txt', { format: 'png' })`의 결과가 `photo.txt.png`에서 `photo.png`로 바뀝니다.
- Changed (**Breaking**): 공개 변환 옵션 타입 `EnsureBlobOptions`·`EnsureBlobDetailedOptions`·`EnsureDataURLOptions`·`EnsureDataURLDetailedOptions`를 `OutputOptions`의 type alias로, `EnsureFileDetailedOptions`를 `EnsureFileOptions`의 type alias로 축소했습니다. 일반 구조적 할당은 동일하지만, 이 타입들을 대상으로 한 TypeScript declaration merging은 더 이상 지원하지 않습니다.
- Changed (**Breaking**): `inspectSvgSource()`의 byte 초과 finding이 세 진단 API 공통 계약으로 통일되었습니다. code가 `'byte-limit-exceeded'`에서 `'svg-bytes-exceeded'`로, `details`가 `{ byteLimit }`에서 `{ actualBytes, maxBytes }`로 바뀝니다(`actualBytes`는 측정된 실제 크기이며, 공통 스키마는 크기를 알 수 없는 경로를 위해 null도 허용합니다). 이제 `inspectSvg()`/`inspectSvgSource()`/`inspectSvgSanitization()`이 같은 사건(byte 한도 초과)을 같은 code·details 스키마로 보고하므로 소비자 파싱 코드를 하나로 쓸 수 있습니다.
- Changed (**Breaking**): `@cp949/web-image-util/advanced`가 `ImageFormat` 타입을 더 이상 노출하지 않습니다. 같은 타입이 루트 진입점(`@cp949/web-image-util`)에 이미 존재하던 중복이었고, 이제 루트가 단독 소유합니다.
  - 마이그레이션은 import 경로 한 줄 변경입니다. `import type { ImageFormat } from '@cp949/web-image-util/advanced'` → `import type { ImageFormat } from '@cp949/web-image-util'`. 타입 정의는 바뀌지 않습니다.
  - `/advanced`의 값 export(`FORMAT_MIME_MAP`, `FormatDetector` 등)는 영향받지 않습니다.
- Changed (**Breaking**): Blob·File 결과 객체의 `toDataURL()`이 format을 지정하지 않으면 `toBlob()`과 같은 원본 MIME으로 변환합니다. 기존에는 `toBlob()`만 원본 MIME을 쓰고 `toDataURL()`은 항상 `image/png`를 써서, 같은 결과 객체의 두 출력이 서로 다른 포맷으로 갈렸습니다.
  - 대상은 `ResultBlob`·`ResultFile`을 돌려주는 경로입니다 — `processImage().toBlob()`/`toFile()`의 결과, `ensureBlobDetailed()`·`ensureFileDetailed()`의 결과, preset `createThumbnail()`·`createAvatar()`·`createSocialImage()`의 결과. 예를 들어 JPEG Blob에서 만들어진 결과의 `toDataURL()`이 `data:image/png;...`에서 `data:image/jpeg;...`로 바뀝니다.
  - 무옵션 `toDataURL()`은 원본 Blob·File 바이트를 직접 Data URL로 변환합니다. 따라서 Canvas가 인코딩하지 못하는 GIF·SVG 등의 MIME도 PNG로 폴백하지 않고 원본 MIME과 바이트를 보존합니다. `{ quality }` 또는 `{}`처럼 옵션 객체를 넘기면 기존처럼 Canvas로 재인코딩합니다.
  - 원본 `Blob.type`이 빈 문자열이면 브라우저의 `FileReader.readAsDataURL()` 규칙에 따라 Data URL 헤더는 `application/octet-stream`이 됩니다.
  - 이전 동작이 필요하면 `toDataURL({ format: 'png' })`처럼 format을 명시하세요. format을 지정한 호출의 동작은 바뀌지 않습니다.
  - Canvas·Element·Data URL 결과 객체는 영향받지 않습니다. 이전에도 `toBlob()`과 `toDataURL()` 모두 `image/png`를 기본값으로 썼습니다.
- Changed: `inspectSvgSanitization()`의 byte 초과 failure에 `details`(`{ actualBytes, maxBytes }`)가 추가되었습니다. `InspectSvgSanitizationFailure` 타입에 선택 필드 `details?`가 신설됩니다.
- Changed: 상대·절대 경로 참조(`./a.png`, `/a.png` 등)가 포함된 SVG의 기본 경로 처리 결과가 오류(`INVALID_SOURCE`)에서 "참조 제거 후 렌더링"으로 바뀌었습니다. 외부 `http(s)` URL과 같은 무해화 방식으로 통일한 것입니다.
- Changed: 경량 sanitizer의 외부 CSS `url()` 치환값이 `url(#invalid)`에서 `none`으로 통일되었습니다.
- Changed: `inspectSvgSanitization()`의 lightweight/skip 보고가 통일된 위협 정책을 따릅니다 — 상대 경로·빈 `href`·presentation 속성 CSS·DOCTYPE 절단이 stage로 보고됩니다.
- Changed: 첫 출력 이후에 호출한 `resize()`/`blur()`가 다음 출력에 반영됩니다. 기존에는 `resize()`/`blur()`는 조용히 무시되고 shortcut의 scale/exactWidth 계열만 반영되는 비대칭이 있었습니다.
- Changed: shortcut의 scale/exactWidth 계열도 호출 시점에 설정을 검증합니다. 예를 들어 `exactWidth(0)`은 출력 시점이 아니라 호출 즉시 `INVALID_DIMENSIONS`로 거부됩니다.
- Changed: `resize()` 중복 호출 오류 메시지가 경로별 3종에서 1종으로 통일되었습니다. 오류 코드 `MULTIPLE_RESIZE_NOT_ALLOWED`는 그대로입니다.
- Changed (**Breaking**): `fetchImageFormat()`이 원격 본문 가드를 거칩니다. 기존에는 형제 함수 `fetchImageSourceBlob()`과 달리 protocol 검사·중단·본문 상한을 모두 건너뛰고 global `fetch`를 직접 호출했습니다.
  - 기본 타임아웃 30초가 적용됩니다. 이전에는 응답하지 않는 서버에 요청이 무기한 매달렸습니다. `timeoutMs: 0`으로 이전 동작을 복원할 수 있습니다.
  - `fetchOptions.signal`이 무시되며 타입에서도 제거되었습니다. 중단은 새 옵션 `abortSignal`로 일원화됩니다.
  - `sniffBytes`가 `MAX_SNIFF_BYTES`(64KiB)로 제한됩니다. 더 큰 값을 지정해도 64KiB까지만 읽습니다. 바이너리 시그니처 판정에는 충분하지만, SVG 루트가 64KiB보다 긴 전치부 뒤에 있으면 Content-Type fallback 또는 `unknown`을 반환합니다.
  - 본문 스트림이 없는 응답에서 본문 전체를 메모리에 올린 뒤 자르던 동작이 제거되었습니다. 이제 스니핑을 건너뛰고 Content-Type만 사용합니다.
  - 명시적 스킴 또는 protocol-relative 입력은 `DEFAULT_ALLOWED_PROTOCOLS` 검사를 받습니다. 상대 경로는 종전대로 검사 없이 브라우저 자산 로딩 경로를 유지합니다. 판정 실패는 예외 없이 `'unknown'`으로 수렴하는 기존 계약 그대로입니다.
- Added: `fetchImageFormat()`에 `timeoutMs`·`abortSignal` 옵션이 추가되었습니다.
- Deprecated: `ResizeOperation`·`DirectResizeConfig` 타입과 `ScaleOperation` 별칭. shortcut 내부 통로가 공개 `resize()` 설정으로 합류하면서 처리 경로에서 사용되지 않습니다. `ScaleOperation` 대신 `ScaleValue`를 사용하세요.
- Changed (**Breaking**): `ProcessingStrategy`(`/advanced`의 `HighResolutionOptions.forceStrategy`·`ProcessingResult.strategy`)에서 `'chunked'`가 제거되었습니다. `chunkedAdapter`와 `tiledAdapter`가 둘 다 `TiledProcessor`를 호출하는 같은 실행기였고 차이는 옵션 프리셋뿐이었습니다 — 이제 `tiled` adapter가 `analysis.estimatedMemoryMB`(64MB 경계)로 그 프리셋을 내부에서 고릅니다. `forceStrategy: 'chunked'`를 쓰던 코드는 `'tiled'`로 바꾸세요.
  - 이 동치는 64MB 이하 이미지에서만 성립합니다. 64MB를 넘는 이미지는 동치가 아닙니다 — 이전에 `'chunked'`가 항상 주던 `tileSize: 2048`·`maxConcurrency: 2`·`timeMultiplier 1.0` 대신, 이제 heavy 프리셋(`tileSize` 미지정 → `TiledProcessor` 기본값 1024, `maxConcurrency: quality === 'fast' ? 4 : 2`, `timeMultiplier 2.0`)이 적용됩니다.
  - 이미 `forceStrategy: 'tiled'`를 쓰던 코드도 확인이 필요합니다. `'tiled'`는 여전히 유효한 값이라 컴파일은 그대로 통과하지만, 64MB 이하 이미지에서는 이전까지 항상 적용되던 heavy 프리셋 대신 light 프리셋이 조용히 선택됩니다 — `maxConcurrency`가 줄어들 수 있고(`quality: 'fast'` 기준 4→2), `tileSize`가 바뀌며(1024→2048), `estimatedTime` 배수도 낮아집니다(2.0→1.0).
- Changed: `AutoHighResProcessor`와 advanced 배치/단일 리사이즈 편의 함수(`fastResize`/`qualityResize`/`autoResize`/`ResizePerformance.*Batch`)가 내부적으로 쓰던 `SmartProcessor`를 걷어내고 `AutoHighResProcessor` 하나로 수렴했습니다. 공개 시그니처는 그대로입니다.
  - `fastResize`/`ResizePerformance.fastBatch`는 이제 내부적으로 `priority: 'speed'`를, `qualityResize`/`ResizePerformance.qualityBatch`는 `priority: 'quality'`를, `autoResize`는 `priority: 'balanced'`를 씁니다. 결과 이미지가 달라질 수 있습니다.
  - 단일 이미지 리사이즈(`fastResize`/`qualityResize`/`autoResize`)와 `ResizePerformance.*Batch`의 메모리 사용량 상한이 가용 메모리의 20%(동적)에서 `AutoHighResProcessor`의 정적 임계값(300MB, `priority:'quality'`는 450MB)으로 바뀝니다.
  - advanced `AutoHighResProcessor.smartResize()`의 옵션에 `forceStrategy`가 추가되었습니다(선택, 기본 미지정 — 기존 호출자는 영향 없습니다).
  - `fastResize`/`qualityResize`/`autoResize`/`ResizePerformance.*Batch`가 고해상도 처리 실패 시 예외를 던지는 대신 표준 처리 결과로 폴백합니다. 이전에는 모든 실패가 `PROCESSING_FAILED` 에러로 발생했습니다.
- Changed (**Breaking**): `SvgOptimizationOptions.mergeElements` 필드를 제거했습니다. 타입과 `SvgOptimizer.getDefaultOptions()`에만 존재했고 `SvgOptimizer.optimize()`의 어떤 단계도 읽지 않는 유령 필드였습니다. 이 필드를 명시적으로 채워 넘기던 객체 리터럴은 초과 속성 검사에 걸립니다 — 해당 줄을 지우세요.

### 수정

- Fixed: 같은 이미지가 진입점(`AutoHighResProcessor.smartResize()`/`smartResizeWithProgress()` vs `fastResize()`/`qualityResize()`/`autoResize()`/`ResizePerformance.*Batch`가 내부적으로 쓰는 `SmartProcessor`)에 따라 고해상도 처리 경로 진입 여부가 다르게 판정되던 문제를 수정합니다. 두 진입점이 이제 픽셀 수(8,000,000 초과)와 스케일 비율(다운스케일 4배 초과) 기준을 공유합니다.
  - `SmartProcessor`(`fastResize`/`qualityResize`/`autoResize`/배치 API) 쪽 픽셀 임계값이 4,000,000에서 8,000,000으로 상향됩니다. 4MP 초과 8MP 이하 이미지는 이제 표준 경로를 사용합니다.
  - `AutoHighResProcessor.smartResize()`(및 advanced `smartResize`/`smartResizeWithProgress` export) 쪽에 스케일 비율 조건이 새로 적용됩니다. 픽셀 수가 8MP 미만이어도 요청한 축소 비율이 4배를 초과하면 고해상도 경로를 사용합니다.
- Fixed: `AutoHighResProcessor.smartResize()`(및 `fastResize`/`qualityResize`/`autoResize`/`ResizePerformance.*Batch`)가 고해상도 처리 경로에 진입해도 내부적으로 항상 특정 전략을 강제해, `HighResolutionManager`의 실제 전략 선택 로직(메모리 압박 시 절약 전략, `priority:'quality'`의 scaleRatio 기반 stepped 선택 등)이 한 번도 실행되지 못하던 문제를 수정합니다.
  - `priority:'quality'`로 저픽셀+고스케일 이미지(예: scaleRatio 12.5)를 리사이즈하면 이제 실제로 stepped 전략을 쓸 수 있습니다. 이전에는 게이트를 통과해도 결국 `drawImage()` 1회로 귀결됐습니다.
  - 브라우저 메모리 압박이 높을 때(`performance.memory` 사용률 80% 초과) 고해상도 리사이즈가 이제 실제로 메모리 절약 전략(32MB 경계)으로 전환됩니다.
- Fixed: `HighResolutionManager`를 직접 쓰는 고급 소비자도 이제 메모리 압박 시(`CanvasPool.clear()`) 캔버스 풀 정리 혜택을 받습니다. 이전에는 `SmartProcessor` 경로(`fastResize`/`qualityResize`/`autoResize`/배치 API)에서만 트리거됐습니다.
- Fixed: 문자열 소스의 scheme·확장자 판정과 Blob/File의 MIME·파일명·본문 판정을 공통 facts 모듈로 통일했습니다. 대문자 `HTTP(S):`/`BLOB:` URL이 잘못된 로더로 분기되던 문제, 매개변수 포함 SVG MIME과 대문자 `.SVG` 파일명을 놓치던 문제를 수정했습니다. 공개 소스 판정 API의 MIME 우선 반환 계약은 유지됩니다.
- Fixed: Blob/File과 Blob URL의 모호한 MIME(`application/octet-stream`, `text/plain`, 빈 MIME, XML 계열)은 크기 상한 확인 후 첫 4KB를 스니핑해 실제 SVG를 복구합니다. 원격 HTTP 응답은 `image/svg+xml`, 표준 XML MIME, `+xml`, legacy XML external parsed entity MIME만 SVG 후보로 확장해 일반 octet-stream/text 응답을 SVG로 오인하지 않습니다.
- Fixed: `detectImageSourceInfo()`와 `detectImageStringSourceInfo()`가 인라인 SVG 문자열의 `format`을 `'unknown'` 대신 `'svg'`로 반환합니다. `type: 'inline-svg'`와 `isSvg: true`는 이전에도 같았고, `format`만 판정 결과와 어긋나 있었습니다. `blob:` URL의 `format`은 종전대로 `'unknown'`입니다 — Blob URL 문자열에 들어 있는 `.svg`는 실제 콘텐츠 타입의 근거가 아니기 때문입니다.
- Fixed: `getImageDimensions()`와 `getImageInfo()`가 SVG `Blob`/`File`에 대해서만 소스 크기 상한을 적용하지 않던 문제를 수정했습니다. 이 경로는 크기를 확인하지 않고 본문 전체를 텍스트로 읽고 있었습니다. 이제 다른 입력과 같은 상한(기본 100MB)을 적용합니다.
  - 상한을 넘는 SVG `Blob`의 치수 조회가 선언 치수 반환에서 `SOURCE_BYTES_EXCEEDED` 오류로 바뀝니다. 같은 크기의 다른 포맷은 이전에도 같은 오류를 냈으므로 동작이 일치하게 됩니다.
  - 상한 검사는 본문을 읽기 전에 수행합니다.
- Fixed: MIME이 비어 있거나 `text/xml`·`application/xml`인 SVG `Blob`의 치수 조회가 원본 선언 치수 대신 렌더링 경로를 타던 문제를 수정했습니다. 치수 조회와 이미지 변환이 이제 같은 판정 결과를 사용합니다.
- Fixed: `getImageFormat()`과 `getImageInfo()`가 `#`나 `?`가 들어간 `File` 이름에서 확장자를 놓치던 문제를 수정했습니다. 두 문자는 파일명에 쓸 수 있으므로 이제 이름 전체를 먼저 읽습니다(`사진#1.png` → `png`, `report?draft.webp` → `webp`).
  - SVG에서 결과가 달라집니다. `formatFromBytes`에 SVG 시그니처가 없어 이름 판정을 놓치면 바이트 폴백이 복구하지 못했습니다. `사진#1.svg` 같은 `File`의 `format`이 `'unknown'`에서 `'svg'`로 바뀝니다.
  - 다른 포맷은 바이트 시그니처로 복구되고 있었으므로 반환값이 아니라 불필요한 32바이트 읽기가 사라집니다.
  - URL에서 파생된 이름(`photo.png?v=1`, `icon.svg#symbol`)은 그대로 판정됩니다. 이름 전체에서 확장자를 찾지 못하면 쿼리·해시를 걷어내고 한 번 더 시도합니다.
- Fixed: `getImageFormat()`과 `getImageInfo()`가 호스트명 끝의 점 확장자를 이미지 확장자로 오독하던 문제를 수정했습니다. 경로가 비어 있고 호스트명만 확장자로 끝나는 입력의 `format`이 `'svg'`/`'png'`에서 `'unknown'`으로 바뀝니다(`https://ex.com.svg`, `//cdn.example.png`). 같은 문자열을 `detectImageSourceType()`은 이미 이미지 확장자로 보지 않았기 때문에, 한 번의 호출 안에서 두 판정이 어긋나 있었습니다.
  - 경로 확장자 → 포맷 매핑 구현이 두 벌이던 것을 URL 파싱 기반 한 벌로 통일한 결과입니다. 호스트와 경로를 구분하지 않던 문자열 절단 방식이 제거됩니다.
  - 경로에 확장자가 있는 정상 입력(`https://example.com/photo.webp?cache=1`, `photo.jpg`, `File.name`)의 결과는 바뀌지 않습니다.
- Fixed: 필터 레지스트리가 두 벌로 갈라질 수 있던 결함을 제거했습니다. 기존에는 모듈이 로드 시점의 싱글턴 인스턴스를 캡처하는 반면 인스턴스 슬롯을 비우면 이후 조회가 새 인스턴스를 만들어, 등록한 필터가 조회에서 보이지 않을 수 있었습니다. 레지스트리는 이제 모듈 내부 상태 하나뿐입니다.
- Fixed: strict 정책 진단이 빈 `href=""`를 보존으로 과소 보고하던 불일치를 수정했습니다. 실제 strict sanitizer는 빈 href 속성을 제거하며, 이제 진단도 제거 대상으로 셉니다.
- Fixed: `createAvatar()`의 `fit` 옵션이 무시되고 항상 `'cover'`로 처리되던 결함을 수정했습니다. 이제 `fit: 'contain'`/`'fill'`이 리사이즈에 반영되며, 미지정 시 기본값 `'cover'`는 그대로 유지됩니다.
- Fixed: advanced `AdvancedImageProcessor.processImage()`에서 `format: 'jpg'` 지정 시 비표준 MIME `image/jpg`로 인코딩을 시도해 브라우저가 PNG로 폴백하던 문제를 수정했습니다. 정본 포맷 테이블 경유로 `image/jpeg`로 인코딩합니다.
- Fixed: advanced 고해상도 처리에서 `quality: 'balanced'`(기본값)가 stepped/tiled 전략에 `'high'`로 강등 전달되어 의도된 medium 스무딩이 적용되지 않던 문제를 수정했습니다. `fast`의 스무딩 끔 동작도 tiled 결과 조립 단계까지 일관 적용됩니다.
- Fixed: advanced `TextWatermark.addRepeatingPattern()`이 `rotation`을 지정하면 캔버스를 고르게 덮지 못하던 문제를 수정했습니다. 회전은 캔버스 원점에 걸리는데 타일 루프 경계는 회전 전 좌표계를 따라, 회전된 프레임에서 순회 범위가 캔버스와 어긋났습니다. 이제 캔버스 네 꼭짓점을 역회전한 bounding box에서 루프 경계를 파생시킵니다.
  - 800×600 · spacing 200 · `rotation: -45` 기준 사분면 잉크 비율이 `3.8 / 3.8 / 1.9 / 1.7`(하단이 상단의 절반)에서 `3.3 / 3.2 / 3.2 / 3.2`로 바뀝니다.
  - `rotation: 90`·`135`처럼 타일이 전부 캔버스 밖으로 나가 워터마크가 아예 그려지지 않던 각도도 정상 렌더링됩니다.
  - `SimpleWatermark.addPattern()`은 기본값이 `rotation: -45`이므로 옵션을 주지 않아도 이 경로를 탑니다. `rotation`이 0이거나 미지정인 호출의 출력은 바뀌지 않습니다.
  - 커버리지를 채우면서 타일 수가 회전각에 따라 늘어납니다(위 기준에서 28개 → 48개).
- Fixed: advanced `TextWatermark.addRepeatingPattern()`·`ImageWatermark.addRepeatingPattern()`에 `spacing.x` 또는 `spacing.y`를 0 이하나 `NaN`/`Infinity`로 넘기면 타일 루프가 끝나지 않아 브라우저가 멈추던 문제를 수정했습니다. 이제 유한 양수가 아니면 `ImageProcessError`(`OPTION_INVALID`, `details.option`에 `spacing.x`/`spacing.y`)로 거부합니다. `SimpleWatermark.addPattern({ spacing: 0 })`으로도 도달할 수 있던 경로입니다.
- Fixed: advanced `TextWatermark.addToCanvas()`·`TextWatermark.addRepeatingPattern()`이 호출자 소유 Canvas의 2D 컨텍스트 상태를 되돌리지 않고 반환하던 문제를 수정했습니다. 텍스트 스타일 적용이 `save()`/`restore()` 범위 밖에 있어 호출 이후에도 `font`·`globalAlpha`·`fillStyle`·`strokeStyle`·`lineWidth`·`textBaseline`·`textAlign`이 워터마크 설정으로 남아, 같은 Canvas에 이어 그리는 코드가 영향을 받았습니다. 워터마크 출력 자체는 변하지 않습니다.
- Fixed: `HTMLImageElement` 디코드를 `src/utils/image-decode.internal.ts` 단일 모듈로 모으면서 실패 오류의 진단 정보가 더 정확해졌습니다.
  - SVG 로드 실패 메시지에서 `, error: [object Event]` 접미사가 사라집니다. `onerror` 핸들러가 받는 DOM `Event`를 문자열로 이어붙이던 코드였습니다.
  - `HTMLImageElement`를 직접 넘긴 소스, Canvas 소스의 로드 실패(`SOURCE_LOAD_FAILED`)와 `toElement()` 출력 실패(`IMAGE_LOAD_FAILED`)가 이제 `cause`를 채웁니다. 메시지와 코드는 그대로입니다.
  - 내부 유틸 `getBlobDimensions()`의 로드 실패가 plain `Error` 대신 `ImageProcessError`를 reject합니다. `ensureBlob`/`ensureFile` 등 공개 API는 이 실패를 `CONVERSION_FAILED`로 무조건 재래핑하므로, 소비자가 실제로 관찰하는 변화는 `error.cause`의 타입이 바뀌는 것뿐입니다.
- Fixed: `performance.memory`를 읽지 못하는 환경(Firefox/Safari, SSR, Node)에서 advanced `ResizePerformance.getMemoryInfo()`와 `ImageErrorHandler.collectEnhancedContext()`가 반환하던 메모리 fallback 값이 파일마다 다른 추측이던 것을 하나로 통일했습니다.
  - `ResizePerformance.getMemoryInfo()`의 fallback이 `{ usedMB: 0, limitMB: 0, pressureLevel: 'low' }`에서 `{ usedMB: 128, limitMB: 512, pressureLevel: 'low' }`로 바뀝니다.
  - `ImageErrorHandler.collectEnhancedContext()`가 이 환경에서도 이제 `debug.memoryUsedMB`/`memoryLimitMB`/`memoryPressure`를 채웁니다(이전에는 `debug` 필드 자체가 없었습니다).
  - `HighResolutionManager.smartResize()`가 반환하는 `memoryPeakUsageMB`의 fallback 값이 `performance.memory`를 읽지 못하는 환경에서 `64`에서 `128`로 바뀝니다.
  - `memoryPeakUsageMB`와 `onProgress` 콜백의 `memoryUsageMB`가 소수점 둘째 자리까지의 값 대신 정수 MB를 반환합니다. `performance.memory`를 읽지 못하는 fallback 환경과 실제로 읽는 환경(Chromium) 모두에 적용됩니다.
  - `onMemoryWarning` 발화 여부가 Chromium의 raw 가용 메모리 대신 반올림된 정수 MB를 기준으로 결정됩니다. 설정한 `maxMemoryUsageMB`의 ±0.5MB 경계에서만 결과가 달라질 수 있습니다.
- Fixed: `SvgOptimizer`의 기본 옵션(`removeMetadata: true`)이 `fill="url(#id)"`·`<use href="#id">` 등으로 참조되는 `id` 속성까지 무조건 제거해 렌더링이 깨지던 문제를 수정했습니다. 이제 참조되지 않는 `id`만 제거되며, 참조 여부는 `href`/`xlink:href`/`src`의 fragment 참조와 `fill`/`stroke`/`filter`/`clip-path`/`mask`/`marker-*`의 `url(#id)` 참조를 모두 판정합니다.
  - `removeUnusedDefs`가 `xlink:href="#id"` 참조를 놓쳐 사용 중인 `<defs>` 정의를 미사용으로 오판해 제거하던 2차 결함도 같은 수정으로 해소됩니다.
  - DOMParser를 쓸 수 없는 환경(순수 Node 등)에서는 참조 여부를 판정할 수 없으므로 이제 `id`를 하나도 제거하지 않습니다. 이전에는 이 환경에서도 무조건 전부 제거했습니다.

## [3.1.0] - 2026-08-12

### 추가

- Added: `composeImages(spec)` under `@cp949/web-image-util/advanced` — 레이어/그리드/콜라주 합성을 discriminated union spec 하나로 받는 진입점입니다. 반환 canvas는 호출자 소유입니다. grid는 `columns`만 받고 행 수를 파생해 이미지가 잘리지 않으며, `cover` fit은 셀 영역으로 클리핑됩니다. collage는 `scaleRange`/`maxRotation`/`allowOverlap`/`maxPlacementAttempts` 옵션과 `random` 난수 주입(결과 재현)을 지원합니다. 잘못된 spec은 canvas 생성 전에 `ImageProcessError`로 거부됩니다.
- Added: 문자열 입력 경로에서 Blob URL(`blob:`)을 지원합니다. `processImage()`와 문자열 변환 유틸은 fetch된 Blob의 MIME 타입을 기준으로 Blob/Data URL/File/Element 출력을 생성합니다.

### 변경

- Changed: canvas→Blob 인코딩 실패 오류를 `ImageProcessError`(code `CANVAS_TO_BLOB_FAILED`, 메시지 `Canvas to Blob conversion failed`)로 통일했습니다. 영향 표면: result 객체의 `toBlob()` 계열(기존 메시지 `Blob conversion failed`), `./advanced`의 `createAdvancedThumbnail`/`optimizeForSocial` Blob 폴백(기존 plain `Error`, 메시지 `Blob creation failed`), 변환 유틸의 canvas 인코딩 실패(기존 plain `Error`). tainted canvas 등 `canvas.toBlob()`의 동기 예외도 같은 오류로 래핑되며 원인은 `cause`에 보존됩니다.

### 수정

- Fixed: `blur(0)` 또는 `blur(n, { radius: 0 })`이 기본값 2px 블러로 대체되던 동작을 수정했습니다. 이제 radius 0은 블러 없음으로 처리되며, radius 미지정 시 기본값 2는 그대로 유지됩니다.
- Fixed: advanced 서브패스의 고해상도 처리(`HighResolutionManager.smartResize`, `autoSmartResize`, `smartResizeWithProgress`, `AdvancedImageProcessor`)가 항상 빈(또는 크기 0의) canvas를 반환하던 결함을 수정했습니다. 내부 Canvas Pool이 반환 직전에 canvas를 회수·초기화하면서 결과 픽셀이 지워지고, 연속 호출 시 이전 결과 canvas가 재사용되는 문제였습니다. 결과 canvas는 이제 pool을 거치지 않는 호출자 소유 canvas로 생성됩니다.

### 제거

- Removed: 내부 유틸 `copyCanvas`, `withMultipleManagedCanvas`, `TiledProcessor.processInTiles`, `LazyRenderPipeline.toBlob`을 제거했습니다. 모두 공개 API가 아니며 라이브러리 내부에서 사용되지 않았습니다.
- Removed: 내부 전용 `ImageComposer` static class를 제거했습니다. 공개 API가 아니었으며 `composeImages(spec)`가 대체합니다.

## [3.0.0] - 2026-06-04

### 추가

- Added: inspectSvg() under @cp949/web-image-util/utils — side-effect-free string SVG diagnostics returning report with environment, findings, and sanitizer recommendation.
- Added: inspectSvgSanitization() under @cp949/web-image-util/svg-sanitizer — side-effect-free sanitizer policy impact diagnostics returning stage counts for lightweight, strict, and skip policies. Embedded image stage codes absorb the RM-003 scope into the same report.
- Added: prefixSvgIds() under @cp949/web-image-util/utils — side-effect-free SVG id prefix utility with idempotent/collision detection and deopt-on-CSS policy.
- Added: inspectSvgSource() under @cp949/web-image-util/utils — async SVG source inspection covering string/Blob/File/URL with opt-in fetch and origin+path URL masking.

### 제거

- **BREAKING**: `convertToBlob` / `convertToDataURL` / `convertToFile` / `convertToElement`(및 각 `*Detailed`)를 제거했습니다. `ensure*` 계열(`ensureBlob` / `ensureDataURL` / `ensureFile` / `ensureImageElement`)로 대체하세요. `convertToElement`는 `ensureImageElement`와 동작이 동일하지만, 나머지 3쌍은 Blob 입력 시 `format`/`quality` 옵션을 무시하던 동작이 `ensure*`에서는 옵션을 적용하도록 바뀌었습니다.
- **BREAKING**: `ConvertToBlobOptions` 등 `ConvertTo*Options` 타입을 제거했습니다. 대응되는 `Ensure*Options` 타입을 사용하세요.

## [2.0.37] - 2026-05-05

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
