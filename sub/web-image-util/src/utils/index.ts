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
 * import { convertToBlob, normalizeSvgBasics } from '@cp949/web-image-util/utils';
 *
 * // Simple format conversion
 * const blob = await convertToBlob(imageElement);
 *
 * // SVG compatibility improvement
 * const normalizedSvg = normalizeSvgBasics(svgString);
 * ```
 */

/**
 * Image format conversion functions
 *
 * @description Functions that perform pure format conversion without image resizing
 * Suitable for fast and lightweight conversion tasks
 */
export {
  convertToBlob,
  convertToBlobDetailed,
  convertToDataURL,
  convertToDataURLDetailed,
  convertToFile,
  convertToFileDetailed,
  convertToElement,
  type ConvertToBlobOptions,
  type ConvertToBlobDetailedOptions,
  type ConvertToDataURLOptions,
  type ConvertToDataURLDetailedOptions,
  type ConvertToFileOptions,
  type ConvertToFileDetailedOptions,
} from './converters';

/**
 * SVG compatibility and browser normalization functions
 *
 * @description Compatibility enhancement and standardization features
 * for consistent SVG rendering across various browsers
 */
export {
  enhanceBrowserCompatibility,
  normalizeSvgBasics,
  type SvgCompatibilityOptions,
  type SvgCompatibilityReport,
} from './svg-compatibility';

/**
 * Browser capability detection system
 *
 * @description Intelligent system that automatically detects current browser's
 * image processing capabilities and determines optimal processing methods
 */
export {
  BrowserCapabilityDetector,
  detectBrowserCapabilities,
  analyzePerformanceFeatures,
  detectSyncCapabilities,
  detectFormatSupport,
  getOptimalProcessingMode,
  DEFAULT_DETECTION_OPTIONS,
  PROCESSING_MODE_DESCRIPTIONS,
  FEATURE_PERFORMANCE_WEIGHTS,
  type BrowserCapabilities,
  type PerformanceFeatures,
  type DetectionOptions,
} from './browser-capabilities';

/**
 * SVG vector optimization system
 *
 * @description Advanced optimization tools that reduce SVG file size
 * and improve rendering performance
 */
export { SvgOptimizer, type SvgOptimizationOptions, type OptimizationResult } from './svg-optimizer';
