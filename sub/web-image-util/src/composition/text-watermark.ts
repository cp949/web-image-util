import type { Point, Position, Size } from './position-types';
import { PositionCalculator } from './position-types';

/**
 * Text style options
 *
 * @description Interface that defines visual style of text watermarks.
 * Various visual properties such as font, color, outline, shadow, opacity can be set.
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
 * Text watermark options
 *
 * @description Interface that defines options when adding text as watermark.
 * Text content, position, style, margin, rotation, etc. can be set.
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
 * Text watermark class
 *
 * @description Static class that provides functionality to add text as watermarks.
 * Can add various styled text watermarks to Canvas or create new Canvas.
 */
export class TextWatermark {
  /**
   * Add text watermark to canvas
   */
  static addToCanvas(canvas: HTMLCanvasElement, options: TextWatermarkOptions): HTMLCanvasElement {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get Canvas 2D context');

    const { text, position, customPosition, style, rotation = 0, margin = { x: 10, y: 10 } } = options;

    // Apply text style
    this.applyTextStyle(ctx, style);

    // Measure text size
    const textMetrics = ctx.measureText(text);
    const textSize: Size = {
      width: textMetrics.width,
      height: style.fontSize || 16,
    };

    // Calculate position
    const containerSize: Size = { width: canvas.width, height: canvas.height };
    const textPosition = PositionCalculator.calculatePosition(
      position,
      customPosition || null,
      containerSize,
      textSize,
      margin
    );

    // Rotate and draw
    ctx.save();

    if (rotation !== 0) {
      const centerX = textPosition.x + textSize.width / 2;
      const centerY = textPosition.y + textSize.height / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-centerX, -centerY);
    }

    // Apply shadow effect
    if (style.shadow) {
      ctx.shadowColor = style.shadow.color;
      ctx.shadowOffsetX = style.shadow.offsetX;
      ctx.shadowOffsetY = style.shadow.offsetY;
      ctx.shadowBlur = style.shadow.blur;
    }

    // Draw text (using textPosition.y since textBaseline = 'top')
    const drawY = textPosition.y;

    if (style.strokeWidth && style.strokeColor) {
      ctx.strokeText(text, textPosition.x, drawY);
    }

    ctx.fillText(text, textPosition.x, drawY);

    ctx.restore();

    return canvas;
  }

  /**
   * Apply text style to canvas context
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

    // Set font
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

    // Set color and opacity
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;

    if (strokeColor && strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
    }

    // Set text alignment
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
  }

  /**
   * Add multiple text watermarks to canvas
   */
  static addMultipleToCanvas(canvas: HTMLCanvasElement, watermarks: TextWatermarkOptions[]): HTMLCanvasElement {
    for (const watermark of watermarks) {
      this.addToCanvas(canvas, watermark);
    }
    return canvas;
  }

  /**
   * Add repeating pattern text watermark (tiling)
   */
  static addRepeatingPattern(
    canvas: HTMLCanvasElement,
    options: TextWatermarkOptions & {
      spacing: { x: number; y: number };
      stagger?: boolean;
    }
  ): HTMLCanvasElement {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get Canvas 2D context');

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
