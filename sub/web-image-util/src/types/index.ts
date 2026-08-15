/**
 * @cp949/web-image-util - Unified Type System
 *
 * @description
 * Complete TypeScript type definitions for browser-based image processing.
 * Provides comprehensive type safety for all library operations through discriminated unions,
 * compile-time constraints, and runtime validation.
 *
 * **📦 Type Categories:**
 * - **Base Types**: Core types (ImageSource, OutputFormat, ResizeFit, etc.)
 * - **Resize Types**: Discriminated union ResizeConfig system for type-safe resizing
 * - **Output Types**: Result objects with metadata (ResultBlob, ResultCanvas, etc.)
 * - **Processing Types**: Options and configurations (ProcessorOptions, BlurOptions)
 * - **Utility Types**: SVG, error handling, and feature detection types
 *
 * **🎯 Design Principles:**
 * - **Type Safety**: Discriminated unions prevent invalid configurations at compile time
 * - **Developer Experience**: IntelliSense-friendly with clear parameter constraints
 * - **Runtime Validation**: Type guards and validation functions for runtime safety
 * - **Backwards Compatibility**: Versioned types for stable API evolution
 *
 * **⚡ Key Features:**
 * - ResizeConfig discriminated union prevents invalid fit/dimension combinations
 * - Smart default values with optimal quality per format
 * - Comprehensive error types with structured cause chaining
 * - Browser capability detection types
 *
 * @example Type-Safe Resize Configuration
 * ```typescript
 * import type { ResizeConfig } from '@cp949/web-image-util';
 *
 * // ✅ Valid: cover fit with required dimensions
 * const coverConfig: ResizeConfig = {
 *   fit: 'cover',
 *   width: 300,
 *   height: 200
 * };
 *
 * // ✅ Valid: maxFit with optional dimensions
 * const maxFitConfig: ResizeConfig = {
 *   fit: 'maxFit',
 *   width: 500  // height optional
 * };
 *
 * // ❌ Compile Error: cover fit requires both width AND height
 * const invalidConfig: ResizeConfig = {
 *   fit: 'cover',
 *   width: 300  // Missing height!
 * };
 * ```
 *
 * @example Result Object Types
 * ```typescript
 * import type { ResultBlob, ResultMetadata } from '@cp949/web-image-util';
 *
 * const result: ResultBlob = await processImage(source)
 *   .resize({ fit: 'cover', width: 300, height: 200 })
 *   .toBlob();
 *
 * // Full metadata available
 * console.log(`${result.width}x${result.height}`);
 * console.log(`Processing time: ${result.processingTime}ms`);
 * console.log(`Format: ${result.format}`);
 *
 * // Direct conversion methods
 * const dataURL = await result.toDataURL();
 * const file = await result.toFile('thumbnail.webp');
 * ```
 */

// ============================================================================
// BASE TYPES - Basic types (re-exported from base.ts)
// ============================================================================

export type {
  GeometryPoint,
  GeometryRectangle,
  GeometrySize,
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
// - AfterResizeCall: TypeScript compiler constraint for resize() state transition
// - IImageProcessor, InitialProcessor, ResizedProcessor: Internal implementation types
//
// Users only need to use the ImageProcessor class (exported from '../processor').
// ============================================================================

export { ImageErrorCodeConstants, ImageFormats, OutputFormats, ResizeFitConstants } from './base';

// Re-import types from base.ts to make them available
import type { SvgSanitizerMode } from '../svg-contract.internal';
import type { GeometrySize, OutputFormat, ResizeBackground } from './base';

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
  ScaleConfig,
  ScaleValue,
} from './resize-config';

export {
  isContainConfig,
  isCoverConfig,
  isFillConfig,
  isMaxFitConfig,
  isMinFitConfig,
  isScaleConfig,
  validateResizeConfig,
} from './resize-config';

