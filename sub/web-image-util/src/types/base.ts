/**
 * Base type definitions - preventing circular imports
 *
 * @description Contains only basic types that can be imported by other type files
 * guards.ts and other type files import this file to prevent circular references.
 */

// ============================================================================
// CORE TYPES - Core type definitions
// ============================================================================

/**
 * Image source type
 *
 * @description Supported image source formats:
 * - HTMLImageElement: DOM image element
 * - HTMLCanvasElement: Canvas element
 * - Blob: File API Blob object
 * - ArrayBuffer: Binary data
 * - Uint8Array: Typed array
 * - string: SVG XML, Data URL, HTTP URL, or relative/absolute path
 */
export type ImageSource = HTMLImageElement | HTMLCanvasElement | Blob | ArrayBuffer | Uint8Array | string;

/**
 * Supported image formats (considering browser compatibility)
 *
 * @description Supported input formats:
 * - jpeg: JPEG format (lossy compression, suitable for photos)
 * - jpg: JPEG alias
 * - png: PNG format (lossless, transparency support)
 * - webp: WebP format (high compression, transparency support, modern browsers)
 * - gif: GIF format (input only, animation)
 * - svg: SVG format (input only, vector graphics)
 */
export type ImageFormat = 'jpeg' | 'jpg' | 'png' | 'webp' | 'avif' | 'gif' | 'svg';

/**
 * Supported output formats (browser compatibility first)
 *
 * @description Formats that can be reliably output from Canvas:
 * - jpeg: JPEG format (lossy compression)
 * - jpg: JPEG alias
 * - png: PNG format (lossless, transparency support)
 * - webp: WebP format (high compression, modern browsers)
 * - avif: AVIF format (latest compression, requires browser support detection)
 *
 * @note Excluded formats:
 * - SVG: Cannot render directly to SVG from Canvas
 * - GIF: Excluded due to animation processing complexity
 */
export type OutputFormat = 'jpeg' | 'jpg' | 'png' | 'webp' | 'avif';

/**
 * Format constants (type safety enhanced with const assertion)
 */
export const ImageFormats = {
  JPEG: 'jpeg' as const,
  JPG: 'jpg' as const,
  PNG: 'png' as const,
  WEBP: 'webp' as const,
  AVIF: 'avif' as const,
  GIF: 'gif' as const,
  SVG: 'svg' as const,
} as const;

/**
 * Output format constants
 */
export const OutputFormats = {
  JPEG: 'jpeg' as const,
  JPG: 'jpg' as const,
  PNG: 'png' as const,
  WEBP: 'webp' as const,
  AVIF: 'avif' as const,
} as const;

// ============================================================================
// RESIZE TYPES - Basic resize-related types
// ============================================================================

/**
 * Resize fit options (Canvas API limitations)
 *
 * @description Methods actually implementable in browser Canvas:
 * - cover: Maintain ratio and fill entire area, cropping if necessary (default)
 * - contain: Maintain ratio and fit entire image within area
 * - fill: Ignore ratio and fit exactly
 * - maxFit: Only allow shrinking, no enlargement (replaces inside)
 * - minFit: Only allow enlargement, no shrinking (replaces outside)
 */
export type ResizeFit = 'cover' | 'contain' | 'fill' | 'maxFit' | 'minFit';

/**
 * Fit constants
 */
export const ResizeFitConstants = {
  COVER: 'cover' as const,
  CONTAIN: 'contain' as const,
  FILL: 'fill' as const,
} as const;

/**
 * Position/anchor point options (Canvas API limitations)
 *
 * @description Only basic positions that are meaningful in Canvas drawImage():
 */
export type ResizePosition =
  | 'center'
  | 'centre' // British spelling compatibility
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | { x: number; y: number }; // Exact pixel position

/**
 * Background color type (Canvas fillStyle compatible)
 *
 * @description Only CSS color strings supported by Canvas fillStyle:
 * - CSS color names: 'red', 'blue', 'transparent'
 * - Hexadecimal: '#ff0000', '#f00'
 * - RGB/RGBA: 'rgb(255,0,0)', 'rgba(255,0,0,0.5)'
 * - HSL/HSLA: 'hsl(0,100%,50%)'
 */
export type ResizeBackground = string | { r: number; g: number; b: number; alpha?: number };

