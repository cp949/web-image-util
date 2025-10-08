/**
 * web-image-util unified type system
 * Type definitions for web browser image processing library
 */

// ============================================================================
// BASE TYPES - Basic types (re-exported from base.ts)
// ============================================================================

export type {
  GeometryPoint,
  GeometryRectangle,
  GeometrySize,
  ImageErrorCodeType,
  ImageFormat,
  ImageSource,
  OutputFormat,
  ResizeBackground,
  ResizeFit,
  ResizePosition,
} from './base';

// ============================================================================
// INTERNAL TYPES - Library internal implementation types (excluded from public API)
// ============================================================================
//
// The following types are used only internally by the library and users don't need to use them directly:
// - ProcessorState, BeforeResize, AfterResize: Internal state machine
// - EnsureCanResize, CanResize, AfterResizeCall: TypeScript compiler constraints
// - TypedImageProcessor, InitialProcessor, ResizedProcessor: Internal implementation types
//
// Users only need to use the ImageProcessor interface.
// ============================================================================

// Commented out to allow import only from internal implementation
// export type {
//   AfterResize,
//   AfterResizeCall,
//   BeforeResize,
//   CanResize,
//   EnsureCanResize,
//   ProcessorState,
//   ProcessorStateType,
//   ResizeAlreadyCalledError,
// } from './processor-state';
//
// export type {
//   CanCallResize,
//   GetProcessorState,
//   InitialProcessor,
//   ProcessorFactory,
//   ResizedProcessor,
//   TypedImageProcessor,
// } from './typed-processor';

export { ImageErrorCodeConstants, ImageFormats, OutputFormats, ResizeFitConstants } from './base';

// Re-import types from base.ts to make them available
import type { GeometrySize, ImageErrorCodeType, OutputFormat, ResizeBackground } from './base';

// Import ResizeConfig type for use in ImageProcessor
import type { ResizeConfig } from './resize-config';

import { ImageErrorCodeConstants, ImageFormats, OutputFormats } from './base';

// ============================================================================
// RESIZE TYPES - Resize-related types
// ============================================================================

// New ResizeConfig type system (Discriminated Union)
export type {
  BaseResizeConfig,
  ContainConfig,
  CoverConfig,
  FillConfig,
  MaxFitConfig,
  MinFitConfig,
  Padding,
  ResizeConfig,
} from './resize-config';

export {
  isContainConfig,
  isCoverConfig,
  isFillConfig,
  isMaxFitConfig,
  isMinFitConfig,
  validateResizeConfig,
} from './resize-config';

/**
 * Smart resize options (for advanced processing)
 * Used together with ResizeConfig
 */
export interface SmartResizeOptions {
  /** Target width (pixels) */
  width?: number;
  /** Target height (pixels) */
  height?: number;

  /**
   * Processing strategy - 'auto' is sufficient in most cases
   * @default 'auto'
   */
  strategy?: 'auto' | 'fast' | 'quality' | 'memory-efficient';

  /**
   * Performance profile - simple 3 choices
   * @default 'balanced'
   */
  performance?: 'fast' | 'balanced' | 'quality';

  /**
   * Progress callback - provides simple 0-100 progress only
   * @param progress 0-100 progress
   */
  onProgress?: (progress: number) => void;

  /**
   * Memory limit (MB) - default: auto-detect
   */
  maxMemoryMB?: number;
}

// ============================================================================
// BLUR NAMESPACE - Blur-related types
// ============================================================================

// ============================================================================
// BLUR TYPES - Blur-related types (changed to ES2015 module syntax)
// ============================================================================

/**
 * Blur options (Canvas CSS filter limitations)
 */
export interface BlurOptions {
  /** Blur radius (default: 2) */
  radius?: number;
  // Canvas only supports CSS filter blur(), so advanced options are removed
}

// =================================
// OUTPUT TYPES - Output-related types
// =================================

/**
 * Optimal quality settings for each format
 */
export const OutputOptimalQuality: Record<OutputFormat, number> = {
  png: 1.0, // Lossless compression
  jpeg: 0.85, // Balance of quality and size
  jpg: 0.85, // Same as JPEG
  webp: 0.8, // High-efficiency compression
  avif: 0.75, // Best compression ratio
} as const;

/**
 * Output options
 */
export interface OutputOptions {
  /** Output format (default: 'webp' if supported, 'png' if not) */
  format?: OutputFormat;
  /** Compression quality 0.0-1.0 (default: optimal value per format) */
  quality?: number;
  /** Fallback format when format not supported (default: 'png') */
  fallbackFormat?: OutputFormat;
}

// ============================================================================
// IMAGE ERROR TYPES - Image error-related types
// ============================================================================

/**
 * Image processing error class (unified definition)
 */
export class ImageProcessError extends globalThis.Error {
  public name: string = 'ImageProcessError';
  public suggestions: string[];

