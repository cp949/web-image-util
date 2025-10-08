/**
 * ResizeCalculator: Dedicated class for resize calculation logic
 *
 * @description
 * - Handles calculation logic for the new ResizeConfig API
 * - Provides optimized calculation methods for each fit mode
 * - Implemented based on Sharp library's calculation approach
 * - Single responsibility: Only performs layout calculations, rendering is handled by OnehotRenderer
 */

import type { ResizeConfig, Padding } from '../types/resize-config';
import type { GeometryPoint, GeometrySize } from '../types/base';

// ============================================================================
// INTERFACES - Interface definitions
// ============================================================================

/**
 * Normalized padding value
 *
 * @description
 * Object that explicitly includes all padding values
 * - All top, right, bottom, left specified as numbers
 * - Guarantees non-negative values
 */
export interface NormalizedPadding {
  /** Top padding (pixels) */
  top: number;
  /** Right padding (pixels) */
  right: number;
  /** Bottom padding (pixels) */
  bottom: number;
  /** Left padding (pixels) */
  left: number;
}

/**
 * Resize calculation result
 *
 * @description
 * Final layout information calculated by ResizeCalculator
 * - imageSize: Size of the image to be actually drawn (with scale applied)
 * - canvasSize: Final canvas size (including padding)
 * - position: Starting coordinates to draw the image within the canvas
 */
export interface LayoutResult {
  /** Size of the image to be actually drawn (with scale applied) */
  imageSize: GeometrySize;
  /** Final canvas size (including padding) */
  canvasSize: GeometrySize;
  /** Starting coordinates to draw the image within the canvas */
  position: GeometryPoint;
}

// ============================================================================
// UTILITY FUNCTIONS - Utility functions
// ============================================================================

/**
 * Convert padding to normalized form
 *
 * @param padding - Padding in number or object form
 * @returns Normalized padding object
 *
 * @description
 * Convert various forms of padding input to unified form:
 * - Number: Apply same value to all 4 directions
 * - Object: Apply only specified values, others default to 0
 * - undefined: All directions default to 0
 *
 * @example
 * ```typescript
 * normalizePadding(20);
 * // → { top: 20, right: 20, bottom: 20, left: 20 }
 *
 * normalizePadding({ top: 10, left: 20 });
 * // → { top: 10, right: 0, bottom: 0, left: 20 }
 *
 * normalizePadding();
 * // → { top: 0, right: 0, bottom: 0, left: 0 }
 * ```
 */
