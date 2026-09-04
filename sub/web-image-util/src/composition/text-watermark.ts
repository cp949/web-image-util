import type { Point, Position, Size } from './position-types';
import type { WatermarkContentAdapter } from './watermark-content.internal';
import { renderWatermarkContentOnce, renderWatermarkContentTiled } from './watermark-content.internal';

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
    const { text, position, customPosition, style, rotation = 0, margin = { x: 10, y: 10 } } = options;
    const containerSize: Size = { width: canvas.width, height: canvas.height };

    const adapter: WatermarkContentAdapter = {
      prepare(ctx): Size {
        TextWatermark.applyTextStyle(ctx, style);
        const textMetrics = ctx.measureText(text);
        return { width: textMetrics.width, height: style.fontSize || 16 };
      },
      draw(ctx, origin) {
        if (style.shadow) {
          ctx.shadowColor = style.shadow.color;
          ctx.shadowOffsetX = style.shadow.offsetX;
          ctx.shadowOffsetY = style.shadow.offsetY;
          ctx.shadowBlur = style.shadow.blur;
        }

        if (style.strokeWidth && style.strokeColor) {
          ctx.strokeText(text, origin.x, origin.y);
        }

        ctx.fillText(text, origin.x, origin.y);
      },
    };

    return renderWatermarkContentOnce(canvas, 'TextWatermark.addToCanvas', adapter, {
      containerSize,
      position,
      customPosition,
      margin,
      rotation,
    });
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
    const { text, style, rotation = 0, spacing, stagger = false } = options;

    const adapter: WatermarkContentAdapter = {
      prepare(ctx): Size {
        TextWatermark.applyTextStyle(ctx, style);
        const textMetrics = ctx.measureText(text);
        return { width: textMetrics.width, height: style.fontSize || 16 };
      },
      draw(ctx, { x, y }) {
        if (style.strokeWidth && style.strokeColor) {
          ctx.strokeText(text, x, y);
        }
        ctx.fillText(text, x, y);
      },
    };

    return renderWatermarkContentTiled(canvas, adapter, {
      containerSize: { width: canvas.width, height: canvas.height },
      spacing,
      stagger,
      rotation,
      rotationMode: 'frame',
      context: 'TextWatermark.addRepeatingPattern',
    });
  }
}
