/**
 * OnehotRenderer: Single drawImage call-based rendering engine
 *
 * @description
 * - Handles resizing and padding simultaneously with a single drawImage() call
 * - Renders based on layout information calculated by ResizeCalculator
 * - Responsible for Canvas quality settings and optimization
 * - Memory-efficient Canvas management
 *
 * @design-philosophy
 * - Clear separation between calculation (ResizeCalculator) and rendering (OnehotRenderer)
 * - Single responsibility: Only performs rendering, no calculation logic
 * - Considers Canvas 2D API compatibility
 */

import type { ResizeConfig } from '../types/resize-config';
import type { LayoutResult } from './resize-calculator';
import { productionLog } from '../utils/debug';

// ============================================================================
// INTERFACES - Interface definitions
// ============================================================================

/**
 * Rendering quality levels
 *
 * @description
 * - low: Speed priority (imageSmoothingEnabled = false)
 * - medium: Balanced (default browser settings)
 * - high: Quality priority (imageSmoothingQuality = 'high')
 */
export type RenderQuality = 'low' | 'medium' | 'high';

/**
 * Rendering options
 *
 * @description
 * Options passed to OnehotRenderer's render() method
 * - background: Background color (padding area color)
 * - quality: Rendering quality level
 * - smoothing: Whether to enable image smoothing (explicit control)
 */
export interface RenderOptions {
  /**
   * Background color (CSS color string)
   * @default 'transparent'
   * @example '#ffffff', 'rgba(255, 255, 255, 0.5)'
   */
  background?: string;

  /**
   * Rendering quality level
   * @default 'high'
   */
  quality?: RenderQuality;

  /**
   * Whether to enable image smoothing
   * @default true (automatically determined by quality setting, but can be explicitly overridden)
   */
  smoothing?: boolean;
}

// ============================================================================
// CLASS - OnehotRenderer class
// ============================================================================

/**
 * OnehotRenderer class
 *
 * @description
 * Rendering engine that handles resizing and padding simultaneously with a single drawImage call
 *
 * @example
 * ```typescript
 * const renderer = new OnehotRenderer();
 * const layout = calculator.calculateFinalLayout(sourceSize, config);
 * const outputCanvas = renderer.render(sourceCanvas, layout, config);
 * ```
 */
export class OnehotRenderer {
  /**
   * Main rendering method
   *
   * @description
   * Performs actual rendering based on layout information calculated by ResizeCalculator
   * - Creates new canvas (based on layout.canvasSize)
   * - Fills background color (options.background)
   * - Resizing + positioning with single drawImage call
   *
   * @param sourceCanvas Canvas with loaded original image
   * @param layout Layout information calculated by ResizeCalculator
   * @param config ResizeConfig (includes option information)
   * @param options Rendering options (background color, quality, etc.)
   * @returns Rendered result canvas
   *
   * @example
   * ```typescript
   * const output = renderer.render(sourceCanvas, layout, config, {
   *   background: '#ffffff',
   *   quality: 'high'
   * });
   * ```
   */
  render(
    sourceCanvas: HTMLCanvasElement,
    layout: LayoutResult,
    config: ResizeConfig,
    options?: RenderOptions
  ): HTMLCanvasElement {
    // 1. Create output canvas and validate size
    this.validateLayout(layout);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(layout.canvasSize.width);
    canvas.height = Math.round(layout.canvasSize.height);

    // 2. Set up context (apply quality options)
    const ctx = this.setupCanvas(canvas, options);

    // 3. Fill background color
    const background = options?.background ?? config.background ?? 'transparent';
    this.applyBackground(ctx, canvas.width, canvas.height, background);

    // 4. 🚀 Core: Simultaneous resizing + positioning with single drawImage call
    // Apply Math.round for floating point coordinate handling
    ctx.drawImage(
      sourceCanvas,
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height, // Source area (entire original image)
      Math.round(layout.position.x),
      Math.round(layout.position.y), // Target position (considering padding)
      Math.round(layout.imageSize.width),
      Math.round(layout.imageSize.height) // Target size (resized)
    );

    return canvas;
  }

