/**
 * ImageShortcutBuilder - Collection of convenient resizing methods
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
 * imageShortcut(src).coverBox(300, 200);
 *
 * // Various shortcut methods
 * imageShortcut(src).maxWidth(500);                 // Maximum width constraint
 * imageShortcut(src).scale(1.5);                    // 1.5x scale up
 * imageShortcut(src).exactSize(400, 300);           // Exact size
 * ```
 */

import { processImage } from '../processor';
import type { ImageSource, ProcessorOptions } from '../types';
import type { IImageProcessor } from '../types/processor-interface';
import type { ContainConfig, CoverConfig, MaxFitConfig, MinFitConfig, ScaleValue } from '../types/resize-config';

/**
 * ImageShortcutBuilder class
 *
 * @description 각 메서드는 내부적으로 `IImageProcessor.resize()`를 호출한다. resize 1회 제약은
 * 그 `resize()`의 런타임 가드(`LazyRenderPipeline.addResize`)가 단일 소유한다.
 * (별도 인터페이스 미러 없이 클래스가 공개 타입 표면을 겸한다)
 */
export class ImageShortcutBuilder {
  constructor(private processor: IImageProcessor) {}

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
   * @param options Additional options (position)
   * @returns IImageProcessor 인스턴스(체이닝 가능)
   *
   * @example
   * ```typescript
   * // Basic usage
   * await imageShortcut(src).coverBox(300, 200).toBlob();
   *
   * // With options
   * await imageShortcut(src).coverBox(300, 200, {
   *   position: 'top-left'
   * }).toBlob();
   * ```
   */
  coverBox(
    width: number,
    height: number,
    options?: Partial<Omit<CoverConfig, 'fit' | 'width' | 'height'>>
  ): IImageProcessor {
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
   * @param options Additional options (withoutEnlargement, position)
   * @returns IImageProcessor 인스턴스(체이닝 가능)
   *
   * @example
   * ```typescript
   * // Basic usage (both enlargement and reduction)
   * await imageShortcut(src).containBox(300, 200).toBlob();
   *
   * // Prevent enlargement (reduction only)
   * await imageShortcut(src).containBox(300, 200, {
   *   withoutEnlargement: true
   * }).toBlob();
   *
   * ```
   */
  containBox(
    width: number,
    height: number,
    options?: Partial<Omit<ContainConfig, 'fit' | 'width' | 'height'>>
  ): IImageProcessor {
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
   * @returns IImageProcessor 인스턴스(체이닝 가능)
   *
   * @example
   * ```typescript
   * // Convert to exactly 300x200 size (ignoring aspect ratio)
   * await imageShortcut(src).exactSize(300, 200).toBlob();
   * ```
   */
  exactSize(width: number, height: number): IImageProcessor {
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
   * @returns IImageProcessor 인스턴스(체이닝 가능)
   *
   * @example
   * ```typescript
   * // Limit width to not exceed 500px (maintains aspect ratio, reduction only)
   * await imageShortcut(src).maxWidth(500).toBlob();
   * ```
   */
  maxWidth(width: number, options?: Partial<Omit<MaxFitConfig, 'fit' | 'width'>>): IImageProcessor {
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
   * @returns IImageProcessor 인스턴스(체이닝 가능)
   *
   * @example
   * ```typescript
   * // Limit height to not exceed 400px (maintains aspect ratio, reduction only)
   * await imageShortcut(src).maxHeight(400).toBlob();
   * ```
   */
  maxHeight(height: number, options?: Partial<Omit<MaxFitConfig, 'fit' | 'height'>>): IImageProcessor {
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
   * @returns IImageProcessor 인스턴스(체이닝 가능)
   *
   * @example
   * ```typescript
   * // Limit to fit within 800x600 box (maintains aspect ratio, reduction only)
   * await imageShortcut(src).maxSize({ width: 800, height: 600 }).toBlob();
   * ```
   */
  maxSize(
    size: { width: number; height: number },
    options?: Partial<Omit<MaxFitConfig, 'fit' | 'width' | 'height'>>
  ): IImageProcessor {
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
   * @returns IImageProcessor 인스턴스(체이닝 가능)
   *
   * @example
   * ```typescript
   * // Ensure width is at least 300px (maintains aspect ratio, enlargement only)
   * await imageShortcut(src).minWidth(300).toBlob();
   * ```
   */
  minWidth(width: number, options?: Partial<Omit<MinFitConfig, 'fit' | 'width'>>): IImageProcessor {
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
   * @returns IImageProcessor 인스턴스(체이닝 가능)
   *
   * @example
   * ```typescript
   * // Ensure height is at least 200px (maintains aspect ratio, enlargement only)
   * await imageShortcut(src).minHeight(200).toBlob();
   * ```
   */
  minHeight(height: number, options?: Partial<Omit<MinFitConfig, 'fit' | 'height'>>): IImageProcessor {
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
   * @returns IImageProcessor 인스턴스(체이닝 가능)
   *
   * @example
   * ```typescript
   * // Ensure image completely fills 400x300 box (maintains aspect ratio, enlargement only)
   * await imageShortcut(src).minSize({ width: 400, height: 300 }).toBlob();
   * ```
   */
  minSize(
    size: { width: number; height: number },
    options?: Partial<Omit<MinFitConfig, 'fit' | 'width' | 'height'>>
  ): IImageProcessor {
    return this.processor.resize({
      fit: 'minFit',
      ...size,
      ...options,
    });
  }

  // ============================================================================
  // 🎯 Group 2: Scale and exact size adjustment methods
  // 원본 크기 의존 설정도 동일하게 공개 resize()로 전달한다 —
  // 원본 크기 해석은 렌더 시점에 calculateFinalLayout이 수행한다
  // ============================================================================

  /**
   * Resize to exact width (height maintains aspect ratio)
   *
   * @description
   * Resizes to the specified width while maintaining aspect ratio for height.
   *
   * @param width Target width (pixels)
   * @returns IImageProcessor 인스턴스
   *
   * @example
   * ```typescript
   * // Width 800px, height auto-calculated
   * await imageShortcut(src).exactWidth(800).toBlob();
   * ```
   */
  exactWidth(width: number): IImageProcessor {
    return this.processor.resize({ fit: 'fill', width });
  }

  /**
   * Resize to exact height (width maintains aspect ratio)
   *
   * @description
   * Resizes to the specified height while maintaining aspect ratio for width.
   *
   * @param height Target height (pixels)
   * @returns IImageProcessor 인스턴스
   *
   * @example
   * ```typescript
   * // Height 600px, width auto-calculated
   * await imageShortcut(src).exactHeight(600).toBlob();
   * ```
   */
  exactHeight(height: number): IImageProcessor {
    return this.processor.resize({ fit: 'fill', height });
  }

  /**
   * Scale-based resizing
   *
   * @description
   * Enlarges or reduces the image by specifying a scale factor.
   * Use a single number for uniform scaling, or an object for axis-specific scaling.
   *
   * @param scale Scale factor (number or { sx?, sy? } object)
   * @returns IImageProcessor 인스턴스
   *
   * @example
   * ```typescript
   * // Uniform scaling
   * await imageShortcut(src).scale(1.5).toBlob();           // 1.5x enlargement
   * await imageShortcut(src).scale(0.5).toBlob();           // 0.5x reduction
   *
   * // Axis-specific scaling
   * await imageShortcut(src).scale({ sx: 2 }).toBlob();     // X-axis only 2x
   * await imageShortcut(src).scale({ sy: 1.5 }).toBlob();   // Y-axis only 1.5x
   * await imageShortcut(src).scale({ sx: 2, sy: 0.75 }).toBlob(); // X-axis 2x, Y-axis 0.75x
   * ```
   */
  scale(scale: ScaleValue): IImageProcessor {
    return this.processor.resize({ fit: 'scale', scale });
  }

  /**
   * X-axis scale resizing
   *
   * @description
   * Applies scaling only to the X-axis (width). Height remains original.
   *
   * @param scaleX X-axis scale factor
   * @returns IImageProcessor 인스턴스
   *
   * @example
   * ```typescript
   * // Enlarge width only by 2x
   * await imageShortcut(src).scaleX(2).toBlob();
   * ```
   */
  scaleX(scaleX: number): IImageProcessor {
    return this.processor.resize({ fit: 'scale', scale: { sx: scaleX } });
  }

  /**
   * Y-axis scale resizing
   *
   * @description
   * Applies scaling only to the Y-axis (height). Width remains original.
   *
   * @param scaleY Y-axis scale factor
   * @returns IImageProcessor 인스턴스
   *
   * @example
   * ```typescript
   * // Reduce height only by 0.5x
   * await imageShortcut(src).scaleY(0.5).toBlob();
   * ```
   */
  scaleY(scaleY: number): IImageProcessor {
    return this.processor.resize({ fit: 'scale', scale: { sy: scaleY } });
  }

  /**
   * Individual X/Y axis scale resizing
   *
   * @description
   * Applies different scale factors to the X-axis and Y-axis individually.
   *
   * @param scaleX X-axis scale factor
   * @param scaleY Y-axis scale factor
   * @returns IImageProcessor 인스턴스
   *
   * @example
   * ```typescript
   * // Width 2x, height 1.5x
   * await imageShortcut(src).scaleXY(2, 1.5).toBlob();
   * ```
   */
  scaleXY(scaleX: number, scaleY: number): IImageProcessor {
    return this.processor.resize({ fit: 'scale', scale: { sx: scaleX, sy: scaleY } });
  }
}

/**
 * Shortcut 진입점
 *
 * @description
 * `processImage()`와 파라미터가 완전히 동일한 별도 진입점이다. `.shortcut` 게터를 거치지 않고
 * `imageShortcut(source, options)`가 곧바로 `ImageShortcutBuilder`를 반환하므로, 축약 문법이
 * `processImage(...)`의 흐름에 섞이지 않는다. 반환된 빌더의 메서드는 내부적으로 `resize()`를
 * 호출한 뒤 `IImageProcessor`를 반환해 이후 `.blur()`, `.box()`, `.toBlob()` 등 체이닝이 그대로
 * 이어진다.
 *
 * 현재는 15개 메서드가 전부 resize 축약이지만, "자주 쓰는 호출을 축약한다"는 개념 자체는
 * resize에 한정되지 않는다 — 향후 다른 축약이 추가되어도 이 진입점 이름은 유효하다.
 *
 * @param source 이미지 소스 (processImage()와 동일)
 * @param options 프로세서 옵션 (processImage()와 동일)
 * @returns ImageShortcutBuilder 인스턴스
 *
 * @example
 * ```typescript
 * const blob = await imageShortcut(src).exactWidth(300).blur(2).toBlob();
 * ```
 */
export function imageShortcut(source: ImageSource, options?: ProcessorOptions): ImageShortcutBuilder {
  return new ImageShortcutBuilder(processImage(source, options));
}