/**
 * Smart resize options for advanced processing scenarios
 *
 * @description
 * Additional configuration options for complex resize operations.
 * These options work alongside ResizeConfig to provide fine-grained control
 * over processing behavior, performance characteristics, and memory usage.
 *
 * **Performance Profiles:**
 * - `fast`: Prioritize speed over quality (good for previews, thumbnails)
 * - `balanced`: Balance speed and quality (recommended for most use cases)
 * - `quality`: Prioritize quality over speed (best for final output)
 *
 * **Processing Strategies:**
 * - `auto`: Library chooses optimal strategy based on input (recommended)
 * - `fast`: Minimal processing, fastest execution
 * - `quality`: Maximum quality, slower execution
 * - `memory-efficient`: Minimize memory usage, may be slower
 *
 * @example
 * ```typescript
 * // High-quality processing for final output
 * const options: SmartResizeOptions = {
 *   width: 1920,
 *   height: 1080,
 *   performance: 'quality',
 *   strategy: 'quality',
 *   maxMemoryMB: 512
 * };
 *
 * // Fast preview generation
 * const previewOptions: SmartResizeOptions = {
 *   width: 200,
 *   height: 150,
 *   performance: 'fast',
 *   strategy: 'fast',
 *   onProgress: (progress) => console.log(`${progress}% complete`)
 * };
 * ```
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
// BLUR / OUTPUT / RESULT TYPES — 정의는 output-types.ts leaf에 있다.
// 이 재export가 공개 표면(src/index.ts 경유)을 그대로 유지한다.
// ============================================================================

export type {
  BlurOptions,
  OutputOptions,
  ResultBlob,
  ResultCanvas,
  ResultDataURL,
  ResultElement,
  ResultFile,
  ResultMetadata,
} from './output-types';

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

// ============================================================================
// IMAGE ERROR TYPES - Image error-related types
// ============================================================================

export type {
  ImageErrorCodeType,
  ImageErrorDetails,
  ImageErrorDetailsByCode,
  ImageProcessErrorOptions,
} from '../errors.internal';
export { ImageErrorCode, ImageProcessError } from '../errors.internal';

// Canvas API does not have margin/padding concepts like Sharp.js's extend feature
// Users must directly adjust Canvas size if needed

// ============================================================================
// PROCESSOR NAMESPACE - Processor-related types
// ============================================================================

// SvgSanitizerMode의 정의는 SVG 계약 leaf(../svg-contract.internal.ts)가 소유한다.
// core·진단 API와 같은 방향으로 공유하기 위함이며, 이 재export가 공개 표면을 유지한다.
export type { SvgSanitizerMode } from '../svg-contract.internal';

/**
 * Processor global options
 */
export interface ProcessorOptions {
  /** CORS 설정 (기본값: 'anonymous') */
  crossOrigin?: string;
  /** 기본 품질 설정 (기본값: 0.8) */
  defaultQuality?: number;
  /** 기본 배경색 (기본값: 투명 검정) */
  defaultBackground?: ResizeBackground;
  /** 타임아웃 (밀리초, 기본값: 30초) — 하위 호환용으로 유지 */
  timeout?: number;
  /** fetch 요청 타임아웃 (밀리초, 기본값: 30_000). 0이면 타임아웃 없음. */
  fetchTimeoutMs?: number;
  /** fetch 응답 최대 허용 바이트 (기본값: 100 * 1024 * 1024 = 100MiB). 0이면 무제한. */
  maxSourceBytes?: number;
  /** 허용할 URL 프로토콜 목록 (기본값: ['http:', 'https:', 'blob:', 'data:']). */
  allowedProtocols?: string[];
  /** 외부 fetch 취소용 AbortSignal. */
  abortSignal?: AbortSignal;
  /** SVG 입력에 적용할 sanitizer 정책 (기본값: 'lightweight'). */
  svgSanitizer?: SvgSanitizerMode;
  // 브라우저에서는 메모리 제한을 명시적으로 설정할 수 없음
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

// ============================================================================
// SHORTCUT API TYPES - Shortcut API-related types
// ============================================================================

export type { IImageProcessor } from './processor-interface';

// ============================================================================
// SVG QUALITY ENHANCEMENT TYPES - SVG quality enhancement related types
// ============================================================================

// SVG complexity analysis and quality system types
export type { ComplexityAnalysisResult, QualityLevel, SvgComplexityMetrics } from '../core/svg-complexity-analyzer';
export type { SvgDimensions } from '../utils/svg-dimensions';

// (Removed: SvgProcessingOptions, SvgProcessingResult - unnecessary)

// Browser capability detection system types
export type { BrowserCapabilities, DetectionOptions, PerformanceFeatures } from '../utils/browser-capabilities/index';