  constructor(
    message: string,
    public code: ImageErrorCodeType,
    public originalError?: globalThis.Error,
    suggestions: string[] = []
  ) {
    super(message);
    this.suggestions = suggestions;

    // Set up stack trace
    if ((globalThis.Error as any).captureStackTrace) {
      (globalThis.Error as any).captureStackTrace(this, ImageProcessError);
    }
  }
}

// Canvas API does not have margin/padding concepts like Sharp.js's extend feature
// Users must directly adjust Canvas size if needed

// ============================================================================
// RESULT NAMESPACE - Result-related types
// ============================================================================

/**
 * Basic processing result metadata
 */
export interface ResultMetadata {
  /** Result width */
  width: number;
  /** Result height */
  height: number;
  /** Processing time (milliseconds) */
  processingTime: number;
  /** Original size */
  originalSize?: GeometrySize;
  /** Format used */
  format?: OutputFormat;
  /** Result size (bytes) */
  size?: number;
  /** Number of operations applied */
  operations?: number;
}

/**
 * Blob result (includes metadata)
 */
export interface ResultBlob extends ResultMetadata {
  blob: globalThis.Blob;

  // 🆕 Additional metadata (test compatibility)
  /** Background color information (optional) */
  background?: string;
  /** Used quality setting (optional) */
  quality?: number;

  // 🆕 Direct conversion methods (performance optimization)
  toCanvas(): Promise<HTMLCanvasElement>;
  toDataURL(options?: OutputOptions): Promise<string>;
  toFile(filename: string, options?: OutputOptions): Promise<globalThis.File>;
  toElement(): Promise<HTMLImageElement>;
  toArrayBuffer(): Promise<ArrayBuffer>;
  toUint8Array(): Promise<Uint8Array>;
}

/**
 * DataURL result (includes metadata)
 */
export interface ResultDataURL extends ResultMetadata {
  dataURL: string;

  // 🆕 Direct conversion methods (performance optimization through size info reuse)
  toCanvas(): Promise<HTMLCanvasElement>;
  toBlob(options?: OutputOptions): Promise<globalThis.Blob>;
  toFile(filename: string, options?: OutputOptions): Promise<globalThis.File>;
  toElement(): Promise<HTMLImageElement>;
  toArrayBuffer(): Promise<ArrayBuffer>;
  toUint8Array(): Promise<Uint8Array>;
}

/**
 * File result (includes metadata)
 */
export interface ResultFile extends ResultMetadata {
  file: globalThis.File;

  // 🆕 Direct conversion methods
  toCanvas(): Promise<HTMLCanvasElement>;
  toDataURL(options?: OutputOptions): Promise<string>;
  toBlob(options?: OutputOptions): Promise<globalThis.Blob>;
  toElement(): Promise<HTMLImageElement>;
  toArrayBuffer(): Promise<ArrayBuffer>;
  toUint8Array(): Promise<Uint8Array>;
}

/**
 * Canvas result (includes metadata)
 */
export interface ResultCanvas extends ResultMetadata {
  canvas: HTMLCanvasElement;

  // Direct conversion methods
  toBlob(options?: OutputOptions): Promise<globalThis.Blob>;
  toDataURL(options?: OutputOptions): Promise<string>;
  toFile(filename: string, options?: OutputOptions): Promise<globalThis.File>;
  toElement(): Promise<HTMLImageElement>;
  toArrayBuffer(): Promise<ArrayBuffer>;
  toUint8Array(): Promise<Uint8Array>;
}

// ============================================================================
// PROCESSOR NAMESPACE - Processor-related types
// ============================================================================

/**
 * Processor global options
 */
export interface ProcessorOptions {
  /** CORS setting (default: 'anonymous') */
  crossOrigin?: string;
  /** Default quality setting (default: 0.8) */
  defaultQuality?: number;
  /** Default background color (default: transparent black) */
  defaultBackground?: ResizeBackground;
  /** Default format (default: 'auto') */
  defaultFormat?: OutputFormat | 'auto';
  /** Timeout (milliseconds, default: 30 seconds) */
  timeout?: number;
  // Cannot explicitly set memory limits in browser
}

/**
 * Image processor interface
 */
export interface ImageProcessor {
  resize(config: ResizeConfig): ImageProcessor;
  blur(radius?: number, options?: Partial<BlurOptions>): ImageProcessor;
  toBlob(options?: OutputOptions): Promise<ResultBlob>;
  toDataURL(options?: OutputOptions): Promise<ResultDataURL>;
  toFile(filename: string, options?: OutputOptions): Promise<ResultFile>;
  toCanvas(): Promise<ResultCanvas>;
}

/**
 * Source conversion options
 */