// ============================================================================
// ERROR TYPES - Basic error-related types
// ============================================================================

/**
 * Error codes (unified definition)
 */
export type ImageErrorCodeType =
  // Source-related errors
  | 'INVALID_SOURCE'
  | 'UNSUPPORTED_FORMAT'
  | 'SOURCE_LOAD_FAILED'
  // Processing-related errors
  | 'CANVAS_CREATION_FAILED'
  | 'CANVAS_CONTEXT_FAILED'
  | 'RESIZE_FAILED'
  | 'CONVERSION_FAILED'
  | 'BLUR_FAILED'
  | 'PROCESSING_FAILED'
  | 'SMART_RESIZE_FAILED'
  // Size/dimension-related errors
  | 'INVALID_DIMENSIONS'
  | 'DIMENSION_TOO_LARGE'
  // System resource-related errors
  | 'MEMORY_ERROR'
  | 'TIMEOUT_ERROR'
  // SVG-related errors
  | 'SVG_LOAD_FAILED'
  | 'SVG_PROCESSING_FAILED'
  // Output-related errors
  | 'OUTPUT_FAILED'
  | 'DOWNLOAD_FAILED'
  | 'FILE_TOO_LARGE'
  | 'CANVAS_TO_BLOB_FAILED'
  | 'IMAGE_LOAD_FAILED'
  | 'BLOB_TO_ARRAYBUFFER_FAILED'
  | 'BLOB_CONVERSION_ERROR'
  // LazyRenderPipeline-related errors
  | 'MULTIPLE_RESIZE_NOT_ALLOWED'
  | 'CANVAS_CONTEXT_ERROR'
  // Browser compatibility errors
  | 'BROWSER_NOT_SUPPORTED'
  | 'FEATURE_NOT_SUPPORTED';

/**
 * Error code constants (const assertion)
 */
export const ImageErrorCodeConstants = {
  // Source-related
  INVALID_SOURCE: 'INVALID_SOURCE' as const,
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT' as const,
  SOURCE_LOAD_FAILED: 'SOURCE_LOAD_FAILED' as const,
  // Processing-related
  CANVAS_CREATION_FAILED: 'CANVAS_CREATION_FAILED' as const,
  CANVAS_CONTEXT_FAILED: 'CANVAS_CONTEXT_FAILED' as const,
  RESIZE_FAILED: 'RESIZE_FAILED' as const,
  CONVERSION_FAILED: 'CONVERSION_FAILED' as const,
  BLUR_FAILED: 'BLUR_FAILED' as const,
  PROCESSING_FAILED: 'PROCESSING_FAILED' as const,
  SMART_RESIZE_FAILED: 'SMART_RESIZE_FAILED' as const,
  // Size/dimension-related
  INVALID_DIMENSIONS: 'INVALID_DIMENSIONS' as const,
  DIMENSION_TOO_LARGE: 'DIMENSION_TOO_LARGE' as const,
  // System resource-related
  MEMORY_ERROR: 'MEMORY_ERROR' as const,
  TIMEOUT_ERROR: 'TIMEOUT_ERROR' as const,
  // SVG-related
  SVG_LOAD_FAILED: 'SVG_LOAD_FAILED' as const,
  SVG_PROCESSING_FAILED: 'SVG_PROCESSING_FAILED' as const,
  // Output-related
  OUTPUT_FAILED: 'OUTPUT_FAILED' as const,
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED' as const,
  FILE_TOO_LARGE: 'FILE_TOO_LARGE' as const,
  CANVAS_TO_BLOB_FAILED: 'CANVAS_TO_BLOB_FAILED' as const,
  IMAGE_LOAD_FAILED: 'IMAGE_LOAD_FAILED' as const,
  BLOB_TO_ARRAYBUFFER_FAILED: 'BLOB_TO_ARRAYBUFFER_FAILED' as const,
  // Browser compatibility
  BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED' as const,
  FEATURE_NOT_SUPPORTED: 'FEATURE_NOT_SUPPORTED' as const,
} as const;

// ============================================================================
// GEOMETRY TYPES - Basic geometry-related types
// ============================================================================

/**
 * Coordinate point
 */
export interface GeometryPoint {
  x: number;
  y: number;
}

/**
 * Size
 */
export interface GeometrySize {
  width: number;
  height: number;
}

/**
 * Rectangle
 */
export interface GeometryRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}