function normalizePadding(padding?: Padding): NormalizedPadding {
  // If padding is a number: apply same value to all 4 directions
  if (typeof padding === 'number') {
    return {
      top: padding,
      right: padding,
      bottom: padding,
      left: padding,
    };
  }

  // If padding is an object: apply only specified values, others default to 0
  if (typeof padding === 'object' && padding !== null) {
    return {
      top: padding.top ?? 0,
      right: padding.right ?? 0,
      bottom: padding.bottom ?? 0,
      left: padding.left ?? 0,
    };
  }

  // If padding is undefined: all directions default to 0
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

// ============================================================================
// RESIZE CALCULATOR - Main class
// ============================================================================

/**
 * ResizeCalculator class
 *
 * @description
 * Dedicated class for resize calculation logic of the new ResizeConfig API
 *
 * @example
 * ```typescript
 * const calculator = new ResizeCalculator();
 * const layout = calculator.calculateFinalLayout(
 *   1920, 1080,
 *   { fit: 'cover', width: 800, height: 600 }
 * );
 * // layout = {
 * //   imageSize: { width: 1067, height: 600 },
 * //   canvasSize: { width: 800, height: 600 },
 * //   position: { x: -133, y: 0 }
 * // }
 * ```
 */
export class ResizeCalculator {
  /**
   * Final layout calculation (main entry point)
   *
   * @param originalWidth - Original image width
   * @param originalHeight - Original image height
   * @param config - ResizeConfig settings
   * @returns Calculated layout information
   *
   * @description
   * Calls appropriate calculation methods based on fit mode,
   * applies padding and returns final layout
   */
  calculateFinalLayout(originalWidth: number, originalHeight: number, config: ResizeConfig): LayoutResult {
    // 1. Calculate image size (based on fit mode)
    const imageSize = this.calculateImageSize(originalWidth, originalHeight, config);

    // 2. Calculate canvas size (apply padding)
    const canvasSize = this.calculateCanvasSize(imageSize, config);

    // 3. Calculate image position (center alignment + padding)
    const position = this.calculatePosition(imageSize, canvasSize, config);

    return {
      imageSize,
      canvasSize,
      position,
    };
  }

  /**
   * Calculate image size
   *
   * @param originalWidth - Original image width
   * @param originalHeight - Original image height
   * @param config - ResizeConfig settings
   * @returns Image size with scale applied
   *
   * @description
   * Calculate the actual size the image will be drawn based on fit mode
   * - cover: Scale to fill canvas completely
   * - contain: Scale to fit within canvas
   * - fill: Fit exactly to canvas size
   * - maxFit: Only allow shrinking
   * - minFit: Only allow enlarging
   */
  private calculateImageSize(originalWidth: number, originalHeight: number, config: ResizeConfig): GeometrySize {
    switch (config.fit) {
      case 'cover':
        return this.calculateCoverSize(originalWidth, originalHeight, config);
      case 'contain':
        return this.calculateContainSize(originalWidth, originalHeight, config);
      case 'fill':
        return this.calculateFillSize(originalWidth, originalHeight, config);
      case 'maxFit':
        return this.calculateMaxFitSize(originalWidth, originalHeight, config);
      case 'minFit':
        return this.calculateMinFitSize(originalWidth, originalHeight, config);
      default:
        throw new Error(`Unknown fit mode: ${(config as any).fit}`);
    }
  }

  /**
   * Calculate canvas size
   *
   * @param imageSize - Calculated image size
   * @param config - ResizeConfig settings
   * @returns Final canvas size with padding applied
   *
   * @description
   * Calculate canvas size based on fit mode
   * - cover/contain/fill: target width/height is canvas size (fixed)
   * - maxFit/minFit: image size is canvas size (variable)
   * - Apply additional padding if present
   *
   * @example
   * ```typescript
   * // cover: Canvas is fixed to target size
   * calculateCanvasSize({ width: 1422, height: 800 }, { fit: 'cover', width: 800, height: 800 });
   * // → { width: 800, height: 800 }
   *
   * // maxFit: Image size becomes canvas size
   * calculateCanvasSize({ width: 100, height: 100 }, { fit: 'maxFit', width: 300, height: 200 });
   * // → { width: 100, height: 100 }
   *
   * // Apply padding
   * calculateCanvasSize({ width: 800, height: 450 }, { fit: 'contain', width: 800, height: 800, padding: 20 });
   * // → { width: 840, height: 840 }
   * ```
   */
  private calculateCanvasSize(imageSize: GeometrySize, config: ResizeConfig): GeometrySize {
    // Normalize padding
    const padding = normalizePadding(config.padding);

    // Determine base canvas size based on fit mode
    let baseWidth: number;
    let baseHeight: number;

    if (config.fit === 'cover' || config.fit === 'contain' || config.fit === 'fill') {
      // cover/contain/fill: target size is canvas size
      baseWidth = config.width;
      baseHeight = config.height;
    } else {
      // maxFit/minFit: image size is canvas size
      baseWidth = imageSize.width;
      baseHeight = imageSize.height;
    }

    // Apply padding
    return {
      width: baseWidth + padding.left + padding.right,
      height: baseHeight + padding.top + padding.bottom,
    };
  }

  /**
   * Calculate image position
   *
   * @param imageSize - Calculated image size
   * @param canvasSize - Calculated canvas size
   * @param config - ResizeConfig settings
   * @returns Starting coordinates to draw the image within the canvas
   *
   * @description
   * Calculate starting coordinates to draw image within canvas
   * - cover: Center alignment, negative coordinates possible (clipped)
   * - contain: Center alignment, margins created
   * - fill: Start at (0, 0) coordinates
   * - Consider padding
   *
   * @example
   * ```typescript
   * // Without padding (center alignment)
   * calculatePosition({ width: 100, height: 100 }, { width: 200, height: 200 }, config);
   * // → { x: 50, y: 50 }
   *
   * // With numeric padding
   * calculatePosition({ width: 100, height: 100 }, { width: 140, height: 140 }, { ...config, padding: 20 });
   * // → { x: 20, y: 20 } (shifted by padding amount)
   *
   * // With object padding
   * calculatePosition({ width: 100, height: 100 }, { width: 120, height: 110 }, { ...config, padding: { top: 10, left: 20 } });
   * // → { x: 20, y: 10 } (shifted by padding in each direction)
   * ```
   */
  private calculatePosition(imageSize: GeometrySize, canvasSize: GeometrySize, config: ResizeConfig): GeometryPoint {
    // Normalize padding
    const padding = normalizePadding(config.padding);

    // Calculate actual placement area size excluding padding
    const availableWidth = canvasSize.width - padding.left - padding.right;
    const availableHeight = canvasSize.height - padding.top - padding.bottom;

    // Center alignment: divide margins in half for placement
    // - cover: negative coordinates if image is larger (clipped)
    // - contain: positive coordinates if image is smaller (margins)
    const x = padding.left + Math.round((availableWidth - imageSize.width) / 2);
    const y = padding.top + Math.round((availableHeight - imageSize.height) / 2);

    return { x, y };
  }

  // ============================================================================
  // FIT MODE CALCULATIONS - Calculation methods by fit mode
  // ============================================================================

  /**
   * Calculate cover fit size
   *
   * @description
   * Logic to fill area while maintaining aspect ratio
   * - Scale image to completely cover canvas
   * - Excess parts are clipped
   * - Same as CSS object-fit: cover
   */
  private calculateCoverSize(
    originalWidth: number,
    originalHeight: number,
    config: { width: number; height: number }
  ): GeometrySize {
    const { width: targetW, height: targetH } = config;

    // Choose larger of horizontal/vertical ratios to completely cover canvas
    const scaleX = targetW / originalWidth;
    const scaleY = targetH / originalHeight;
    const scale = Math.max(scaleX, scaleY);

    return {
      width: Math.round(originalWidth * scale),
      height: Math.round(originalHeight * scale),
    };
  }

  /**
   * Calculate contain fit size
   *
   * @description
   * Logic to fit entire image while maintaining aspect ratio
   * - Scale image to fit entirely within canvas
   * - Margins may be created
   * - Same as CSS object-fit: contain
   */
  private calculateContainSize(
    originalWidth: number,
    originalHeight: number,
    config: { width: number; height: number }
  ): GeometrySize {
    const { width: targetW, height: targetH } = config;

    // Choose smaller of horizontal/vertical ratios to fit entire image
    const scaleX = targetW / originalWidth;
    const scaleY = targetH / originalHeight;
    const scale = Math.min(scaleX, scaleY);

    return {
      width: Math.round(originalWidth * scale),
      height: Math.round(originalHeight * scale),
    };
  }

  /**
   * Calculate fill fit size
   *
   * @description
   * Logic to fit exactly while ignoring aspect ratio
   * - Image may be stretched or compressed
   * - Same as CSS object-fit: fill
   */
  private calculateFillSize(
    originalWidth: number,
    originalHeight: number,
    config: { width: number; height: number }
  ): GeometrySize {
    const { width: targetW, height: targetH } = config;

    // Return target size as is (ignore aspect ratio)
    return {
      width: targetW,
      height: targetH,
    };
  }

  /**
   * Calculate MaxFit size
   *
   * @description
   * Maximum size constraint logic (no enlargement)
   * - Small images remain unchanged
   * - Large images are shrunk
   * - Maintains aspect ratio
   */
  private calculateMaxFitSize(
    originalWidth: number,
    originalHeight: number,
    config: { width?: number; height?: number }
  ): GeometrySize {
    const { width: maxW, height: maxH } = config;

    // Minimum 1x scale (no enlargement)
    let scale = 1;

    // Apply maximum value constraints for each dimension
    if (maxW) scale = Math.min(scale, maxW / originalWidth);
    if (maxH) scale = Math.min(scale, maxH / originalHeight);

    return {
      width: Math.round(originalWidth * scale),
      height: Math.round(originalHeight * scale),
    };
  }

  /**
   * Calculate MinFit size
   *
   * @description
   * Minimum size guarantee logic (no shrinking)
   * - Small images are enlarged
   * - Large images remain unchanged
   * - Maintains aspect ratio
   */
  private calculateMinFitSize(
    originalWidth: number,
    originalHeight: number,
    config: { width?: number; height?: number }
  ): GeometrySize {
    const { width: minW, height: minH } = config;

    // Minimum 1x scale (no shrinking)
    let scale = 1;

    // Guarantee minimum values for each dimension
    if (minW) scale = Math.max(scale, minW / originalWidth);
    if (minH) scale = Math.max(scale, minH / originalHeight);

    return {
      width: Math.round(originalWidth * scale),
      height: Math.round(originalHeight * scale),
    };
  }
}
