/**
 * @cp949/web-image-util
 *
 * TypeScript library for image processing in browsers
 * Provides high-performance image conversion using Canvas 2D API
 *
 * @example Basic usage
 * ```typescript
 * import { processImage } from '@cp949/web-image-util';
 *
 * // Simple resizing
 * const thumbnail = await processImage(source)
 *   .resize({ fit: 'cover', width: 300, height: 200 })
 *   .toBlob();
 *
 * // Advanced processing
 * const result = await processImage(source)
 *   .resize({ fit: 'contain', width: 300, height: 200, background: '#ffffff' })
 *   .blur(2)
 *   .toBlob({ format: 'webp', quality: 0.8 });
 * ```
 */

// Core API
export { processImage, ImageProcessor } from './processor';

// Shortcut API
export { ShortcutBuilder } from './shortcut';

// Convenience features
export { createThumbnail, createAvatar, createSocialImage } from './presets';
export type { ThumbnailOptions, AvatarOptions, SocialImageOptions, SocialPlatform } from './presets';

// Utility functions
export {
  convertToBlob,
  convertToBlobDetailed,
  convertToDataURL,
  convertToDataURLDetailed,
  convertToFile,
  convertToFileDetailed,
  convertToElement,
} from './utils';
export type {
  ConvertToBlobOptions,
  ConvertToBlobDetailedOptions,
  ConvertToDataURLOptions,
  ConvertToDataURLDetailedOptions,
  ConvertToFileOptions,
  ConvertToFileDetailedOptions,
} from './utils';

// SVG compatibility functions
export { enhanceBrowserCompatibility, enhanceSvgForBrowser } from './utils/svg-compatibility';
export type { SvgCompatibilityOptions, SvgCompatibilityReport } from './utils/svg-compatibility';

// SVG complexity analysis
export { analyzeSvgComplexity } from './core/svg-complexity-analyzer';

// SVG utility functions
export { extractSvgDimensions } from './utils/svg-dimensions';

// Type definitions
export type {
  // Input types
  ImageSource,

  // Option types
  ResizeConfig,
  // ResizeConfig sub-types (for explicit type specification)
  CoverConfig,
  ContainConfig,
  FillConfig,
  MaxFitConfig,
  MinFitConfig,
  SmartResizeOptions,
  BlurOptions,
  OutputOptions,
  ProcessorOptions,
  Padding,

  // Result types
  ResultBlob,
  ResultCanvas,
  ResultDataURL,
  ResultFile,
  ResultMetadata,

  // Utility types
  OutputFormat, // Added: for explicit output format specification
  ResizeFit,
  ResizePosition,
  ResizeBackground,
  ImageFormat,
  ImageErrorCodeType,

  // SVG quality system types
  QualityLevel,
  SvgComplexityMetrics,
  ComplexityAnalysisResult,

  // SVG utility types
  SvgDimensions,
} from './types';

// Error classes
export { ImageProcessError, OPTIMAL_QUALITY_BY_FORMAT } from './types';

/**
 * Browser feature support detection
 *
 * @description Dynamically detects image processing features supported by the current browser.
 * Enables selection of optimal processing methods by checking feature availability at runtime.
 */
export const features = {
  /** WebP support */
  webp: (() => {
    try {
      const canvas = document.createElement('canvas');
      return canvas.toDataURL('image/webp').startsWith('data:image/webp');
    } catch {
      return false;
    }
  })(),

  /** AVIF support */
  avif: (() => {
    try {
      const canvas = document.createElement('canvas');
      return canvas.toDataURL('image/avif').startsWith('data:image/avif');
    } catch {
      return false;
    }
  })(),

  /** OffscreenCanvas support */
  offscreenCanvas: typeof OffscreenCanvas !== 'undefined',

  /** ImageBitmap support */
  imageBitmap: typeof createImageBitmap !== 'undefined',
} as const;
