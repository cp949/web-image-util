import { requireCanvasContext, withCanvasState } from './canvas-drawing.internal';
import { placeOnce, placeTiled } from './placement.internal';
import type { Point, Position, Size } from './position-types';

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
    const ctx = requireCanvasContext(canvas, 'TextWatermark.addToCanvas');

    const { text, position, customPosition, style, rotation = 0, margin = { x: 10, y: 10 } } = options;

    // 스타일 적용부터 그리기까지를 하나의 save/restore 안에 둔다.
    // applyTextStyle은 ctx의 font·globalAlpha·fillStyle·textBaseline 등을 바꾸므로,
    // 밖에서 호출하면 호출자 소유 Canvas에 그 상태가 남는다.
    withCanvasState(ctx, () => {
      // 텍스트 스타일 적용
      TextWatermark.applyTextStyle(ctx, style);

      // 텍스트 크기 측정
      const textMetrics = ctx.measureText(text);
      const textSize: Size = {
        width: textMetrics.width,
        height: style.fontSize || 16,
      };

      const containerSize: Size = { width: canvas.width, height: canvas.height };
      placeOnce(
        ctx,
        { containerSize, objectSize: textSize, position, customPosition, margin, rotation },
        (textPosition) => {
          if (style.shadow) {
            ctx.shadowColor = style.shadow.color;
            ctx.shadowOffsetX = style.shadow.offsetX;
            ctx.shadowOffsetY = style.shadow.offsetY;
            ctx.shadowBlur = style.shadow.blur;
          }

          if (style.strokeWidth && style.strokeColor) {
            ctx.strokeText(text, textPosition.x, textPosition.y);
          }

          ctx.fillText(text, textPosition.x, textPosition.y);
        }
      );
    });

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
      TextWatermark.addToCanvas(canvas, watermark);
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
    const ctx = requireCanvasContext(canvas, 'TextWatermark.addRepeatingPattern');

    const { text, style, rotation = 0, spacing, stagger = false } = options;

    // addToCanvas와 같은 이유로 스타일 적용을 save/restore 안으로 넣는다
    withCanvasState(ctx, () => {
      TextWatermark.applyTextStyle(ctx, style);
      const textMetrics = ctx.measureText(text);
      const textWidth = textMetrics.width;
      const textHeight = style.fontSize || 16;

      placeTiled(
        ctx,
        {
          containerSize: { width: canvas.width, height: canvas.height },
          tileSize: { width: textWidth, height: textHeight },
          spacing,
          stagger,
          rotation,
          rotationMode: 'frame',
          context: 'TextWatermark.addRepeatingPattern',
        },
        ({ x, y }) => {
          if (style.strokeWidth && style.strokeColor) {
            ctx.strokeText(text, x, y);
          }
          ctx.fillText(text, x, y);
        }
      );
    });

    return canvas;
  }
}
