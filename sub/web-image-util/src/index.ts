/**
 * @cp949/web-image-util - Browser Image Processing Library
 *
 * @description
 * High-performance TypeScript library for client-side image processing in web browsers.
 * Built on Canvas 2D API with Sharp-inspired API design for familiar server-side patterns.
 *
 * **🎯 Core Features:**
 * - **Type-Safe API**: Full TypeScript support with discriminated union types
 * - **Method Chaining**: Intuitive `processImage().resize().blur().toBlob()` pattern
 * - **Multiple Source Types**: HTMLImageElement, Blob, URL, Data URL, SVG XML, ArrayBuffer
 * - **Smart Format Selection**: WebP → PNG fallback based on browser support
 * - **SVG Excellence**: Advanced SVG processing with browser compatibility enhancements
 * - **Performance Optimized**: Lazy rendering pipeline, memory-efficient processing
 *
 * **🚀 Quick Start:**
 * ```typescript
 * import { processImage } from '@cp949/web-image-util';
 *
 * // Basic resizing
 * const thumbnail = await processImage(imageFile)
 *   .resize({ fit: 'cover', width: 300, height: 200 })
 *   .toBlob();
 * ```
 *
 * **📦 Main Exports:**
 * - `processImage()` - Primary processing function (recommended entry point)
 * - `createThumbnail()`, `createAvatar()`, `createSocialImage()` - Convenience presets
 * - `enhanceSvgForBrowser()` - SVG compatibility utilities
 * - Type definitions for complete TypeScript integration
 *
 * **🌐 Browser Support:**
 * - Modern browsers with Canvas 2D API support
 * - Graceful degradation for format support (WebP, AVIF)
 * - Cross-origin image handling with CORS configuration
 *
 * @example Basic Image Processing
 * ```typescript
 * import { processImage } from '@cp949/web-image-util';
 *
 * // Simple thumbnail creation
 * const thumbnail = await processImage(source)
 *   .resize({ fit: 'cover', width: 300, height: 200 })
 *   .toBlob();
 *
 * // High-quality processing with blur
 * const result = await processImage(source)
 *   .resize({ fit: 'contain', width: 800, height: 600, background: '#ffffff' })
 *   .blur(2)
 *   .toBlob({ format: 'webp', quality: 0.9 });
 * ```
 *
 * @example Multiple Source Types
 * ```typescript
 * // From file input
 * const fileInput = document.querySelector('input[type="file"]');
 * const file = fileInput.files[0];
 * await processImage(file).resize({ fit: 'cover', width: 400, height: 300 }).toBlob();
 *
 * // From URL
 * await processImage('https://example.com/image.jpg')
 *   .resize({ fit: 'contain', width: 500, height: 500 })
 *   .toBlob();
 *
 * // From SVG string
 * const svgString = '<svg>...</svg>';
 * await processImage(svgString).resize({ fit: 'cover', width: 200, height: 200 }).toBlob();
 *
 * // From Canvas element
 * const canvas = document.querySelector('canvas');
 * await processImage(canvas).resize({ fit: 'fill', width: 300, height: 200 }).toBlob();
 * ```
 *
 * @example Convenience Functions
 * ```typescript
 * import { createThumbnail, createAvatar, createSocialImage } from '@cp949/web-image-util';
 *
 * // Optimized thumbnail (WebP, cover fit, quality 0.8)
 * const thumb = await createThumbnail(source, { width: 150, height: 150 });
 *
 * // Square avatar (PNG, high quality)
 * const avatar = await createAvatar(source, { size: 200 });
 *
 * // Social media image (platform-optimized dimensions)
 * const social = await createSocialImage(source, { platform: 'twitter' });
 * ```
 */

