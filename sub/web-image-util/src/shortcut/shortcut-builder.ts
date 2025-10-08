/**
 * ShortcutBuilder - Collection of convenient resizing methods
 *
 * @description
 * Provides a Shortcut API that allows you to perform resizing with intuitive method names
 * instead of complex ResizeConfig objects.
 *
 * **Benefits:**
 * - Shorter and more readable code
 * - Method names clearly convey intent
 * - Fast coding with IDE autocomplete
 *
 * @example
 * ```typescript
 * // Standard approach
 * processImage(src).resize({ fit: 'cover', width: 300, height: 200 });
 *
 * // Shortcut API (more concise)
 * processImage(src).shortcut.coverBox(300, 200);
 *
 * // Various shortcut methods
 * processImage(src).shortcut.maxWidth(500);                 // Maximum width constraint
 * processImage(src).shortcut.scale(1.5);                    // 1.5x scale up
 * processImage(src).shortcut.exactSize(400, 300);           // Exact size
 * ```
 */

import type { IImageProcessor, IShortcutBuilder } from '../types/processor-interface';
import type { AfterResize, ProcessorState } from '../types/processor-state';
import type { ContainConfig, CoverConfig, MaxFitConfig, MinFitConfig } from '../types/resize-config';
import type { ScaleOperation } from '../types/shortcut-types';

/**
 * ShortcutBuilder class
 *
 * @template TState Current processor state (BeforeResize | AfterResize)
 */
export class ShortcutBuilder<TState extends ProcessorState> implements IShortcutBuilder<TState> {
  constructor(private processor: IImageProcessor<TState>) {}

  // ============================================================================
  // 🎯 Group 1: Direct Mapping
  // Methods that can be immediately converted to ResizeConfig
  // ============================================================================

  /**
   * Cover mode resizing (fills the box completely, may crop parts of the image)
   *
   * @description
   * Behaves identically to CSS object-fit: cover.
   * Maintains the image's aspect ratio while completely filling the specified box.
   * Images larger than the box will be cropped, smaller images will be enlarged.
   *
   * @param width Output width (pixels)
   * @param height Output height (pixels)
   * @param options Additional options (padding, background)
   * @returns IImageProcessor in AfterResize state (chainable)
   *
   * @example
   * ```typescript
   * // Basic usage
   * await processImage(src).shortcut.coverBox(300, 200).toBlob();
   *
   * // With options
   * await processImage(src).shortcut.coverBox(300, 200, {
   *   padding: 10,
   *   background: '#ffffff'
   * }).toBlob();
   * ```
   */
  coverBox(
    width: number,
    height: number,
    options?: Partial<Omit<CoverConfig, 'fit' | 'width' | 'height'>>
  ): IImageProcessor<AfterResize> {
    return this.processor.resize({
      fit: 'cover',
      width,
      height,
      ...options,
    });
  }

  /**
   * Contain mode resizing (fits entire image within the box, may create margins)
   *
   * @description
   * Behaves identically to CSS object-fit: contain.
   * Maintains the image's aspect ratio while ensuring the entire image fits within the box.
   * Use withoutEnlargement to control whether to enlarge images smaller than the box.
   *
   * @param width Output width (pixels)
   * @param height Output height (pixels)
   * @param options Additional options (trimEmpty, withoutEnlargement, padding, background)
   * @returns IImageProcessor in AfterResize state (chainable)
   *
   * @example
   * ```typescript
   * // Basic usage (both enlargement and reduction)
   * await processImage(src).shortcut.containBox(300, 200).toBlob();
   *
   * // Prevent enlargement (reduction only)
   * await processImage(src).shortcut.containBox(300, 200, {
   *   withoutEnlargement: true
   * }).toBlob();
   *
   * // Auto-trim empty space
   * await processImage(src).shortcut.containBox(300, 200, {
   *   trimEmpty: true,
   *   background: '#ffffff'
   * }).toBlob();
   * ```
   */
  containBox(
    width: number,
    height: number,
    options?: Partial<Omit<ContainConfig, 'fit' | 'width' | 'height'>>
  ): IImageProcessor<AfterResize> {
    return this.processor.resize({
      fit: 'contain',
      width,
      height,
      ...options,
    });
  }

  /**
   * Fill mode resizing (stretches/compresses image to exact size, ignores aspect ratio)
   *
   * @description
   * Behaves identically to CSS object-fit: fill.
   * Ignores the image's aspect ratio and fits exactly to the specified size.
   * The image may be stretched or compressed.
   *
   * @param width Output width (pixels)
   * @param height Output height (pixels)
   * @returns IImageProcessor in AfterResize state (chainable)
   *
   * @example
   * ```typescript
   * // Convert to exactly 300x200 size (ignoring aspect ratio)
   * await processImage(src).shortcut.exactSize(300, 200).toBlob();
   * ```
   */
  exactSize(width: number, height: number): IImageProcessor<AfterResize> {
    return this.processor.resize({
      fit: 'fill',
      width,
      height,
    });
  }

