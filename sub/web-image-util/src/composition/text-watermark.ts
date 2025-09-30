import type { Point, Position, Size } from './position-types';
import { PositionCalculator } from './position-types';

/**
 * 텍스트 스타일 옵션
 *
 * @description 텍스트 워터마크의 시각적 스타일을 정의하는 인터페이스입니다.
 * 폰트, 색상, 외곽선, 그림자, 투명도 등 다양한 시각적 속성을 설정할 수 있습니다.
 */
export interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  fontStyle?: 'normal' | 'italic' | 'oblique';
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  shadow?: {
    color: string;
    offsetX: number;
    offsetY: number;
    blur: number;
  };
  opacity?: number; // 0-1
}

/**
 * 텍스트 워터마크 옵션
 *
 * @description 텍스트를 워터마크로 추가할 때의 옵션들을 정의하는 인터페이스입니다.
 * 텍스트 내용, 위치, 스타일, 여백, 회전 등을 설정할 수 있습니다.
 */
export interface TextWatermarkOptions {
  text: string;
  position: Position;
  customPosition?: Point;
  style: TextStyle;
  rotation?: number; // degrees
  margin?: Point;
}

/**
 * 텍스트 워터마크 클래스
 *
 * @description 텍스트를 워터마크로 추가하는 기능을 제공하는 정적 클래스입니다.
 * Canvas에 다양한 스타일의 텍스트 워터마크를 추가하거나 새로운 Canvas를 생성할 수 있습니다.
 */
export class TextWatermark {
  /**
   * 텍스트 워터마크 추가
   */
  static addToCanvas(canvas: HTMLCanvasElement, options: TextWatermarkOptions): HTMLCanvasElement {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D 컨텍스트를 가져올 수 없습니다');

    const { text, position, customPosition, style, rotation = 0, margin = { x: 10, y: 10 } } = options;

    // 텍스트 스타일 설정
    this.applyTextStyle(ctx, style);

    // 텍스트 크기 측정
    const textMetrics = ctx.measureText(text);
    const textSize: Size = {
      width: textMetrics.width,
      height: style.fontSize || 16,
    };

    // 위치 계산
    const containerSize: Size = { width: canvas.width, height: canvas.height };
    const textPosition = PositionCalculator.calculatePosition(
      position,
      customPosition || null,
      containerSize,
      textSize,
      margin
    );

    // 회전 및 그리기
    ctx.save();

    if (rotation !== 0) {
      const centerX = textPosition.x + textSize.width / 2;
      const centerY = textPosition.y + textSize.height / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-centerX, -centerY);
    }

    // 그림자 효과
    if (style.shadow) {
      ctx.shadowColor = style.shadow.color;
      ctx.shadowOffsetX = style.shadow.offsetX;
      ctx.shadowOffsetY = style.shadow.offsetY;
      ctx.shadowBlur = style.shadow.blur;
    }

    // 텍스트 그리기 (textBaseline = 'top'이므로 textPosition.y 사용)
    const drawY = textPosition.y;

    if (style.strokeWidth && style.strokeColor) {
      ctx.strokeText(text, textPosition.x, drawY);
    }

    ctx.fillText(text, textPosition.x, drawY);

    ctx.restore();

    return canvas;
  }

  /**
   * 텍스트 스타일 적용
   */
  private static applyTextStyle(ctx: CanvasRenderingContext2D, style: TextStyle): void {
    const {
      fontFamily = 'Arial',
      fontSize = 16,
      fontWeight = 'normal',
      fontStyle = 'normal',
      color = '#000000',
      strokeColor,
      strokeWidth = 0,
      opacity = 1,
    } = style;

    // 폰트 설정
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

    // 색상 및 투명도 설정
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;

    if (strokeColor && strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
    }

    // 텍스트 정렬
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
  }

  /**
   * 다중 텍스트 워터마크 추가
   */
  static addMultipleToCanvas(canvas: HTMLCanvasElement, watermarks: TextWatermarkOptions[]): HTMLCanvasElement {
    for (const watermark of watermarks) {
      this.addToCanvas(canvas, watermark);
    }
    return canvas;
  }

  /**
   * 반복 패턴 텍스트 워터마크 (타일링)
   */
  static addRepeatingPattern(
    canvas: HTMLCanvasElement,
    options: TextWatermarkOptions & {
      spacing: { x: number; y: number };
      stagger?: boolean;
    }
  ): HTMLCanvasElement {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D 컨텍스트를 가져올 수 없습니다');

    const { text, style, rotation = 0, spacing, stagger = false } = options;

    this.applyTextStyle(ctx, style);
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = style.fontSize || 16;

    ctx.save();

    if (rotation !== 0) {
      ctx.rotate((rotation * Math.PI) / 180);
    }

    let yOffset = 0;
    for (let y = 0; y < canvas.height + textHeight; y += spacing.y) {
      const xOffset = stagger && yOffset % 2 === 1 ? spacing.x / 2 : 0;

      for (let x = -textWidth; x < canvas.width + textWidth; x += spacing.x) {
        if (style.strokeWidth && style.strokeColor) {
          ctx.strokeText(text, x + xOffset, y);
        }
        ctx.fillText(text, x + xOffset, y);
      }
      yOffset++;
    }

    ctx.restore();
    return canvas;
  }
}
