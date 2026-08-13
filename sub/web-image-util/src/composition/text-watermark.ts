import {
  applyRotation,
  getOriginRotationCoverageBounds,
  requireCanvasContext,
  withCanvasState,
} from './canvas-drawing.internal';
import { requirePositiveSpacing } from './errors.internal';
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

      // 위치 계산
      const containerSize: Size = { width: canvas.width, height: canvas.height };
      const textPosition = PositionCalculator.calculatePosition(
        position,
        customPosition || null,
        containerSize,
        textSize,
        margin
      );

      // 텍스트 영역 중심을 기준으로 회전한다
      applyRotation(ctx, {
        x: textPosition.x,
        y: textPosition.y,
        width: textSize.width,
        height: textSize.height,
        rotation,
      });

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

    // spacing이 유한 양수가 아니면 아래 타일 루프가 전진하지 않아 브라우저가 멈춘다.
    requirePositiveSpacing(spacing.x, 'spacing.x', 'TextWatermark.addRepeatingPattern');
    requirePositiveSpacing(spacing.y, 'spacing.y', 'TextWatermark.addRepeatingPattern');

    // addToCanvas와 같은 이유로 스타일 적용을 save/restore 안으로 넣는다
    withCanvasState(ctx, () => {
      TextWatermark.applyTextStyle(ctx, style);
      const textMetrics = ctx.measureText(text);
      const textWidth = textMetrics.width;
      const textHeight = style.fontSize || 16;

      // 여기는 타일 중심이 아니라 캔버스 원점을 회전시킨다. 연속된 대각선 텍스트 띠를 만드는
      // 별개 표현이므로 applyRotation(중심 기준)으로 합치지 않는다.
      if (rotation !== 0) {
        ctx.rotate((rotation * Math.PI) / 180);
      }

      // 회전된 프레임에서 캔버스를 덮는 범위는 캔버스 사각형과 어긋난다. 루프 경계를
      // 캔버스 축 기준으로 두면 커버리지가 한쪽으로 쏠리므로 역회전 bounding box에서 파생시킨다.
      // rotation이 0이면 이 범위가 정확히 [0, width] × [0, height]라 회전 없는 출력은 그대로다.
      const bounds = getOriginRotationCoverageBounds(canvas.width, canvas.height, rotation);

      // 타일 실효 범위는 textBaseline='top' 기준 [x, x+textWidth] × [y, y+textHeight]다.
      // strokeText의 lineWidth 번짐은 패딩에 반영하지 않는다 — 최외곽 타일에서 lineWidth/2만큼
      // 모자라지만, 반영하면 회전 없는 경로의 타일 배치까지 바뀐다.
      const startX = bounds.minX - textWidth;
      const endX = bounds.maxX + textWidth;
      const endY = bounds.maxY + textHeight;

      // stagger 오프셋은 루프 첫 행을 짝수로 두고 세는 행 번호를 따른다.
      // 반복 패턴에서 어느 행이 어긋나는지는 임의 기준이며, 회전 0에서는 기존과 같은 행이 어긋난다.
      let rowIndex = 0;
      for (let y = bounds.minY; y < endY; y += spacing.y) {
        const xOffset = stagger && rowIndex % 2 === 1 ? spacing.x / 2 : 0;

        for (let x = startX; x < endX; x += spacing.x) {
          if (style.strokeWidth && style.strokeColor) {
            ctx.strokeText(text, x + xOffset, y);
          }
          ctx.fillText(text, x + xOffset, y);
        }
        rowIndex++;
      }
    });

    return canvas;
  }
}
