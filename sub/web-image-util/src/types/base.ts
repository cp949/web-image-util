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

export type { ImageErrorCodeType } from '../errors';
export { ImageErrorCode as ImageErrorCodeConstants } from '../errors';

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
