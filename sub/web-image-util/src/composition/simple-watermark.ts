/**
 * 간소화된 워터마크 API
 * 사용하기 쉬운 워터마크 인터페이스
 */

import type { ImageWatermarkOptions } from './image-watermark';
import { ImageWatermark } from './image-watermark';
import { Position } from './position-types';
import type { TextStyle, TextWatermarkOptions } from './text-watermark';
import { TextWatermark } from './text-watermark';

/**
 * 간단한 위치 타입 (사용자 친화적)
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
 * 사전 정의된 텍스트 스타일
 */
export type PresetTextStyle =
  | 'default' // 검은색, 16px, 투명도 80%
  | 'white-shadow' // 흰색 텍스트, 검은 그림자
  | 'black-shadow' // 검은색 텍스트, 흰 그림자
  | 'bold-white' // 굵은 흰색 텍스트
  | 'bold-black' // 굵은 검은색 텍스트
  | 'outline' // 흰색 텍스트, 검은 테두리
  | 'subtle'; // 회색, 투명도 60%

/**
 * 간단한 텍스트 워터마크 옵션
 */
export interface SimpleTextWatermarkOptions {
  text: string;
  position?: SimplePosition;
  style?: PresetTextStyle | TextStyle;
  size?: 'small' | 'medium' | 'large' | number;
  opacity?: number; // 0-1
  rotation?: number; // degrees
  margin?: { x: number; y: number }; // 기본값: { x: 10, y: 10 }
}

/**
 * 간단한 이미지 워터마크 옵션
 */
export interface SimpleImageWatermarkOptions {
  image: HTMLImageElement;
  position?: SimplePosition;
  size?: 'small' | 'medium' | 'large' | number; // number는 scale 값 (0-1)
  opacity?: number; // 0-1
  rotation?: number; // degrees
  blendMode?: 'normal' | 'multiply' | 'overlay' | 'soft-light'; // 블렌드 모드
}

/**
 * 간소화된 워터마크 클래스
 */
export class SimpleWatermark {
  /**
   * 간단한 텍스트 워터마크 추가
   * @param canvas - 대상 캔버스
   * @param options - 워터마크 옵션
   * @returns 워터마크가 추가된 캔버스
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

    // 간단한 위치를 내부 Position으로 변환
    const internalPosition = this.convertSimplePosition(position);

    // 스타일 해석
    const textStyle = this.resolveTextStyle(style, size);
    if (opacity !== undefined) {
      textStyle.opacity = opacity;
    }

    // TextWatermark 설정
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
   * 간단한 이미지 워터마크 추가
   * @param canvas - 대상 캔버스
   * @param options - 워터마크 옵션
   * @returns 워터마크가 추가된 캔버스
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

    // 간단한 위치를 내부 Position으로 변환
    const internalPosition = this.convertSimplePosition(position);

    // 크기 해석
    const scale = this.resolveImageSize(size, canvas, image);

    // 블렌드 모드 매핑
    const globalCompositeOperation = this.mapBlendMode(blendMode);

    // ImageWatermark 설정
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
   * 로고 스타일 워터마크 (자동 크기 조정)
   * @param canvas - 대상 캔버스
   * @param image - 로고 이미지
   * @param options - 추가 옵션
   */
  static addLogo(
    canvas: HTMLCanvasElement,
    image: HTMLImageElement,
    options: {
      position?: SimplePosition;
      maxSize?: number; // 캔버스 크기의 백분율 (0-1)
      opacity?: number;
    } = {}
  ): HTMLCanvasElement {
    const {
      position = 'bottom-right',
      maxSize = 0.15, // 캔버스 크기의 15%
      opacity = 0.7,
    } = options;

    // 적응형 크기 조정
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
   * 저작권 텍스트 워터마크 (자주 사용되는 패턴)
   * @param canvas - 대상 캔버스
   * @param copyright - 저작권 텍스트 (예: "© 2024 Company Name")
   * @param options - 추가 옵션
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
   * 반복 패턴 워터마크 (보안용)
   * @param canvas - 대상 캔버스
   * @param text - 반복할 텍스트
   * @param options - 패턴 옵션
   */
  static addPattern(
    canvas: HTMLCanvasElement,
    text: string,
    options: {
      spacing?: number; // 픽셀 단위 간격
      opacity?: number;
      rotation?: number;
      stagger?: boolean; // 엇갈림 배치
    } = {}
  ): HTMLCanvasElement {
    const { spacing = 200, opacity = 0.1, rotation = -45, stagger = true } = options;

    const textStyle = this.resolveTextStyle('subtle', 'medium');
    textStyle.opacity = opacity;

    return TextWatermark.addRepeatingPattern(canvas, {
      text,
      position: this.convertSimplePosition('center'), // 패턴에서는 위치 무시됨
      style: textStyle,
      rotation,
      spacing: { x: spacing, y: spacing },
      stagger,
    });
  }

  /**
   * 간단한 위치를 내부 Position enum으로 변환
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
   * 텍스트 스타일 해석
   */
  private static resolveTextStyle(
    style: PresetTextStyle | TextStyle,
    size: 'small' | 'medium' | 'large' | number
  ): TextStyle {
    // 이미 TextStyle 객체인 경우 크기만 적용하고 반환
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
   * 텍스트 크기 해석
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
   * 이미지 크기 해석
   */
  private static resolveImageSize(
    size: 'small' | 'medium' | 'large' | number,
    canvas: HTMLCanvasElement,
    image: HTMLImageElement
  ): number {
    if (typeof size === 'number') {
      return size;
    }

    // 캔버스 크기에 상대적인 크기 계산
    const canvasSize = Math.min(canvas.width, canvas.height);
    const imageSize = Math.max(image.width, image.height);

    const relativeSizes = {
      small: 0.05, // 캔버스의 5%
      medium: 0.1, // 캔버스의 10%
      large: 0.2, // 캔버스의 20%
    };

    const targetSize = canvasSize * relativeSizes[size];
    return targetSize / imageSize;
  }

  /**
   * 블렌드 모드 매핑
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
 * 편의 함수들 - 더 간단한 사용법 제공
 */

/**
 * 간단한 텍스트 워터마크 추가
 */
export function addTextWatermark(
  canvas: HTMLCanvasElement,
  text: string,
  position: SimplePosition = 'bottom-right'
): HTMLCanvasElement {
  return SimpleWatermark.addText(canvas, { text, position });
}

/**
 * 간단한 이미지 워터마크 추가
 */
export function addImageWatermark(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  position: SimplePosition = 'bottom-right'
): HTMLCanvasElement {
  return SimpleWatermark.addImage(canvas, { image, position });
}

/**
 * 저작권 워터마크 추가
 */
export function addCopyright(canvas: HTMLCanvasElement, copyrightText: string): HTMLCanvasElement {
  return SimpleWatermark.addCopyright(canvas, copyrightText);
}
