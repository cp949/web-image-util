# @cp949/web-image-util API reference

이 문서는 npm README에서 빠진 상세 API 목록을 정리합니다. 설치와 빠른 사용법은 [`sub/web-image-util/README.md`](../sub/web-image-util/README.md)를 참고하세요.

## Entry points

| 경로 | 용도 |
| --- | --- |
| `@cp949/web-image-util` | `processImage()`, 에러 타입, 브라우저 capability |
| `@cp949/web-image-util/presets` | `createThumbnail()`, `createAvatar()`, `createSocialImage()` |
| `@cp949/web-image-util/utils` | 이미지 정보, 포맷, Data URL, SVG 보조 유틸리티 |
| `@cp949/web-image-util/svg-sanitizer` | DOMPurify 기반 strict SVG sanitizer |
| `@cp949/web-image-util/filters` | 필터 플러그인 |
| `@cp949/web-image-util/advanced` | 고급 사용자용 저수준 API |

## `processImage()`

```typescript
function processImage(source: ImageSource, options?: ProcessorOptions): ImageProcessor;

interface ProcessorOptions {
  crossOrigin?: string;
  defaultQuality?: number;
  fetchTimeoutMs?: number;
  svgSanitizer?: 'lightweight' | 'strict' | 'skip';
}
```

`svgSanitizer`는 입력이 SVG로 판정된 경우에만 적용됩니다. 자세한 기준은 [`SVG-SECURITY.md`](../SVG-SECURITY.md)를 참고하세요.

## `ImageSource`

```typescript
type ImageSource = HTMLImageElement | Blob | File | ArrayBuffer | Uint8Array | string;
```

문자열 입력은 HTTP(S) URL, Data URL, SVG XML, 브라우저 경로를 자동 판별합니다.

## `ImageProcessor`

| 메서드 | 설명 |
| --- | --- |
| `.resize(config: ResizeConfig)` | 리사이즈 설정. 한 체인에서 한 번만 호출 가능 |
| `.blur(radius: number)` | blur 적용. 1~10 권장 |
| `.shortcut.*` | 자주 쓰는 리사이즈 패턴 |
| `.toBlob(options?)` | Blob 결과 반환 |
| `.toDataURL(options?)` | Data URL 결과 반환 |
| `.toFile(filename, options?)` | File 결과 반환 |
| `.toCanvas()` | `HTMLCanvasElement` 반환 |

### `ResizeConfig`

```typescript
interface ResizeConfig {
  fit: 'cover' | 'contain' | 'fill' | 'maxFit' | 'minFit';
  width?: number;
  height?: number;
  background?: string;
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number };
  withoutEnlargement?: boolean;
}
```

| fit 모드 | 설명 |
| --- | --- |
| `cover` | 비율을 유지하며 영역을 채우고 일부를 크롭할 수 있음 |
| `contain` | 비율을 유지하며 전체 이미지를 표시하고 여백을 둘 수 있음 |
| `fill` | 지정한 크기에 맞춰 비율을 변경할 수 있음 |
| `maxFit` | 지정한 최대 크기를 넘을 때만 축소 |
| `minFit` | 지정한 최소 크기보다 작을 때만 확대 |

## Output options

```typescript
interface OutputOptions {
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  quality?: number;
}
```

포맷별 기본 품질은 JPEG `0.85`, PNG `1.0`, WebP `0.8`입니다.

## Shortcut methods

| 메서드 | 설명 |
| --- | --- |
| `coverBox(w, h, opts?)` | 박스를 가득 채움 |
| `containBox(w, h, opts?)` | 박스 안에 전체 이미지 맞춤 |
| `exactSize(w, h)` | 정확한 크기로 변환 (`fit: 'fill'`) |
| `maxWidth(n)` / `maxHeight(n)` | 한쪽 최대 크기 제한 |
| `maxSize({ width?, height? })` | 최대 크기 제한 |
| `minWidth(n)` / `minHeight(n)` | 한쪽 최소 크기 보장 |
| `minSize({ width?, height? })` | 최소 크기 보장 |
| `scale(n)` / `scale({ sx?, sy? })` | 원본 크기 기준 스케일 |
| `scaleX(n)` / `scaleY(n)` / `scaleXY(sx, sy)` | 축별 스케일 |
| `exactWidth(n)` / `exactHeight(n)` | 한쪽 치수만 지정하고 다른 축은 비율 유지 |

`coverBox()`와 `containBox()` 옵션은 `padding`, `background`, `withoutEnlargement`를 지원합니다.

## Presets

```typescript
import { createAvatar, createSocialImage, createThumbnail } from '@cp949/web-image-util/presets';
```

| 함수 | 설명 |
| --- | --- |
| `createThumbnail(source, options)` | 썸네일 생성 |
| `createAvatar(source, options)` | 정사각형 아바타 생성 |
| `createSocialImage(source, options)` | 소셜 플랫폼 크기 이미지 생성 |

