/**
 * Utility Functions - Image Conversion and Support Features
 *
 * @description
 * Lightweight utility collection that performs pure conversions without image processing
 * Optimized for simple conversion tasks that don't require complex image processing
 *
 * **Key Features:**
 * - Direct conversion between various image formats (Blob ↔ DataURL ↔ File ↔ Element)
 * - SVG compatibility enhancement and browser normalization
 * - Browser capability detection and performance analysis
 * - SVG vector optimization and compression
 *
 * **Usage Scenarios:**
 * - Format conversion only without image resizing
 * - Improving browser compatibility of SVG files
 * - Understanding current browser's image processing performance
 *
 * @example
 * ```typescript
 * import { convertToBlob, enhanceSvgForBrowser } from '@cp949/web-image-util/utils';
 *
 * // Simple format conversion
 * const blob = await convertToBlob(imageElement);
 *
 * // SVG compatibility improvement
 * const enhancedSvg = enhanceSvgForBrowser(svgString);
 * ```
 */

/**
 * Browser capability detection system
 *
 * @description Intelligent system that automatically detects current browser's
 * image processing capabilities and determines optimal processing methods
 */
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
  getOptimalProcessingMode,
  type PerformanceFeatures,
  PROCESSING_MODE_DESCRIPTIONS,
} from './browser-capabilities';
/**
 * Image format conversion functions
 *
 * @description Functions that perform pure format conversion without image resizing
 * Suitable for fast and lightweight conversion tasks
 */
export {
  type ConvertToBlobDetailedOptions,
  type ConvertToBlobOptions,
  type ConvertToDataURLDetailedOptions,
  type ConvertToDataURLOptions,
  type ConvertToFileDetailedOptions,
  type ConvertToFileOptions,
  convertToBlob,
  convertToBlobDetailed,
  convertToDataURL,
  convertToDataURLDetailed,
  convertToElement,
  convertToFile,
  convertToFileDetailed,
  type EnsureBlobDetailedOptions,
  type EnsureBlobOptions,
  type EnsureDataURLDetailedOptions,
  type EnsureDataURLOptions,
  type EnsureFileDetailedOptions,
  type EnsureFileOptions,
  ensureBlob,
  ensureBlobDetailed,
  ensureDataURL,
  ensureDataURLDetailed,
  ensureFile,
  ensureFileDetailed,
  ensureImageElement,
  ensureImageElementDetailed,
} from './converters';
/**
 * Data URL 변환 유틸리티
 *
 * @description Blob과 Data URL 사이의 순수 변환 및 크기 추정 기능
 */
export {
  blobToDataURL,
  type DecodedSvgDataURL,
  dataURLToBlob,
  decodeSvgDataURL,
  type EstimateDataURLPayloadByteLengthOptions,
  estimateDataURLPayloadByteLength,
  estimateDataURLSize,
  isDataURLString,
} from './data-url';
/**
 * Image format conversion functions
 *
 * @description Functions that perform pure format conversion without image resizing
 * Suitable for fast and lightweight conversion tasks
 */
export {
  formatToMimeType,
  getOutputFilename,
  type ImageFormatOrUnknown,
  isSupportedOutputFormat,
  mimeTypeToImageFormat,
  mimeTypeToOutputFormat,
  type OutputFilenameOptions,
  type ResolveOutputFormatOptions,
  replaceImageExtension,
  resolveOutputFormat,
} from './format-utils';
/**
 * 이미지 정보 조회 유틸리티
 *
 * @description processImage와 같은 입력 타입에서 치수와 포맷 정보를 가볍게 조회한다
 */
export {
  type FetchImageFormatOptions,
  type FetchImageSourceBlobOptions,
  type FetchImageSourceBlobResult,
  fetchImageFormat,
  fetchImageSourceBlob,
  getImageAspectRatio,
  getImageDimensions,
  getImageFormat,
  getImageInfo,
  getImageOrientation,
  type ImageDimensions,
  type ImageInfo,
  type ImageOrientation,
} from './image-info';
/**
 * 이미지 투명도 검사 유틸리티
 *
 * @description Canvas 픽셀 alpha 채널을 샘플링해 투명 픽셀 포함 여부를 확인한다
 */
export { hasTransparency, type TransparencyOptions } from './image-inspection';
/**
 * 이미지 소스 판정 유틸리티
 *
 * @description processImage에 넘길 소스의 입력 형태와 문자열 소스의 세부 유형을 판정한다
 */
export {
  type DetectImageSourceInfoOptions,
  detectImageSourceInfo,
  detectImageSourceType,
  detectImageStringSourceInfo,
  detectImageStringSourceType,
  type ImageSourceInfo,
  type ImageSourceType,
  type ImageStringSourceInfo,
  type ImageStringSourceType,
} from './source-utils';
/**
 * SVG compatibility and browser normalization functions
 *
 * @description Compatibility enhancement and standardization features
 * for consistent SVG rendering across various browsers
 */
export {
  enhanceBrowserCompatibility,
  enhanceSvgForBrowser,
  type SvgCompatibilityOptions,
  type SvgCompatibilityReport,
} from './svg-compatibility';

/**
 * SVG 문자열 감지 유틸리티
 *
 * @description 문자열 입력이 실제 인라인 SVG XML 루트로 시작하는지 판정한다
 */
export { isInlineSvg } from './svg-detection';

/**
 * SVG vector optimization system
 *
 * @description Advanced optimization tools that reduce SVG file size
 * and improve rendering performance
 */
export { type OptimizationResult, type SvgOptimizationOptions, SvgOptimizer } from './svg-optimizer';

/**
 * SVG 새니타이저
 *
 * @description SVG 문자열에서 XSS 및 캔버스 오염을 유발할 수 있는
 * 위험 요소(script, foreignObject, 이벤트 핸들러, 외부 URL 참조)를 제거한다
 */
export { sanitizeSvg, sanitizeSvgForRendering } from './svg-sanitizer';
