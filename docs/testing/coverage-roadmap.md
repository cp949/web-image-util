# 테스트 커버리지 로드맵

`@cp949/web-image-util`의 테스트 커버리지를 *리팩토링 안정망* 관점에서 늘리기 위한 안내. 행동 테스트를 우선하고, 측정으로 빈 분기를 보충한다.

새 테스트 작성 시의 *행동 vs 단위* 결정 규칙은 [TESTING-GUIDE.md](../../sub/web-image-util/tests/TESTING-GUIDE.md#테스트-종류-결정--행동-vs-단위)를 참조한다.

## 재측정 방법

```bash
pnpm --filter @cp949/web-image-util test:coverage
```

- 콘솔 요약과 `sub/web-image-util/coverage/index.html`로 결과를 확인한다.
- 이 문서에 *구체 수치를 박제하지 않는다.* 베이스라인은 시점 스냅샷일 뿐이고, 시간이 지나면 신선도가 떨어진다. 대신 "어디가 비어있는지의 라벨"만 우선순위 표(아래)에 정성적으로 기록한다.
- 새 공개 API가 추가되면 같은 PR에서 *공개 API 행동 인벤토리*(아래) 행도 함께 추가한다.

## 공개 API 행동 인벤토리

라이브러리가 외부에 노출하는 *호출 가능한 표면*을 한 곳에 모아 둔다. "기존 테스트" 열은 *입출력/부수효과를 검증하는 행동 테스트*가 있는지만 본다. 컨트랙트(존재 여부) 테스트만 있고 동작 검증이 없으면 `없음`, 일부 케이스만 다루면 `부분`으로 표기한다.

| 표면 | 항목 | 보장되는 행동 | 기존 테스트 | 비고 |
| --- | --- | --- | --- | --- |
| `index.ts` | `processImage(src, options?)` | `ImageSource` → `ImageProcessor` 체이닝 인스턴스 (resize/blur/출력 메서드 노출) | 있음 | `tests/unit/processor/processor-resize/chaining-jsdom.test.ts`, `tests/contract/runtime-contract.test.ts` |
| `index.ts` | `processImage().resize(config)` | `ResizeConfig` 누적 후 후속 체이닝 가능, 두 번째 호출 시 타입/런타임 에러 | 있음 | `tests/unit/processor/processor-resize/fit-modes-jsdom.test.ts`, `multiple-resize-guard-jsdom.test.ts` |
| `index.ts` | `processImage().blur(radius?, options?)` | 블러 효과 누적 후 후속 체이닝 가능 | 있음 | `tests/unit/processor/processor-resize/blur-output-jsdom.test.ts` (출력까지 행동 검증·다중 누적·radius 경계값), `chaining-jsdom.test.ts` |
| `index.ts` | `processImage().resize().toBlob(format?, quality?)` | 입력 src + ResizeConfig → 지정 포맷 MIME Blob (포맷 미지정 시 추론, AVIF 미지원 시 fallback) | 있음 | `tests/unit/processor/processor-resize/output-formats-jsdom.test.ts` |
| `index.ts` | `processImage().resize().toDataURL(format?, quality?)` | 입력 src + ResizeConfig → 지정 포맷 Data URL 문자열 | 있음 | `tests/unit/processor/processor-resize/output-formats-jsdom.test.ts` |
| `index.ts` | `processImage().resize().toFile(filename, format?, quality?)` | 입력 src + ResizeConfig → 지정 파일명/MIME의 `File` 객체 (파일명 확장자는 명시 포맷에 맞춰 정규화) | 있음 | `tests/unit/processor/processor-resize/to-file-jsdom.test.ts` (파일명 포맷 추론·명시 옵션 우선·quality 전달) |
| `index.ts` | `processImage().resize().toCanvas()` | 입력 src + ResizeConfig → 사용자 소유 `HTMLCanvasElement` (풀에 반환 안 함) | 있음 | `tests/unit/processor/processor-resize/output-formats-jsdom.test.ts` |
| `index.ts` | `processImage().resize().toCanvasDetailed()` | 입력 src + ResizeConfig → Canvas + 메타데이터 객체 (풀에 반환 안 함) | 있음 | `tests/unit/processor/processor-resize/to-canvas-detailed-jsdom.test.ts` (메타데이터·풀 미반환·`toCanvas()` 동치) |
| `index.ts` | `processImage().toElement()` | 출력 Blob을 `HTMLImageElement`로 디코드 (object URL 정리 포함) | 있음 | `tests/unit/processor/to-element-output-jsdom.test.ts` (정상 경로 반환 형태·`createObjectURL` 호출 계약·체이닝 도달성), `to-element-cleanup.test.ts` (cleanup 검증) |
| `index.ts` | `unsafe_processImage(src, options?)` | strict sanitize 없이 동일 체이닝 API 반환 (위험 신뢰 입력 전용) | 있음 | `tests/unit/processor/unsafe-process-image/error-handling-jsdom.test.ts`, `export-contract.test.ts` |
| `index.ts` | `ImageProcessor` (클래스 export) | 직접 인스턴스화 또는 타입 참조 진입점 | 없음 | 컨트랙트 export만 검증 |
| `index.ts` | `createThumbnail(src, options)` | src + 크기/포맷/품질 → cover/contain fit의 썸네일 Blob (포맷 미지정 시 WebP→JPEG fallback) | 있음 | `tests/unit/presets/presets-jsdom.test.ts` |
| `index.ts` | `createAvatar(src, options?)` | src + size → 정사각형 PNG/WebP 아바타 Blob (기본 64px, 투명 배경) | 있음 | `tests/unit/presets/presets-jsdom.test.ts` |
| `index.ts` | `createSocialImage(src, options)` | src + 플랫폼 또는 customSize → 플랫폼 권장 크기 Blob (contain fit, 기본 JPEG) | 있음 | `tests/unit/presets/presets-jsdom.test.ts` |
| `index.ts` | `ShortcutBuilder` / `processImage().shortcut.*` | exactSize/maxWidth/maxHeight/minWidth/minHeight/exactWidth/exactHeight/scale/scaleX/scaleY/scaleXY → 해당 ResizeConfig 적용 후 체이닝 반환 | 있음 | `tests/shortcut/shortcut-integration.test.ts`, `shortcut-types.test.ts` |
| `index.ts` | `analyzeSvgComplexity(svg)` | SVG 문자열 → 복잡도 메트릭 객체 (노드 수, 깊이, 그라디언트 등) | 있음 | `tests/unit/core/svg-complexity-analyzer.test.ts` |
| `index.ts` | `enhanceSvgForBrowser(svg, options?)` / `enhanceBrowserCompatibility(svg)` | SVG 문자열 → 브라우저 호환성 보강된 SVG + 리포트 | 있음 | `tests/unit/utils/svg-compatibility.test.ts` |
| `index.ts` | `extractSvgDimensions(svg)` | SVG 문자열 → `{ width, height }` 추론 결과 (viewBox/속성/스타일) | 있음 | `tests/unit/utils/svg-dimensions.test.ts` |
| `index.ts` | `sanitizeSvg` / `sanitizeSvgForRendering` (deprecated alias) | SVG 문자열 → 경량 정제된 SVG (script/foreignObject/외부 참조 제거) | 있음 | `tests/security/svg-sanitizer-core.test.ts`, `tests/security/svg-inline-sanitization/**` |
| `index.ts` | `detectBrowserCapabilities()` / `detectFormatSupport()` / `detectSyncCapabilities()` | 브라우저 환경 → 포맷/기능 지원 객체 (캐시 포함) | 있음 | `tests/unit/utils/browser-capabilities/detector.test.ts`, `ssr-safety.test.ts` |
| `index.ts` | `getCachedBrowserCapabilities()` / `getCachedFormatSupport()` / `getOptimalProcessingMode()` / `analyzePerformanceFeatures()` | 캐시/우선순위 평가 결과 반환 | 부분 | `tests/unit/utils/browser-capabilities/**` (일부 함수만 검증) |
| `index.ts` | `features` (deprecated 동기 퍼사드) | `.webp`/`.avif`/`.offscreenCanvas`/`.imageBitmap` → 동기 boolean | 있음 | `tests/unit/utils/browser-capabilities/features-facade.test.ts` |
| `index.ts` | `ensureBlob` / `ensureDataURL` / `ensureFile` / `ensureImageElement` (+ `*Detailed`) | 이미지 입력이 해당 포맷이 아닐 때만 변환, 같은 포맷이면 그대로 통과 | 부분 | `tests/unit/utils/converters-quality-canvas.test.ts`, `tests/security/svg-size-limits-jsdom.test.ts` (일부) |
| `index.ts` | `blobToDataURL` / `dataURLToBlob` / `decodeSvgDataURL` / `estimateDataURLPayloadByteLength` / `estimateDataURLSize` / `isDataURLString` | Blob ↔ Data URL 순수 변환 및 크기 추정 | 있음 | `tests/unit/utils/data-url.test.ts` |
| `index.ts` | `detectImageSourceType` / `detectImageSourceInfo` / `detectImageStringSourceType` / `detectImageStringSourceInfo` | 입력 → 소스 타입 분류 결과 | 있음 | `tests/unit/utils/source-utils.test.ts` |
| `index.ts` | `getImageInfo` / `getImageDimensions` / `getImageAspectRatio` / `getImageFormat` / `getImageOrientation` / `fetchImageFormat` / `fetchImageSourceBlob` | 소스 → 치수/포맷/orientation/원본 Blob 메타 | 있음 | `tests/unit/utils/image-info/**` |
| `index.ts` | `formatToMimeType` / `mimeTypeToImageFormat` / `mimeTypeToOutputFormat` / `resolveOutputFormat` / `getOutputFilename` / `replaceImageExtension` / `isSupportedOutputFormat` | 포맷/MIME/파일명 변환 | 있음 | `tests/unit/utils/format-utils.test.ts` |
| `index.ts` | `isInlineSvg(input)` | 문자열 → 인라인 SVG 여부 boolean (XML preamble/공백 허용) | 있음 | `tests/unit/utils/svg-detection.test.ts`, `tests/security/source-type-detection.test.ts` |
| `index.ts` | `hasTransparency(source, options?)` | Canvas/이미지 → alpha 채널 샘플링 후 투명 픽셀 존재 boolean | 있음 | `tests/unit/utils/image-inspection.test.ts` |
| `index.ts` | `ImageProcessError` / `ImageErrorCode` / `OPTIMAL_QUALITY_BY_FORMAT` | 에러 클래스 생성 및 코드 매핑 | 있음 | `tests/unit/errors/error-class.test.ts` |
| `/advanced` | `AdvancedImageProcessor.processImage` / `.batchProcess` | resize + filter + watermark + format auto 묶음 처리 → `{ canvas, blob, stats }` | 부분 | `tests/unit/core/smart-processor.test.ts` (일부 시나리오) |
| `/advanced` | `smartResize` / `processWithFilters` / `addWatermarkAndOptimize` (advanced-processor convenience) | 단계별 advanced 편의 함수 | 없음 | 직접 호출 행동 테스트 부재 (`grep` 결과 expected-public-exports만) |
| `/advanced` | `AutoHighResProcessor` / `autoSmartResize` / `smartResizeWithProgress` | 고해상도 입력 → 메모리 안전한 단계적 다운스케일 결과 | 있음 | `tests/unit/core/auto-high-res.test.ts` |
| `/advanced` | `BatchResizer` | 다중 입력 → 일괄 리사이즈 결과 배열 | 있음 | `tests/unit/core/batch-resizer.test.ts` |
| `/advanced` | `SmartFormatSelector` / `autoOptimize` / `optimizeForWeb` / `optimizeForThumbnail` / `ImagePurpose` | 입력 + 용도 → 권장 포맷/품질 결정 | 있음 | `tests/unit/core/smart-format.test.ts` |
| `/advanced` | `fastResize` / `qualityResize` / `autoResize` / `ResizePerformance` / `getPerformanceConfig` / `RESIZE_PROFILES` | 성능 우선순위 프리셋 적용 결과 | 있음 | `tests/unit/core/performance-utils.test.ts`, `performance-config.test.ts` |
| `/advanced` | `addTextWatermark` / `addImageWatermark` / `addCopyright` / `SimpleWatermark` | 이미지 + 텍스트/이미지 워터마크 옵션 → 워터마크 합성된 Canvas/Blob | 있음 | `tests/unit/composition/watermark-convenience.test.ts`, `watermark-text.test.ts` |
| `/advanced` | `TextWatermark` / `ImageWatermark` (세밀 제어 클래스) | 워터마크 위치/스타일 세밀 제어 | 부분 | `tests/unit/composition/watermark-text.test.ts` (텍스트만) |
| `/advanced` | `filterManager` / `registerFilter` / `applyFilter` / `applyFilterChain` / `getAvailableFilters` / `FilterCategory` | 필터 플러그인 등록/조회/적용 | 있음 | `tests/unit/filters/plugin-system-manager.test.ts`, `plugin-system-application.test.ts`, `plugin-system-convenience.test.ts` |
| `/advanced` | `createAdvancedThumbnail` / `optimizeForSocial` / `batchOptimize` (advanced-index convenience) | 묶음 시나리오용 편의 함수 | 부분 | `tests/unit/core/advanced-filter-initialization-jsdom.test.ts` (등록되지 않은 필터 거부 sad-path만) |
| `/advanced` | `FormatDetector` / `FORMAT_MIME_MAP` | MIME ↔ 포맷 매핑 및 감지 | 있음 | `tests/unit/base/format-detector.test.ts` |
| `/advanced` | `HighResolutionManager` | 고해상도 처리 수동 제어 진입점 | 부분 | `tests/unit/core/auto-high-res.test.ts` (자동 흐름만) |
| `/advanced` | `ImageErrorHandler` / `globalErrorHandler` / `withErrorHandling` / `createAndHandleError` / `createQuickError` / `getErrorStats` | 에러 통계 누적/래핑 | 있음 | `tests/unit/base/error-helpers.test.ts`, `tests/unit/core/error-handler.test.ts` |
| `/advanced` | `initializeFilterSystem()` | 호출 시 기본 필터(blur/color/effect) 모두 `filterManager`에 등록 | 있음 | `tests/unit/filters/filter-init.test.ts`, `tests/unit/core/advanced-filter-initialization-jsdom.test.ts` |
| `/advanced` | `createFilterPlugin(config)` | 입력 config → 표준 `FilterPlugin` 객체 (preview = apply 기본값) | 없음 | 행동 테스트 부재 |
| `/advanced` | `getAdvancedFeatureInfo()` | 환경 → 기능 가용성 정보 객체 | 없음 | 행동 테스트 부재 |
| `/advanced` | `AllFilterPlugins` / `registerDefaultFilters` / `BlurFilterPlugins` / `ColorFilterPlugins` / `EffectFilterPlugins` | 카테고리별 기본 필터 플러그인 배열 export | 있음 | `tests/unit/filters/blur-plugins.test.ts`, `color-plugins.test.ts`, `effect-plugins.test.ts` |
| `/presets` | `createThumbnail` / `createAvatar` / `createSocialImage` | (메인과 동일 — 서브패스 export) | 있음 | `tests/unit/presets/presets-jsdom.test.ts` |
| `/utils` | (메인 `index.ts`와 동일 utility 집합) | 메인 export와 동일 동작 | 있음 | 메인 entry 행 참조 |
| `/utils` | `inspectSvg(svg, options?)` | SVG 문자열 → `finding[]`/`recommendation[]` 진단 리포트 (부수효과 없음) | 있음 | `tests/unit/utils/inspect-svg.test.ts`, `inspect-svg-leakage.test.ts`, `inspect-svg-parse-boundary.test.ts`, `inspect-svg-analysis.test.ts` |
| `/utils` | `inspectSvgSource(input, options?)` | SVG 후보 입력(문자열/Blob/URL) → source kind/finding 리포트 (기본 네트워크 차단) | 있음 | `tests/unit/utils/inspect-svg-source.test.ts`, `inspect-svg-source-fetch*.test.ts`, `inspect-svg-source-sniffing.test.ts` |
| `/utils` | `prefixSvgIds(svg, prefix)` | SVG 문자열 → id 속성 및 같은 문서 fragment 참조에 prefix 적용된 결과 | 있음 | `tests/unit/utils/prefix-svg-ids-leakage.test.ts` |
| `/utils` | `SvgOptimizer` | SVG 입력 → 벡터 최적화 결과 (크기 축소 리포트 포함) | 있음 | `tests/unit/utils/svg-optimizer.test.ts` |
| `/filters` | `AllFilterPlugins` / `BlurFilterPlugins` / `ColorFilterPlugins` / `EffectFilterPlugins` / `registerDefaultFilters` / `initializeFilterSystem` | (`/advanced` 동일 export 재노출) | 있음 | 위 `/advanced` 필터 플러그인 행 참조 |
| `/svg-sanitizer` | `sanitizeSvgStrict(svg, options?)` | SVG 문자열 → DOMPurify strict 정책으로 정제된 SVG 문자열, 위반(타입/크기/노드 한도) 시 에러 | 있음 | `tests/security/strict-svg-sanitizer.test.ts`, `tests/unit/types/strict-svg-sanitizer-types.test.ts` |
| `/svg-sanitizer` | `sanitizeSvgStrictDetailed(svg, options?)` | `sanitizeSvgStrict`와 동일 + 경고 목록 포함 객체 반환 | 있음 | `tests/security/strict-svg-sanitizer.test.ts` |
| `/svg-sanitizer` | `inspectSvgSanitization(svg, options?)` | SVG 문자열 → lightweight/strict 단계별 정제 영향 리포트 (failure 코드 포함) | 있음 | `tests/unit/svg-sanitizer/inspect-sanitization.test.ts`, `inspect-sanitization-stages.test.ts`, `inspect-sanitization-failures.test.ts`, `inspect-sanitization-leakage.test.ts`, `inspect-sanitization-embedded-images.test.ts` |

## 우선순위 목록

| 영역 | 베이스라인 커버 | 추천 테스트 종류 | 의도 | 우선순위 |
| --- | --- | --- | --- | --- |
| `/advanced` `HighResolutionManager` 수동 제어 진입점 + `base/high-res-manager.ts` 분기 (~478줄 누락) | 중간 (자동 흐름만) | 행동 | 회귀 방지 | 중간 |
| `/advanced` `createFilterPlugin(config)` 행동 (preview = apply 기본값 등) | 낮음 (행동 없음) | 행동 | 회귀 방지 | 중간 |
| `/advanced` `getAdvancedFeatureInfo()` 환경별 반환 | 낮음 (행동 없음) | 행동 | 회귀 방지 | 낮음 |
| `ImageProcessor` 클래스 직접 인스턴스화/타입 참조 진입점 | 낮음 (컨트랙트만) | 행동 | 회귀 방지 | 낮음 |
| `errors.ts` / `core/error-handler.ts` 분기 (error code 매핑, cause 보존 분기) | 중간 (stmt 100 / branch 50) | 단위 | 분기 보충 | 중간 |
| `core/internal/internal-high-res-processor.ts` 분기 (~480줄 누락, 내부 타일링 경로) | 낮음 (branch 0) | 단위 | 분기 보충 | 중간 |
| `core/advanced-processor.ts` 분기 (~427줄 누락, 내부 advanced 파이프라인) | 낮음 (branch 0) | 단위 | 분기 보충 | 중간 |
| `base/image-common.ts` 분기 (~370줄 누락) | 낮음 (0/0/0/0) | 단위 | 분기 보충 | 중간 |
| `base/canvas-utils.ts` / `base/stepped-processor.ts` 분기 | 낮음 (stmt 26 / branch 9, branch 4.76) | 단위 | 분기 보충 | 낮음 |
| `types/guards.ts` / `types/result-implementations.ts` 분기 (런타임 타입 가드) | 낮음 (branch 0) | 단위 | 분기 보충 | 낮음 |
| `utils/svg-optimizer/{optimize-gradients,remove-unused-defs,simplify-paths}.ts` 분기 (`SvgOptimizer` 공개 표면의 내부 최적화 패스) | 낮음 (stmt 14–28) | 단위 | 분기 보충 | 낮음 |
| `utils/svg-compatibility/{internal,bbox/live,bbox/heuristic}.ts` 분기 (`enhanceSvgForBrowser` 내부 헬퍼) | 낮음 (0/0/0/0 또는 stmt 45) | 단위 | 분기 보충 | 낮음 |

표 행은 위에서 아래로 우선순위 순. 새 작업을 만들 때 *높음* 행부터 묶어서 진행한다. 한 행이 너무 크면 분할하고, 너무 작으면 인접 행과 묶는다. 새 행을 추가할 때는 이 표의 5개 컬럼을 모두 채운다.

표의 각 행은 *남은 일*만 표시한다. PLAN의 TASK가 머지되어 해당 행의 의도가 달성되면 그 행을 표에서 삭제한다. 완료 이력은 git log/blame이 보관소이며, 별도의 상태 컬럼이나 완료 표시를 두지 않는다. 잘못 삭제했을 때는 `pnpm --filter @cp949/web-image-util test:coverage`를 다시 돌려 빈 영역을 식별 후 행을 재추가한다.
