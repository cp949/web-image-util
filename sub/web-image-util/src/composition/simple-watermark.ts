/**
 * Simplified watermark API
 * Easy-to-use watermark interface
 */

import type { ImageWatermarkOptions } from './image-watermark';
import { ImageWatermark } from './image-watermark';
import { Position } from './position-types';
import type { TextStyle, TextWatermarkOptions } from './text-watermark';
import { TextWatermark } from './text-watermark';

/**
 * Simple position type (user-friendly)
 */
export type SimplePosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/**
 * Predefined text styles
 */
export type PresetTextStyle =
  | 'default' // black, 16px, 80% opacity
  | 'white-shadow' // white text, black shadow
  | 'black-shadow' // black text, white shadow
  | 'bold-white' // bold white text
  | 'bold-black' // bold black text
  | 'outline' // white text, black border
  | 'subtle'; // gray, 60% opacity

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
    const internalPosition = this.convertSimplePosition(position);

    // Resolve style
    const textStyle = this.resolveTextStyle(style, size);
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
    const internalPosition = this.convertSimplePosition(position);

    // Resolve size
    const scale = this.resolveImageSize(size, canvas, image);

    // Map blend mode
    const globalCompositeOperation = this.mapBlendMode(blendMode);

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
      position: this.convertSimplePosition(position),
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

    return this.addText(canvas, {
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

    const textStyle = this.resolveTextStyle('subtle', 'medium');
    textStyle.opacity = opacity;

    return TextWatermark.addRepeatingPattern(canvas, {
      text,
      position: this.convertSimplePosition('center'), // position ignored in pattern
      style: textStyle,
      rotation,
      spacing: { x: spacing, y: spacing },
      stagger,
    });
  }

  /**
   * Convert simple position to internal Position enum
   */
  private static convertSimplePosition(position: SimplePosition): Position {
    const positionMap: Record<SimplePosition, Position> = {
      'top-left': Position.TOP_LEFT,
      'top-center': Position.TOP_CENTER,
      'top-right': Position.TOP_RIGHT,
      'center-left': Position.MIDDLE_LEFT,
      center: Position.MIDDLE_CENTER,
      'center-right': Position.MIDDLE_RIGHT,
      'bottom-left': Position.BOTTOM_LEFT,
      'bottom-center': Position.BOTTOM_CENTER,
      'bottom-right': Position.BOTTOM_RIGHT,
    };

    return positionMap[position] || Position.BOTTOM_RIGHT;
  }

  /**
   * Resolve text style
   */
  private static resolveTextStyle(
    style: PresetTextStyle | TextStyle,
    size: 'small' | 'medium' | 'large' | number
  ): TextStyle {
    // If already a TextStyle object, apply size only and return
    if (typeof style === 'object') {
      const resolvedSize = this.resolveTextSize(size);
      return { ...style, fontSize: resolvedSize };
    }

    const fontSize = this.resolveTextSize(size);

    const presetStyles: Record<PresetTextStyle, TextStyle> = {
      default: {
        fontFamily: 'Arial, sans-serif',
        fontSize,
        color: '#000000',
        opacity: 0.8,
      },
      'white-shadow': {
        fontFamily: 'Arial, sans-serif',
        fontSize,
        color: '#ffffff',
        shadow: {
          color: 'rgba(0, 0, 0, 0.7)',
          offsetX: 1,
          offsetY: 1,
          blur: 2,
        },
      },
      'black-shadow': {
        fontFamily: 'Arial, sans-serif',
        fontSize,
        color: '#000000',
        shadow: {
          color: 'rgba(255, 255, 255, 0.7)',
          offsetX: 1,
          offsetY: 1,
          blur: 2,
        },
      },
      'bold-white': {
        fontFamily: 'Arial, sans-serif',
        fontSize,
        fontWeight: 'bold',
        color: '#ffffff',
      },
      'bold-black': {
        fontFamily: 'Arial, sans-serif',
        fontSize,
        fontWeight: 'bold',
        color: '#000000',
      },
      outline: {
        fontFamily: 'Arial, sans-serif',
        fontSize,
        color: '#ffffff',
        strokeColor: '#000000',
        strokeWidth: 2,
      },
      subtle: {
        fontFamily: 'Arial, sans-serif',
        fontSize,
        color: '#666666',
        opacity: 0.6,
      },
    };

    return presetStyles[style] || presetStyles.default;
  }

  /**
   * Resolve text size
   */
  private static resolveTextSize(size: 'small' | 'medium' | 'large' | number): number {
    if (typeof size === 'number') {
      return size;
    }

    const sizeMap = {
      small: 12,
      medium: 16,
      large: 24,
    };

    return sizeMap[size] || sizeMap.medium;
  }

  /**
   * Resolve image size
   */
  private static resolveImageSize(
    size: 'small' | 'medium' | 'large' | number,
    canvas: HTMLCanvasElement,
    image: HTMLImageElement
  ): number {
    if (typeof size === 'number') {
      return size;
    }

    // Calculate size relative to canvas
    const canvasSize = Math.min(canvas.width, canvas.height);
    const imageSize = Math.max(image.width, image.height);

    const relativeSizes = {
      small: 0.05, // 5% of canvas
      medium: 0.1, // 10% of canvas
      large: 0.2, // 20% of canvas
    };

    const targetSize = canvasSize * relativeSizes[size];
    return targetSize / imageSize;
  }

  /**
   * Map blend mode
   */
  private static mapBlendMode(blendMode: 'normal' | 'multiply' | 'overlay' | 'soft-light'): GlobalCompositeOperation {
    const blendModeMap: Record<string, GlobalCompositeOperation> = {
      normal: 'source-over',
      multiply: 'multiply',
      overlay: 'overlay',
      'soft-light': 'soft-light',
    };

    return blendModeMap[blendMode] || 'source-over';
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