// browser-capabilities 모듈의 단일 감지 경로를 features 퍼사드에서 재사용한다
import {
  detectCanvasFormatSupport as _detectCanvasFormatSupport,
  detectSyncCapabilities as _detectSyncCapabilities,
  getCachedBrowserCapabilities as _getCachedBrowserCapabilities,
  getCachedFormatSupport as _getCachedFormatSupport,
} from './utils/browser-capabilities';

// SVG complexity analysis
export { analyzeSvgComplexity } from './core/svg-complexity-analyzer';
export type { AvatarOptions, SocialImageOptions, SocialPlatform, ThumbnailOptions } from './presets';

// Convenience features
export { createAvatar, createSocialImage, createThumbnail } from './presets';
// Core API
export { ImageProcessor, processImage, unsafe_processImage } from './processor';
// Shortcut API
export { ShortcutBuilder } from './shortcut';
// Type definitions
export type {
  BlurOptions,
  ComplexityAnalysisResult,
  ContainConfig,
  // ResizeConfig sub-types (for explicit type specification)
  CoverConfig,
  FillConfig,
  ImageErrorCodeType,
  ImageErrorDetails,
  ImageErrorDetailsByCode,
  ImageFormat,
  ImageProcessErrorOptions,
  // Input types
  ImageSource,
  MaxFitConfig,
  MinFitConfig,
  // Utility types
  OutputFormat, // Added: for explicit output format specification
  OutputOptions,
  Padding,
  ProcessorOptions,
  // SVG quality system types
  QualityLevel,
  ResizeBackground,
  // Option types
  ResizeConfig,
  ResizeFit,
  ResizePosition,
  // Result types
  ResultBlob,
  ResultCanvas,
  ResultDataURL,
  ResultElement,
  ResultFile,
  ResultMetadata,
  SmartResizeOptions,
  SvgComplexityMetrics,
  // SVG utility types
  SvgDimensions,
  SvgSanitizerMode,
} from './types';
// Error classes
export { ImageErrorCode, ImageProcessError, OPTIMAL_QUALITY_BY_FORMAT } from './types';
export type {
  ConvertToBlobDetailedOptions,
  ConvertToBlobOptions,
  ConvertToDataURLDetailedOptions,
  ConvertToDataURLOptions,
  ConvertToFileDetailedOptions,
  ConvertToFileOptions,
  DecodedSvgDataURL,
  DetectImageSourceInfoOptions,
  EnsureBlobDetailedOptions,
  EnsureBlobOptions,
  EnsureDataURLDetailedOptions,
  EnsureDataURLOptions,
  EnsureFileDetailedOptions,
  EnsureFileOptions,
  EstimateDataURLPayloadByteLengthOptions,
  FetchImageFormatOptions,
  FetchImageSourceBlobOptions,
  FetchImageSourceBlobResult,
  ImageDimensions,
  ImageFormatOrUnknown,
  ImageInfo,
  ImageOrientation,
  ImageSourceInfo,
  ImageSourceType,
  ImageStringSourceInfo,
  ImageStringSourceType,
  OutputFilenameOptions,
  ResolveOutputFormatOptions,
  TransparencyOptions,
} from './utils';
// Utility functions
export {
  blobToDataURL,
  convertToBlob,
  convertToBlobDetailed,
  convertToDataURL,
  convertToDataURLDetailed,
  convertToElement,
  convertToFile,
  convertToFileDetailed,
  dataURLToBlob,
  decodeSvgDataURL,
  detectImageSourceInfo,
  detectImageSourceType,
  detectImageStringSourceInfo,
  detectImageStringSourceType,
  ensureBlob,
  ensureBlobDetailed,
  ensureDataURL,
  ensureDataURLDetailed,
  ensureFile,
  ensureFileDetailed,
  ensureImageElement,
  ensureImageElementDetailed,
  estimateDataURLPayloadByteLength,
  estimateDataURLSize,
  fetchImageFormat,
  fetchImageSourceBlob,
  formatToMimeType,
  getImageAspectRatio,
  getImageDimensions,
  getImageFormat,
  getImageInfo,
  getImageOrientation,
  getOutputFilename,
  hasTransparency,
  isDataURLString,
  isInlineSvg,
  isSupportedOutputFormat,
  mimeTypeToImageFormat,
  mimeTypeToOutputFormat,
  replaceImageExtension,
  resolveOutputFormat,
} from './utils';
// 브라우저 기능 감지 — 단일 구현 소스를 재노출한다
export {
  analyzePerformanceFeatures,
  type BrowserCapabilities,
  BrowserCapabilityDetector,
  DEFAULT_DETECTION_OPTIONS,
  type DetectionOptions,
  detectBrowserCapabilities,
  detectFormatSupport,
  detectSyncCapabilities,
  FEATURE_PERFORMANCE_WEIGHTS,
  getCachedBrowserCapabilities,
  getCachedFormatSupport,
  getOptimalProcessingMode,
  type PerformanceFeatures,
  PROCESSING_MODE_DESCRIPTIONS,
} from './utils/browser-capabilities';
export type { SvgCompatibilityOptions, SvgCompatibilityReport } from './utils/svg-compatibility';
// SVG compatibility functions
export { enhanceBrowserCompatibility, enhanceSvgForBrowser } from './utils/svg-compatibility';
// SVG utility functions
export { extractSvgDimensions } from './utils/svg-dimensions';
// SVG sanitize
export { sanitizeSvg, sanitizeSvgForRendering } from './utils/svg-sanitizer';

