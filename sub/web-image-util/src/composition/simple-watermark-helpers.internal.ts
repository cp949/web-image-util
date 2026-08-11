import { Position } from './position-types';
import type { TextStyle } from './text-watermark';

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

export function convertSimplePosition(position: SimplePosition): Position {
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

export function resolveSimpleTextStyle(
  style: PresetTextStyle | TextStyle,
  size: 'small' | 'medium' | 'large' | number
): TextStyle {
  if (typeof style === 'object') {
    const resolvedSize = resolveSimpleTextSize(size);
    return { ...style, fontSize: resolvedSize };
  }

  const fontSize = resolveSimpleTextSize(size);

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

export function resolveSimpleTextSize(size: 'small' | 'medium' | 'large' | number): number {
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

export function resolveSimpleImageScale(
  size: 'small' | 'medium' | 'large' | number,
  canvas: HTMLCanvasElement,
  image: HTMLImageElement
): number {
  if (typeof size === 'number') {
    return size;
  }

  const canvasSize = Math.min(canvas.width, canvas.height);
  const imageSize = Math.max(image.width, image.height);

  const relativeSizes = {
    small: 0.05,
    medium: 0.1,
    large: 0.2,
  };

  const targetSize = canvasSize * relativeSizes[size];
  return targetSize / imageSize;
}

export function mapSimpleBlendMode(
  blendMode: 'normal' | 'multiply' | 'overlay' | 'soft-light'
): GlobalCompositeOperation {
  const blendModeMap: Record<string, GlobalCompositeOperation> = {
    normal: 'source-over',
    multiply: 'multiply',
    overlay: 'overlay',
    'soft-light': 'soft-light',
  };

  return blendModeMap[blendMode] || 'source-over';
}
