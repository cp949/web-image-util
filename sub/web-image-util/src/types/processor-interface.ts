/**
 * Processor interface separation
 *
 * @description Defines core interfaces for ImageProcessor.
 * Separated interfaces only to prevent circular dependencies.
 */

import type { BlurOptions, OutputOptions, ResultBlob, ResultCanvas, ResultDataURL, ResultFile } from './index';
import type { AfterResize, BeforeResize, ProcessorState } from './processor-state';
import type { ResizeConfig, ContainConfig, CoverConfig, MaxFitConfig, MinFitConfig } from './resize-config';
import type { ResizeOperation, ScaleOperation } from './shortcut-types';

/**
 * Shortcut API interface
 *
 * @description Defines Sharp.js style convenience methods.
 * Defined as interface only to prevent circular dependencies,
 * actual implementation is handled by ShortcutBuilder class.
 *
 * @template TState Processor state (BeforeResize | AfterResize)
 */
export interface IShortcutBuilder<TState extends ProcessorState> {
  // ============================================================================
  // 🎯 Direct Mapping: Methods that can be converted immediately
  // ============================================================================

  /**
   * Cover mode resizing (fills the box completely with image, may crop parts)
   */
  coverBox(
    width: number,
    height: number,
    options?: Partial<Omit<CoverConfig, 'fit' | 'width' | 'height'>>
  ): IImageProcessor<AfterResize>;

  /**
   * Contain mode resizing (fits entire image within box, creates padding)
   */
  containBox(
    width: number,
    height: number,
    options?: Partial<Omit<ContainConfig, 'fit' | 'width' | 'height'>>
  ): IImageProcessor<AfterResize>;

  /**
   * Fill mode resizing (stretches/compresses image to exact size, ignores aspect ratio)
   */
  exactSize(width: number, height: number): IImageProcessor<AfterResize>;

  /**
   * Maximum width limit (shrink only, no enlargement)
   */
  maxWidth(width: number, options?: Partial<Omit<MaxFitConfig, 'fit' | 'width'>>): IImageProcessor<AfterResize>;

  /**
   * Maximum height limit (shrink only, no enlargement)
   */
  maxHeight(height: number, options?: Partial<Omit<MaxFitConfig, 'fit' | 'height'>>): IImageProcessor<AfterResize>;

  /**
   * Maximum size limit (shrink only, no enlargement)
   */
  maxSize(
    size: { width: number; height: number },
    options?: Partial<Omit<MaxFitConfig, 'fit' | 'width' | 'height'>>
  ): IImageProcessor<AfterResize>;

  /**
   * Minimum width guarantee (enlarge only, no shrinking)
   */
  minWidth(width: number, options?: Partial<Omit<MinFitConfig, 'fit' | 'width'>>): IImageProcessor<AfterResize>;

  /**
   * Minimum height guarantee (enlarge only, no shrinking)
   */
  minHeight(height: number, options?: Partial<Omit<MinFitConfig, 'fit' | 'height'>>): IImageProcessor<AfterResize>;

  /**
   * Minimum size guarantee (enlarge only, no shrinking)
   */
  minSize(
    size: { width: number; height: number },
    options?: Partial<Omit<MinFitConfig, 'fit' | 'width' | 'height'>>
  ): IImageProcessor<AfterResize>;

  // ============================================================================
  // 🔄 Lazy Operations: Operations that require source dimensions
  // ============================================================================

  // ============================================================================
  // New method names (v3.0+)
  // ============================================================================

  /**
   * Resize to exact width (height maintains aspect ratio)
   * @since v3.0.0
   */
  exactWidth(width: number): IImageProcessor<AfterResize>;

  /**
   * Resize to exact height (width maintains aspect ratio)
   * @since v3.0.0
   */
  exactHeight(height: number): IImageProcessor<AfterResize>;

  /**
   * Scale-based resizing
   * @since v3.0.0
   */
  scale(scale: ScaleOperation): IImageProcessor<AfterResize>;

  /**
   * X-axis scale resizing (convenience method)
   * @since v3.0.0
   */
  scaleX(scaleX: number): IImageProcessor<AfterResize>;

  /**
   * Y-axis scale resizing (convenience method)
   * @since v3.0.0
   */
  scaleY(scaleY: number): IImageProcessor<AfterResize>;

  /**
   * Individual X/Y-axis scale resizing (convenience method)
   * @since v3.0.0
   */
  scaleXY(scaleX: number, scaleY: number): IImageProcessor<AfterResize>;
}

/**
 * Image processor interface
 *
 * @description Core interface implemented by the ImageProcessor class.
 * ShortcutBuilder depends on this interface to prevent circular dependencies.
 *
 * @template TState Processor state (BeforeResize | AfterResize)
 */
export interface IImageProcessor<TState extends ProcessorState = BeforeResize> {
  /**
   * Shortcut API accessor
   *
   * @description Provides Sharp.js style convenient resizing methods.
   * Supports auto-completion and type checking through type-safe interface.
   */
  shortcut: IShortcutBuilder<TState>;

  /**
   * Image resizing
   * Transitions to AfterResize state after resize() call.
   */
  resize(config: ResizeConfig): IImageProcessor<AfterResize>;

  /**
   * Image blur effect
   * Supports chaining while maintaining state.
   */
  blur(radius?: number, options?: Partial<BlurOptions>): IImageProcessor<TState>;

  /**
   * Convert to Blob
   */
  toBlob(options?: OutputOptions): Promise<ResultBlob>;

  /**
   * Convert to Data URL
   */
  toDataURL(options?: OutputOptions): Promise<ResultDataURL>;

  /**
   * Convert to File object
   */
  toFile(filename: string, options?: OutputOptions): Promise<ResultFile>;

  /**
   * Convert to Canvas
   */
  toCanvas(): Promise<ResultCanvas>;

  /**
   * Add lazy resize operation (internal API)
   *
   * @description Internal method used by ShortcutBuilder.
   * Stores operations that require source dimensions in pending state.
   *
   * @internal
   */
  _addResizeOperation(operation: ResizeOperation): void;
}

/**
 * Initial processor type (before resize() call)
 */
export type InitialProcessorInterface = IImageProcessor<BeforeResize>;

/**
 * Resized processor type (after resize() call)
 */
export type ResizedProcessorInterface = IImageProcessor<AfterResize>;
