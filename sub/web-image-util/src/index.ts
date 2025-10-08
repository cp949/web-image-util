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
 * @description
 * Runtime detection of browser capabilities for optimal image processing strategy selection.
 * Use these feature flags to implement progressive enhancement and format fallbacks.
 *
 * **Usage Patterns:**
 * - Check format support before processing
 * - Enable advanced features based on capability
 * - Implement graceful degradation strategies
 * - Optimize processing paths for browser capabilities
 *
 * @example
 * ```typescript
 * import { features } from '@cp949/web-image-util';
 *
 * // Choose optimal format based on browser support
 * const format = features.webp ? 'webp' : features.avif ? 'avif' : 'png';
 *
 * // Use OffscreenCanvas for better performance if available
 * if (features.offscreenCanvas) {
 *   // Use OffscreenCanvas-based processing
 * } else {
 *   // Fallback to regular Canvas
 * }
 *
 * // Progressive format selection
 * const result = await processImage(source)
 *   .resize({ fit: 'cover', width: 300, height: 200 })
 *   .toBlob({ format: features.webp ? 'webp' : 'png' });
 * ```
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
