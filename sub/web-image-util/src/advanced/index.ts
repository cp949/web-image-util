/**
 * @cp949/web-image-util/advanced
 *
 * @description
 * Advanced image processing features and performance optimization module
 *
 * **Key Features:**
 * - SVG complexity analysis and quality optimization
 * - Browser capability detection and performance profiling
 * - High-performance Canvas configuration and optimization
 * - SVG compatibility enhancement and dimension handling
 * - System resource-based optimal setting recommendations
 *
 * **Usage Scenarios:**
 * - Determining optimal rendering quality for complex SVG files
 * - Automatic detection of browser-specific optimization settings
 * - Setting image processing parameters based on system performance
 * - Canvas-based high-quality image rendering
 *
 * @example
 * ```typescript
 * import { profileSystemPerformance, analyzeSvgComplexity } from '@cp949/web-image-util/advanced';
 *
 * // System performance profiling
 * const profile = await profileSystemPerformance();
 * console.log('Optimal quality level:', profile.recommendedSettings.optimalQualityLevel);
 *
 * // SVG complexity analysis
 * const analysis = analyzeSvgComplexity(svgString);
 * console.log('Recommended quality:', analysis.recommendedQuality);
 * ```
 */

// ============================================================================
// SVG Advanced Processing Features
// ============================================================================
// Note: SVGProcessor, OffscreenSVGProcessor were replaced by unified pipeline in v2.0

// ============================================================================
// Browser Capability Detection and Optimization System
// ============================================================================

/**
 * Browser capability detection and performance analysis module
 *
 * @description Utilities for detecting current browser's image processing capabilities
 * and determining optimal processing modes
 */
export {
  analyzePerformanceFeatures,
  BrowserCapabilityDetector,
  DEFAULT_DETECTION_OPTIONS,
  detectBrowserCapabilities,
  detectFormatSupport,
  detectSyncCapabilities,
  FEATURE_PERFORMANCE_WEIGHTS,
  getOptimalProcessingMode,
  PROCESSING_MODE_DESCRIPTIONS,
} from '../utils/browser-capabilities';

export type { BrowserCapabilities, DetectionOptions, PerformanceFeatures } from '../utils/browser-capabilities';

// ============================================================================
// SVG Quality Analysis and Complexity System
// ============================================================================

/**
 * SVG complexity analysis and quality optimization module
 *
 * @description Advanced features that analyze SVG file structure to determine
 * optimal rendering quality and enhance browser compatibility
 */
export { analyzeSvgComplexity } from '../core/svg-complexity-analyzer';
export type { ComplexityAnalysisResult, QualityLevel, SvgComplexityMetrics } from '../core/svg-complexity-analyzer';

/**
 * SVG compatibility and dimension handling utilities
 *
 * @description Compatibility enhancement and size information extraction features
 * for consistent SVG rendering across various browsers
 */
export { enhanceBrowserCompatibility, normalizeSvgBasics } from '../utils/svg-compatibility';
export { extractSvgDimensions } from '../utils/svg-dimensions';
export type { SvgDimensions } from '../utils/svg-dimensions';

// ============================================================================
// Canvas High-Quality Rendering Configuration
// ============================================================================

/**
 * Canvas high-quality rendering configuration
 *
 * @description Canvas rendering optimization options for image quality enhancement
 */
export { setupHighQualityCanvas } from '../base/canvas-utils';
export type { HighQualityCanvasOptions } from '../base/canvas-utils';

// ============================================================================
// Convenience Functions and Integrated API
// ============================================================================

import type { QualityLevel } from '../core/svg-complexity-analyzer';
import type { BrowserCapabilities, PerformanceFeatures } from '../utils/browser-capabilities';

/**
 * System performance profile result interface
 *
 * @description Comprehensive analysis result of browser's image processing performance
 * including optimization settings tailored to system characteristics
 */
export interface SystemPerformanceProfile {
  /** Browser capabilities */
  capabilities: BrowserCapabilities;
  /** Performance characteristics */
  performance: PerformanceFeatures;
  /** Recommended settings */
  recommendedSettings: {
    /** Maximum concurrent workers */
    maxConcurrentWorkers: number;
    /** Optimal quality level */
    optimalQualityLevel: QualityLevel;
    /** Whether to use OffscreenCanvas */
    useOffscreenCanvas: boolean;
  };
}

/**
 * System performance profiling
 *
 * @description
 * Advanced feature that comprehensively analyzes current browser's image processing
 * performance characteristics and recommends optimal settings
 *
 * **Analysis Items:**
 * - Browser feature support (OffscreenCanvas, WebWorkers, etc.)
 * - Performance characteristics (rendering speed, memory usage, etc.)
 * - Optimal setting calculation (concurrent tasks, quality level, etc.)
 *
 * @returns System performance profile (capabilities, performance, recommended settings)
 *
 * @example
 * ```typescript
 * const profile = await profileSystemPerformance();
 *
 * console.log('OffscreenCanvas support:', profile.capabilities.offscreenCanvas);
 * console.log('Recommended workers:', profile.recommendedSettings.maxConcurrentWorkers);
 * console.log('Optimal quality level:', profile.recommendedSettings.optimalQualityLevel);
 *
 * // Image processing based on recommended settings
 * if (profile.recommendedSettings.useOffscreenCanvas) {
 *   // OffscreenCanvas-based processing
 * }
 * ```
 */
export async function profileSystemPerformance(): Promise<SystemPerformanceProfile> {
  const { BrowserCapabilityDetector } = await import('../utils/browser-capabilities');

  const detector = BrowserCapabilityDetector.getInstance();
  const capabilities = await detector.detectCapabilities();
  const performance = await detector.analyzePerformance();

  // Recommended settings based on system characteristics
  const recommendedSettings = {
    maxConcurrentWorkers: capabilities.webWorkers ? (capabilities.sharedArrayBuffer ? 4 : 2) : 1,
    optimalQualityLevel: capabilities.offscreenCanvas ? ('high' as QualityLevel) : ('medium' as QualityLevel),
    useOffscreenCanvas: performance.canUseOffscreenCanvas,
  };

  return {
    capabilities,
    performance,
    recommendedSettings,
  };
}
