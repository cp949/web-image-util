/**
 * Simplified watermark API
 * Easy-to-use watermark interface
 */

import type { ImageWatermarkOptions } from './image-watermark';
import { ImageWatermark } from './image-watermark';
import {
  convertSimplePosition,
  mapSimpleBlendMode,
  type PresetTextStyle,
  resolveSimpleImageScale,
  resolveSimpleTextStyle,
  type SimplePosition,
} from './simple-watermark-helpers.internal';
import type { TextStyle, TextWatermarkOptions } from './text-watermark';
import { TextWatermark } from './text-watermark';

// 공개 타입의 정의는 스택의 leaf(simple-watermark-helpers.internal.ts)에 있다.
// 이 재export가 공개 표면(composition/index·advanced-index 경유)을 그대로 유지한다.
export type { PresetTextStyle, SimplePosition } from './simple-watermark-helpers.internal';

/**
 * Simple text watermark options
 */
export interface SimpleTextWatermarkOptions {
  text: string;
  position?: SimplePosition;
  style?: PresetTextStyle | TextStyle;
  size?: 'small' | 'medium' | 'large' | number;
  opacity?: number; // 0-1
  rotation?: number; // degrees
  margin?: { x: number; y: number }; // default: { x: 10, y: 10 }
}

/**
 * Simple image watermark options
 */
export interface SimpleImageWatermarkOptions {
  image: HTMLImageElement;
  position?: SimplePosition;
  size?: 'small' | 'medium' | 'large' | number; // number is scale value (0-1)
  opacity?: number; // 0-1
  rotation?: number; // degrees
  blendMode?: 'normal' | 'multiply' | 'overlay' | 'soft-light'; // blend mode
}

/**
 * Simplified watermark class
 */
export class SimpleWatermark {
  /**
   * Add simple text watermark
   * @param canvas - target canvas
   * @param options - watermark options
   * @returns canvas with watermark added
   */
  static addText(canvas: HTMLCanvasElement, options: SimpleTextWatermarkOptions): HTMLCanvasElement {
    const {
      text,
      position = 'bottom-right',
      style = 'default',
      size = 'medium',
      opacity = 0.8,
      rotation = 0,
      margin = { x: 10, y: 10 },
    } = options;

    // Convert simple position to internal Position
    const internalPosition = convertSimplePosition(position);

    // Resolve style
    const textStyle = resolveSimpleTextStyle(style, size);
    if (opacity !== undefined) {
      textStyle.opacity = opacity;
    }

    // TextWatermark configuration
    const watermarkOptions: TextWatermarkOptions = {
      text,
      position: internalPosition,
      style: textStyle,
      rotation,
      margin,
    };

    return TextWatermark.addToCanvas(canvas, watermarkOptions);
  }

  /**
   * Add simple image watermark
   * @param canvas - target canvas
   * @param options - watermark options
   * @returns canvas with watermark added
   */
  static addImage(canvas: HTMLCanvasElement, options: SimpleImageWatermarkOptions): HTMLCanvasElement {
    const {
      image,
      position = 'bottom-right',
      size = 'medium',
      opacity = 0.8,
      rotation = 0,
      blendMode = 'normal',
    } = options;

    // Convert simple position to internal Position
    const internalPosition = convertSimplePosition(position);

    // Resolve size
    const scale = resolveSimpleImageScale(size, canvas, image);

    // Map blend mode
    const globalCompositeOperation = mapSimpleBlendMode(blendMode);

    // ImageWatermark configuration
    const watermarkOptions: ImageWatermarkOptions = {
      watermarkImage: image,
      position: internalPosition,
      scale,
      opacity,
      rotation,
      blendMode: globalCompositeOperation,
      margin: { x: 20, y: 20 },
    };

    return ImageWatermark.addToCanvas(canvas, watermarkOptions);
  }

  /**
   * Logo-style watermark (automatic size adjustment)
   * @param canvas - target canvas
   * @param image - logo image
   * @param options - additional options
   */
  static addLogo(
    canvas: HTMLCanvasElement,
    image: HTMLImageElement,
    options: {
      position?: SimplePosition;
      maxSize?: number; // percentage of canvas size (0-1)
      opacity?: number;
    } = {}
  ): HTMLCanvasElement {
    const {
      position = 'bottom-right',
      maxSize = 0.15, // 15% of canvas size
      opacity = 0.7,
    } = options;

    // Adaptive size adjustment
    return ImageWatermark.addWithAdaptiveSize(canvas, {
      watermarkImage: image,
      position: convertSimplePosition(position),
      maxWidthPercent: maxSize,
      maxHeightPercent: maxSize,
      opacity,
      margin: { x: 20, y: 20 },
    });
  }

  /**
   * Copyright text watermark (commonly used pattern)
   * @param canvas - target canvas
   * @param copyright - copyright text (e.g., "© 2024 Company Name")
   * @param options - additional options
   */
  static addCopyright(
    canvas: HTMLCanvasElement,
    copyright: string,
    options: {
      position?: SimplePosition;
      style?: 'light' | 'dark' | 'outline';
    } = {}
  ): HTMLCanvasElement {
    const { position = 'bottom-right', style = 'light' } = options;

    const styleMap = {
      light: 'white-shadow' as PresetTextStyle,
      dark: 'black-shadow' as PresetTextStyle,
      outline: 'outline' as PresetTextStyle,
    };

    return SimpleWatermark.addText(canvas, {
      text: copyright,
      position,
      style: styleMap[style],
      size: 'small',
      opacity: 0.6,
    });
  }

  /**
   * Repeating pattern watermark (for security)
   * @param canvas - target canvas
   * @param text - text to repeat
   * @param options - pattern options
   */
  static addPattern(
    canvas: HTMLCanvasElement,
    text: string,
    options: {
      spacing?: number; // spacing in pixels
      opacity?: number;
      rotation?: number;
      stagger?: boolean; // staggered arrangement
    } = {}
  ): HTMLCanvasElement {
    const { spacing = 200, opacity = 0.1, rotation = -45, stagger = true } = options;

    const textStyle = resolveSimpleTextStyle('subtle', 'medium');
    textStyle.opacity = opacity;

    return TextWatermark.addRepeatingPattern(canvas, {
      text,
      position: convertSimplePosition('center'), // position ignored in pattern
      style: textStyle,
      rotation,
      spacing: { x: spacing, y: spacing },
      stagger,
    });
  }
}

/**
 * Convenience functions - provide simpler usage
 */

/**
 * Add simple text watermark
 */
export function addTextWatermark(
  canvas: HTMLCanvasElement,
  text: string,
  position: SimplePosition = 'bottom-right'
): HTMLCanvasElement {
  return SimpleWatermark.addText(canvas, { text, position });
}

/**
 * Add simple image watermark
 */
export function addImageWatermark(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  position: SimplePosition = 'bottom-right'
): HTMLCanvasElement {
  return SimpleWatermark.addImage(canvas, { image, position });
}

/**
 * Add copyright watermark
 */
export function addCopyright(canvas: HTMLCanvasElement, copyrightText: string): HTMLCanvasElement {
  return SimpleWatermark.addCopyright(canvas, copyrightText);
}