  /**
   * Maximum width constraint (reduction only, no enlargement)
   *
   * @description
   * Reduces the image if its width exceeds the specified value.
   * Maintains original size if the image is smaller than the specified value.
   * Aspect ratio is always preserved.
   *
   * @param width Maximum width (pixels)
   * @param options Additional options (padding, background)
   * @returns IImageProcessor in AfterResize state (chainable)
   *
   * @example
   * ```typescript
   * // Limit width to not exceed 500px (maintains aspect ratio, reduction only)
   * await processImage(src).shortcut.maxWidth(500).toBlob();
   * ```
   */
  maxWidth(width: number, options?: Partial<Omit<MaxFitConfig, 'fit' | 'width'>>): IImageProcessor<AfterResize> {
    return this.processor.resize({
      fit: 'maxFit',
      width,
      ...options,
    });
  }

  /**
   * Maximum height constraint (reduction only, no enlargement)
   *
   * @description
   * Reduces the image if its height exceeds the specified value.
   * Maintains original size if the image is smaller than the specified value.
   * Aspect ratio is always preserved.
   *
   * @param height Maximum height (pixels)
   * @param options Additional options (padding, background)
   * @returns IImageProcessor in AfterResize state (chainable)
   *
   * @example
   * ```typescript
   * // Limit height to not exceed 400px (maintains aspect ratio, reduction only)
   * await processImage(src).shortcut.maxHeight(400).toBlob();
   * ```
   */
  maxHeight(height: number, options?: Partial<Omit<MaxFitConfig, 'fit' | 'height'>>): IImageProcessor<AfterResize> {
    return this.processor.resize({
      fit: 'maxFit',
      height,
      ...options,
    });
  }

  /**
   * Maximum size constraint (reduction only, no enlargement)
   *
   * @description
   * Reduces the image if its width or height exceeds the specified values.
   * Maintains original size if the image is smaller than the specified values.
   * Aspect ratio is always preserved.
   * Reduction is based on the larger scaling ratio between width and height.
   *
   * @param size Maximum size ({ width, height })
   * @param options Additional options (padding, background)
   * @returns IImageProcessor in AfterResize state (chainable)
   *
   * @example
   * ```typescript
   * // Limit to fit within 800x600 box (maintains aspect ratio, reduction only)
   * await processImage(src).shortcut.maxSize({ width: 800, height: 600 }).toBlob();
   * ```
   */
  maxSize(
    size: { width: number; height: number },
    options?: Partial<Omit<MaxFitConfig, 'fit' | 'width' | 'height'>>
  ): IImageProcessor<AfterResize> {
    return this.processor.resize({
      fit: 'maxFit',
      ...size,
      ...options,
    });
  }

  /**
   * Minimum width guarantee (enlargement only, no reduction)
   *
   * @description
   * Enlarges the image if its width is smaller than the specified value.
   * Maintains original size if the image is larger than the specified value.
   * Aspect ratio is always preserved.
   *
   * @param width Minimum width (pixels)
   * @param options Additional options (padding, background)
   * @returns IImageProcessor in AfterResize state (chainable)
   *
   * @example
   * ```typescript
   * // Ensure width is at least 300px (maintains aspect ratio, enlargement only)
   * await processImage(src).shortcut.minWidth(300).toBlob();
   * ```
   */
  minWidth(width: number, options?: Partial<Omit<MinFitConfig, 'fit' | 'width'>>): IImageProcessor<AfterResize> {
    return this.processor.resize({
      fit: 'minFit',
      width,
      ...options,
    });
  }

  /**
   * Minimum height guarantee (enlargement only, no reduction)
   *
   * @description
   * Enlarges the image if its height is smaller than the specified value.
   * Maintains original size if the image is larger than the specified value.
   * Aspect ratio is always preserved.
   *
   * @param height Minimum height (pixels)
   * @param options Additional options (padding, background)
   * @returns IImageProcessor in AfterResize state (chainable)
   *
   * @example
   * ```typescript
   * // Ensure height is at least 200px (maintains aspect ratio, enlargement only)
   * await processImage(src).shortcut.minHeight(200).toBlob();
   * ```
   */
  minHeight(height: number, options?: Partial<Omit<MinFitConfig, 'fit' | 'height'>>): IImageProcessor<AfterResize> {
    return this.processor.resize({
      fit: 'minFit',
      height,
      ...options,
    });
  }

  /**
   * Minimum size guarantee (enlargement only, no reduction)
   *
   * @description
   * Enlarges the image if its width or height is smaller than the specified values.
   * Maintains original size if the image is larger than the specified values.
   * Aspect ratio is always preserved.
   * Enlargement is based on the smaller scaling ratio between width and height.
   *
   * @param size Minimum size ({ width, height })
   * @param options Additional options (padding, background)
   * @returns IImageProcessor in AfterResize state (chainable)
   *
   * @example
   * ```typescript
   * // Ensure image completely fills 400x300 box (maintains aspect ratio, enlargement only)
   * await processImage(src).shortcut.minSize({ width: 400, height: 300 }).toBlob();
   * ```
   */
  minSize(
    size: { width: number; height: number },
    options?: Partial<Omit<MinFitConfig, 'fit' | 'width' | 'height'>>
  ): IImageProcessor<AfterResize> {
    return this.processor.resize({
      fit: 'minFit',
      ...size,
      ...options,
    });
  }

