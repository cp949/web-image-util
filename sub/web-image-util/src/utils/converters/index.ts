/**
 * Image format conversion utilities - Pure conversion without processing
 *
 * @description
 * Lightweight image conversion functions that transform between different image formats
 * without any resizing, filtering, or processing. Optimized for performance and memory
 * efficiency with direct format-to-format conversion capabilities.
 *
 * **🎯 Core Purpose:**
 * - **Pure Conversion**: Format changes only (JPEG ↔ PNG ↔ WebP ↔ AVIF)
 * - **No Processing**: No resize, crop, filter, or quality changes unless explicitly requested
 * - **Memory Efficient**: Direct conversion paths without intermediate Canvas when possible
 * - **Type Safety**: Full TypeScript support with proper error handling
 *
 * **⚡ Performance Characteristics:**
 * - **Canvas-based**: Uses HTML5 Canvas 2D API for universal browser support
 * - **Streaming**: Minimal memory footprint for large image conversions
 * - **Browser Native**: Leverages built-in browser image processing
 * - **Async Pattern**: Non-blocking operations with Promise-based API
 *
 * **🔄 Supported Conversions:**
 * - HTMLImageElement → Blob/DataURL/File
 * - HTMLCanvasElement → Blob/DataURL/File
 * - Blob → Blob (format conversion)
 * - URL strings → processed formats
 * - SVG strings → raster formats
 *
 * **💡 When to Use vs processImage():**
 * - **Use converters**: Format conversion only, maximum performance
 * - **Use processImage()**: When resizing, filtering, or complex processing needed
 * - **Memory conscious**: converters use less memory for simple tasks
 * - **File size**: processImage() offers more compression control
 */

export { isDataURLString } from '../data-url';

export { ensureImageElement, ensureImageElementDetailed } from './element';
export {
  ensureBlob,
  ensureBlobDetailed,
  ensureDataURL,
  ensureDataURLDetailed,
  ensureFile,
  ensureFileDetailed,
} from './ensure';
export type {
  EnsureBlobDetailedOptions,
  EnsureBlobOptions,
  EnsureDataURLDetailedOptions,
  EnsureDataURLOptions,
  EnsureFileDetailedOptions,
  EnsureFileOptions,
} from './types';