  /**
   * Set up canvas context
   *
   * @description
   * Get Canvas 2D context and apply quality settings
   * - imageSmoothingEnabled
   * - imageSmoothingQuality
   *
   * @param canvas Canvas to configure
   * @param options Rendering options
   * @returns Configured 2D context
   *
   * @throws {Error} When unable to get 2D context
   */
  private setupCanvas(canvas: HTMLCanvasElement, options?: RenderOptions): CanvasRenderingContext2D {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }

    // Apply quality settings
    const quality = options?.quality ?? 'high';
    this.applyQualitySettings(ctx, quality, options?.smoothing);

    return ctx;
  }

  /**
   * Apply Canvas quality settings
   *
   * @description
   * Set quality-related properties of Canvas 2D context according to RenderQuality
   * - low: imageSmoothingEnabled = false (speed priority)
   * - medium: imageSmoothingEnabled = true, imageSmoothingQuality = 'medium'
   * - high: imageSmoothingEnabled = true, imageSmoothingQuality = 'high'
   *
   * @param ctx Canvas 2D context
   * @param quality Quality level
   * @param smoothingOverride Explicit smoothing override (optional)
   */
  private applyQualitySettings(
    ctx: CanvasRenderingContext2D,
    quality: RenderQuality,
    smoothingOverride?: boolean
  ): void {
    // Whether to enable smoothing
    if (smoothingOverride !== undefined) {
      // Apply explicit override first if available
      ctx.imageSmoothingEnabled = smoothingOverride;
    } else {
      // Automatically determine based on quality
      ctx.imageSmoothingEnabled = quality !== 'low';
    }

    // Set imageSmoothingQuality (only when smoothing is enabled)
    if (ctx.imageSmoothingEnabled) {
      ctx.imageSmoothingQuality = quality;
    }
  }

  /**
   * Apply background color
   *
   * @description
   * Fill Canvas with background color. Does nothing for transparent background.
   * - 'transparent': Does nothing (keeps transparent background)
   * - CSS color string: Set as fillStyle and fill with fillRect
   *
   * @param ctx Canvas 2D context
   * @param width Canvas width
   * @param height Canvas height
   * @param background Background color (CSS color string or 'transparent')
   *
   * @example
   * ```typescript
   * applyBackground(ctx, 800, 600, '#ffffff');  // White background
   * applyBackground(ctx, 800, 600, 'rgba(0, 0, 0, 0.5)');  // Semi-transparent black
   * applyBackground(ctx, 800, 600, 'transparent');  // Transparent (does nothing)
   * ```
   */
  private applyBackground(ctx: CanvasRenderingContext2D, width: number, height: number, background: string): void {
    // Do nothing for transparent background
    if (background === 'transparent' || !background) {
      return;
    }

    // Fill background color
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }

  /**
   * Validate layout
   *
   * @description
   * Validate if LayoutResult has valid values. Throws error for invalid values.
   * - Canvas size must not be 0 or less
   * - Image size must not be 0 or less
   * - Coordinates must not be NaN or Infinity
   *
   * @param layout Layout to validate
   * @throws {Error} When layout is invalid
   */
  private validateLayout(layout: LayoutResult): void {
    const { canvasSize, imageSize, position } = layout;

    // Validate canvas size
    if (canvasSize.width <= 0 || canvasSize.height <= 0) {
      throw new Error(`Invalid canvas size: ${canvasSize.width}x${canvasSize.height}. Both dimensions must be > 0.`);
    }

    // Validate image size
    if (imageSize.width <= 0 || imageSize.height <= 0) {
      throw new Error(`Invalid image size: ${imageSize.width}x${imageSize.height}. Both dimensions must be > 0.`);
    }

    // Validate coordinates (check for NaN or Infinity)
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      throw new Error(`Invalid position: (${position.x}, ${position.y}). Must be finite numbers.`);
    }

    // Warn if canvas size is too large (possible memory shortage)
    const maxCanvasArea = 16384 * 16384; // About 268MB (RGBA basis)
    const canvasArea = canvasSize.width * canvasSize.height;
    if (canvasArea > maxCanvasArea) {
      productionLog.warn(
        `Warning: Large canvas size (${canvasSize.width}x${canvasSize.height}). ` +
          `This may cause memory issues on some devices.`
      );
    }
  }
}