  // ============================================================================
  // 🔄 Group 2: Lazy Operations
  // Operations requiring source dimensions - calculated at final output time
  // ============================================================================

  // ============================================================================
  // Scale and exact size adjustment methods
  // ============================================================================

  /**
   * Resize to exact width (height maintains aspect ratio)
   *
   * @description
   * Resizes to the specified width while maintaining aspect ratio for height.
   *
   * @param width Target width (pixels)
   * @returns IImageProcessor in AfterResize state
   *
   * @example
   * ```typescript
   * // Width 800px, height auto-calculated
   * await processImage(src).shortcut.exactWidth(800).toBlob();
   * ```
   */
  exactWidth(width: number): IImageProcessor<AfterResize> {
    this.processor._addResizeOperation({ type: 'toWidth', width });
    return this.processor as IImageProcessor<AfterResize>;
  }

  /**
   * Resize to exact height (width maintains aspect ratio)
   *
   * @description
   * Resizes to the specified height while maintaining aspect ratio for width.
   *
   * @param height Target height (pixels)
   * @returns IImageProcessor in AfterResize state
   *
   * @example
   * ```typescript
   * // Height 600px, width auto-calculated
   * await processImage(src).shortcut.exactHeight(600).toBlob();
   * ```
   */
  exactHeight(height: number): IImageProcessor<AfterResize> {
    this.processor._addResizeOperation({ type: 'toHeight', height });
    return this.processor as IImageProcessor<AfterResize>;
  }

  /**
   * Scale-based resizing
   *
   * @description
   * Enlarges or reduces the image by specifying a scale factor.
   * Use a single number for uniform scaling, or an object for axis-specific scaling.
   *
   * @param scale Scale factor (number or { sx?, sy? } object)
   * @returns IImageProcessor in AfterResize state
   *
   * @example
   * ```typescript
   * // Uniform scaling
   * await processImage(src).shortcut.scale(1.5).toBlob();           // 1.5x enlargement
   * await processImage(src).shortcut.scale(0.5).toBlob();           // 0.5x reduction
   *
   * // Axis-specific scaling
   * await processImage(src).shortcut.scale({ sx: 2 }).toBlob();     // X-axis only 2x
   * await processImage(src).shortcut.scale({ sy: 1.5 }).toBlob();   // Y-axis only 1.5x
   * await processImage(src).shortcut.scale({ sx: 2, sy: 0.75 }).toBlob(); // X-axis 2x, Y-axis 0.75x
   * ```
   */
  scale(scale: ScaleOperation): IImageProcessor<AfterResize> {
    this.processor._addResizeOperation({ type: 'scale', value: scale });
    return this.processor as IImageProcessor<AfterResize>;
  }

  /**
   * X-axis scale resizing
   *
   * @description
   * Applies scaling only to the X-axis (width). Height remains original.
   *
   * @param scaleX X-axis scale factor
   * @returns IImageProcessor in AfterResize state
   *
   * @example
   * ```typescript
   * // Enlarge width only by 2x
   * await processImage(src).shortcut.scaleX(2).toBlob();
   * ```
   */
  scaleX(scaleX: number): IImageProcessor<AfterResize> {
    this.processor._addResizeOperation({ type: 'scale', value: { sx: scaleX } });
    return this.processor as IImageProcessor<AfterResize>;
  }

  /**
   * Y-axis scale resizing
   *
   * @description
   * Applies scaling only to the Y-axis (height). Width remains original.
   *
   * @param scaleY Y-axis scale factor
   * @returns IImageProcessor in AfterResize state
   *
   * @example
   * ```typescript
   * // Reduce height only by 0.5x
   * await processImage(src).shortcut.scaleY(0.5).toBlob();
   * ```
   */
  scaleY(scaleY: number): IImageProcessor<AfterResize> {
    this.processor._addResizeOperation({ type: 'scale', value: { sy: scaleY } });
    return this.processor as IImageProcessor<AfterResize>;
  }

  /**
   * Individual X/Y axis scale resizing
   *
   * @description
   * Applies different scale factors to the X-axis and Y-axis individually.
   *
   * @param scaleX X-axis scale factor
   * @param scaleY Y-axis scale factor
   * @returns IImageProcessor in AfterResize state
   *
   * @example
   * ```typescript
   * // Width 2x, height 1.5x
   * await processImage(src).shortcut.scaleXY(2, 1.5).toBlob();
   * ```
   */
  scaleXY(scaleX: number, scaleY: number): IImageProcessor<AfterResize> {
    this.processor._addResizeOperation({ type: 'scale', value: { sx: scaleX, sy: scaleY } });
    return this.processor as IImageProcessor<AfterResize>;
  }
}