/**
 * 브라우저 기능 지원 여부를 동기적으로 감지한다 (하위 호환 퍼사드).
 *
 * @deprecated `detectBrowserCapabilities()` 또는 `detectSyncCapabilities()`를 사용하세요.
 * 이 객체는 하위 호환용 동기 퍼사드입니다. `webp`와 `avif`는 우선
 * `detectBrowserCapabilities()` 또는 `detectFormatSupport()`가 채운 최신 캐시를 재사용하고,
 * 캐시가 비어 있으면 예전 Canvas 기반 동기 판별로 한 번만 폴백합니다.
 *
 * @description
 * 브라우저 기능 감지 모듈을 재사용하는 하위 호환 동기 퍼사드입니다.
 * 동기 판별 가능한 항목은 `detectSyncCapabilities()`에 위임하고,
 * 비동기 포맷 감지 결과는 캐시에서 재사용합니다. 포맷 캐시가 비어 있을 때는
 * 기존 `features` API와 동일한 동기 Canvas 감지를 사용합니다.
 *
 * @example 기존 사용법 (deprecated)
 * ```typescript
 * import { features } from '@cp949/web-image-util';
 * const format = features.webp ? 'webp' : 'png';
 * ```
 *
 * @example 권장 사용법
 * ```typescript
 * import { detectBrowserCapabilities } from '@cp949/web-image-util';
 * const caps = await detectBrowserCapabilities();
 * const format = caps.webp ? 'webp' : 'png';
 * ```
 */
export const features = {
  /** WebP 지원 여부 */
  get webp(): boolean {
    const cachedCapabilities = _getCachedBrowserCapabilities();
    if (cachedCapabilities) {
      return cachedCapabilities.webp;
    }

    return _getCachedFormatSupport().webp ?? _detectCanvasFormatSupport('webp');
  },
  /** AVIF 지원 여부 */
  get avif(): boolean {
    const cachedCapabilities = _getCachedBrowserCapabilities();
    if (cachedCapabilities) {
      return cachedCapabilities.avif;
    }

    return _getCachedFormatSupport().avif ?? _detectCanvasFormatSupport('avif');
  },
  /** OffscreenCanvas 지원 여부 */
  get offscreenCanvas(): boolean {
    return _detectSyncCapabilities().offscreenCanvas;
  },
  /** ImageBitmap 지원 여부 */
  get imageBitmap(): boolean {
    return _detectSyncCapabilities().imageBitmap;
  },
} as const;