export interface ProcessorSourceOptions {
  /** CORS setting */
  crossOrigin?: string;
  /** Element size */
  elementSize?: GeometrySize;
  // Canvas API does not support DPI control or animation processing
}

// ============================================================================
// CONSTANTS - Constant definitions
// ============================================================================

/**
 * Optimal quality settings by format
 */
export const OPTIMAL_QUALITY_BY_FORMAT = OutputOptimalQuality;

/**
 * Error code constants (test compatibility)
 */
export const ImageErrorCode = ImageErrorCodeConstants;

// ============================================================================
// EXPORTS - Type guards and other utilities
// ============================================================================

// Export type guard functions
export * from './guards';

// Provide main format information
// Remove format metadata that cannot be obtained directly from Canvas API
// Use browser's Image object or separate library when needed
export const FORMAT_INFO = {
  // Provide only basic MIME types (used in Canvas toBlob)
  [ImageFormats.JPEG]: { mimeType: 'image/jpeg' },
  [ImageFormats.JPG]: { mimeType: 'image/jpeg' },
  [ImageFormats.PNG]: { mimeType: 'image/png' },
  [ImageFormats.WEBP]: { mimeType: 'image/webp' },
  [ImageFormats.AVIF]: { mimeType: 'image/avif' },
  [ImageFormats.GIF]: { mimeType: 'image/gif' },
  [ImageFormats.SVG]: { mimeType: 'image/svg+xml' },
} as const;

// Output format information
export const OUTPUT_FORMAT_INFO = {
  [OutputFormats.JPEG]: { mimeType: 'image/jpeg' },
  [OutputFormats.JPG]: { mimeType: 'image/jpeg' },
  [OutputFormats.PNG]: { mimeType: 'image/png' },
  [OutputFormats.WEBP]: { mimeType: 'image/webp' },
  [OutputFormats.AVIF]: { mimeType: 'image/avif' },
} as const;

// ============================================================================
// PRESET TYPES - Preset-related types re-export
// ============================================================================

export type { AvatarOptions, SocialImageOptions, SocialPlatform, ThumbnailOptions } from '../presets';

// ============================================================================
// SHORTCUT API TYPES - Shortcut API-related types
// ============================================================================

export { isScaleX, isScaleXY, isScaleY, isUniformScale } from './shortcut-types';
export type { DirectResizeConfig, ResizeOperation, ScaleOperation } from './shortcut-types';

export type { IImageProcessor, InitialProcessorInterface, ResizedProcessorInterface } from './processor-interface';

// Re-export Size type defined in LazyRenderPipeline
export type { Size } from '../core/lazy-render-pipeline';

// ============================================================================
// ADDITIONAL TYPES - Additional types for test compatibility
// ============================================================================

/**
 * MIME type
 */
export type MimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'image/svg+xml' | 'image/avif';

/**
 * Smart format options
 */
export interface SmartFormatOptions {
  enableWebP?: boolean;
  enableAVIF?: boolean;
  fallbackFormat?: OutputFormat;
  autoDetect?: boolean;
}

/**
 * Performance configuration
 */
export interface PerformanceConfig {
  maxMemoryMB?: number;
  enableMultiThreading?: boolean;
  chunkSize?: number;
  optimizeForSpeed?: boolean;
}

// ============================================================================
// SVG QUALITY ENHANCEMENT TYPES - SVG quality enhancement related types
// ============================================================================

// Re-export SVG size information and Canvas high-quality setting types
export type { HighQualityCanvasOptions } from '../base/canvas-utils';
export type { SvgDimensions } from '../utils/svg-dimensions';

// SVG complexity analysis and quality system types
export type { ComplexityAnalysisResult, QualityLevel, SvgComplexityMetrics } from '../core/svg-complexity-analyzer';

// (Removed: SvgProcessingOptions, SvgProcessingResult - unnecessary)

// Browser capability detection system types
export type { BrowserCapabilities, DetectionOptions, PerformanceFeatures } from '../utils/browser-capabilities';

// OffscreenCanvas + Web Worker high-performance processing types
// (Types used by OffscreenSVGProcessor are defined in that module)

// ============================================================================
// ADVANCED PROCESSING TYPES - Advanced processing related unified types
// ============================================================================

/**
 * Advanced SVG processing mode
 */
export type AdvancedProcessingMode = 'standard' | 'offscreen' | 'auto';

/**
 * Performance benchmark result
 */
export interface PerformanceBenchmark {
  /** Standard processing time (milliseconds) */
  standardTime: number;
  /** OffscreenCanvas processing time (milliseconds, when supported) */
  offscreenTime?: number;
  /** Whether OffscreenCanvas is faster */
  isOffscreenFaster: boolean;
  /** Recommended processing method */
  recommendation: 'standard' | 'offscreen';
}

// SystemPerformanceProfile is directly defined in advanced/index.ts
// Only re-export is performed here to resolve type dependency issues