`createSocialImage()` 지원 플랫폼은 `twitter`, `facebook`, `instagram`, `linkedin`, `youtube`, `pinterest`입니다.

## Utility catalog

`@cp949/web-image-util/utils`:

| 분류 | Export |
| --- | --- |
| 이미지 정보 | `getImageDimensions`, `getImageInfo`, `getImageFormat`, `fetchImageFormat`, `getImageAspectRatio`, `getImageOrientation`, `hasTransparency` |
| SVG 판정/정제/보정 | `isInlineSvg`, `sanitizeSvgForRendering`, `sanitizeSvg`(deprecated), `enhanceSvgForBrowser`, `enhanceBrowserCompatibility`, `extractSvgDimensions`, `decodeSvgDataURL` |
| 소스 판정 | `detectImageSourceType`, `detectImageSourceInfo`, `detectImageStringSourceType`, `detectImageStringSourceInfo` |
| Data URL | `isDataURLString`, `blobToDataURL`, `dataURLToBlob`, `estimateDataURLSize`, `estimateDataURLPayloadByteLength` |
| 포맷/MIME/파일명 | `formatToMimeType`, `mimeTypeToImageFormat`, `mimeTypeToOutputFormat`, `isSupportedOutputFormat`, `replaceImageExtension`, `getOutputFilename`, `resolveOutputFormat` |
| 변환/보장 | `convertToBlob`, `convertToBlobDetailed`, `convertToDataURL`, `convertToDataURLDetailed`, `convertToFile`, `convertToFileDetailed`, `convertToElement`, `ensureBlob`, `ensureBlobDetailed`, `ensureDataURL`, `ensureDataURLDetailed`, `ensureFile`, `ensureFileDetailed` |
| fetch 보조 | `fetchImageSourceBlob` |

## Root exports

`@cp949/web-image-util`:

- `processImage`
- `unsafe_processImage`
- `ImageProcessError`
- `analyzeSvgComplexity`
- `extractSvgDimensions`
- `detectBrowserCapabilities`
- `detectSyncCapabilities`
- `features` (deprecated)

## SVG sanitizer exports

`@cp949/web-image-util/svg-sanitizer`:

- `sanitizeSvgStrict`
- `sanitizeSvgStrictDetailed`

```typescript
import { sanitizeSvgStrictDetailed } from '@cp949/web-image-util/svg-sanitizer';

const { svg, warnings } = sanitizeSvgStrictDetailed(untrustedSvg, {
  maxBytes: 10_485_760,
  maxNodeCount: 10_000,
  removeMetadata: true,
});
```

## Filters

`@cp949/web-image-util/filters`는 `initializeFilterSystem`과 필터 플러그인을 제공합니다. import만으로는 전역 상태가 변경되지 않으며, 사용 전 `initializeFilterSystem()`을 명시적으로 호출해야 합니다.

## Error handling

```typescript
class ImageProcessError extends Error {
  code: ImageErrorCodeType;
  originalError?: Error;
  suggestions: string[];
}
```

| 분류 | 코드 |
| --- | --- |
| 소스 | `INVALID_SOURCE`, `UNSUPPORTED_FORMAT`, `SOURCE_LOAD_FAILED`, `SOURCE_BYTES_EXCEEDED` |
| 처리 | `CANVAS_CREATION_FAILED`, `CANVAS_CONTEXT_FAILED`, `CANVAS_CONTEXT_ERROR`, `RESIZE_FAILED`, `BLUR_FAILED`, `CONVERSION_FAILED`, `PROCESSING_FAILED`, `SMART_RESIZE_FAILED`, `MULTIPLE_RESIZE_NOT_ALLOWED` |
| 크기 | `INVALID_DIMENSIONS`, `DIMENSION_TOO_LARGE` |
| 시스템 | `MEMORY_ERROR`, `TIMEOUT_ERROR` |
| SVG | `SVG_LOAD_FAILED`, `SVG_PROCESSING_FAILED` |
| 출력 | `OUTPUT_FAILED`, `DOWNLOAD_FAILED`, `FILE_TOO_LARGE`, `CANVAS_TO_BLOB_FAILED`, `IMAGE_LOAD_FAILED`, `BLOB_TO_ARRAYBUFFER_FAILED` |
| 호환성 | `BROWSER_NOT_SUPPORTED` |

## Browser capabilities

```typescript
import { detectBrowserCapabilities, detectSyncCapabilities } from '@cp949/web-image-util';

const asyncCaps = await detectBrowserCapabilities();
const syncCaps = detectSyncCapabilities();
```

`detectBrowserCapabilities()`는 WebP/AVIF처럼 비동기 확인이 필요한 capability를 포함합니다. `detectSyncCapabilities()`는 즉시 감지 가능한 항목만 반환합니다.
