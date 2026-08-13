import { applyRotation, requireCanvasContext, withCanvasState } from './canvas-drawing.internal';
import { requirePositiveSpacing } from './errors.internal';
import type { Point, Position, Size } from './position-types';
import { PositionCalculator } from './position-types';

/**
 * Image watermark options
 *
 * @description Interface that defines options when using images as watermarks.
 * Allows fine-grained control over position, size, opacity, rotation, blend mode, and more.
 */
export interface ImageWatermarkOptions {
  watermarkImage: HTMLImageElement;
  position: Position;
  customPosition?: Point;
  scale?: number; // 0-1, size relative to original
  opacity?: number; // 0-1
  rotation?: number; // degrees
  margin?: Point;
  blendMode?: GlobalCompositeOperation;
}

/**
 * Image watermark class
 *
 * @description Static class that provides functionality to add images as watermarks.
 * Can add image watermarks to Canvas or create new Canvas instances.
 */
export class ImageWatermark {
  /**
   * Add image watermark to canvas
   */
  static addToCanvas(canvas: HTMLCanvasElement, options: ImageWatermarkOptions): HTMLCanvasElement {
    const ctx = requireCanvasContext(canvas, 'ImageWatermark.addToCanvas');

    const {
      watermarkImage,
      position,
      customPosition,
      scale = 1,
      opacity = 1,
      rotation = 0,
      margin = { x: 10, y: 10 },
      blendMode = 'source-over',
    } = options;

    // Calculate watermark size
    const watermarkSize: Size = {
      width: watermarkImage.width * scale,
      height: watermarkImage.height * scale,
    };

    // Calculate position
    const containerSize: Size = { width: canvas.width, height: canvas.height };
    const watermarkPosition = PositionCalculator.calculatePosition(
      position,
      customPosition || null,
      containerSize,
      watermarkSize,
      margin
    );

    withCanvasState(ctx, () => {
      // Set blending mode and opacity
      ctx.globalCompositeOperation = blendMode;
      ctx.globalAlpha = opacity;

      // 워터마크 영역 중심을 기준으로 회전한다
      applyRotation(ctx, {
        x: watermarkPosition.x,
        y: watermarkPosition.y,
        width: watermarkSize.width,
        height: watermarkSize.height,
        rotation,
      });

      // Draw image
      ctx.drawImage(
        watermarkImage,
        watermarkPosition.x,
        watermarkPosition.y,
        watermarkSize.width,
        watermarkSize.height
      );
    });

    return canvas;
  }

  /**
   * Add watermark with adaptive sizing (automatically adjusted based on container size)
   */
  static addWithAdaptiveSize(
    canvas: HTMLCanvasElement,
    options: ImageWatermarkOptions & {
      maxWidthPercent?: number; // Maximum % of container width
      maxHeightPercent?: number; // Maximum % of container height
    }
  ): HTMLCanvasElement {
    const {
      watermarkImage,
      maxWidthPercent = 0.2, // Default 20%
      maxHeightPercent = 0.2,
    } = options;

    const maxWidth = canvas.width * maxWidthPercent;
    const maxHeight = canvas.height * maxHeightPercent;

    // Fit to maximum size while maintaining aspect ratio
    const widthScale = maxWidth / watermarkImage.width;
    const heightScale = maxHeight / watermarkImage.height;
    const adaptiveScale = Math.min(widthScale, heightScale);

    return ImageWatermark.addToCanvas(canvas, {
      ...options,
      scale: adaptiveScale,
    });
  }

  /**
   * Add repeating pattern image watermark
   */
  static addRepeatingPattern(
    canvas: HTMLCanvasElement,
    options: ImageWatermarkOptions & {
      spacing: { x: number; y: number };
      stagger?: boolean;
    }
  ): HTMLCanvasElement {
    const ctx = requireCanvasContext(canvas, 'ImageWatermark.addRepeatingPattern');

    const {
      watermarkImage,
      scale = 1,
      opacity = 1,
      rotation = 0,
      blendMode = 'source-over',
      spacing,
      stagger = false,
    } = options;

    // spacing이 유한 양수가 아니면 아래 타일 루프가 전진하지 않아 브라우저가 멈춘다.
    requirePositiveSpacing(spacing.x, 'spacing.x', 'ImageWatermark.addRepeatingPattern');
    requirePositiveSpacing(spacing.y, 'spacing.y', 'ImageWatermark.addRepeatingPattern');

    const watermarkWidth = watermarkImage.width * scale;
    const watermarkHeight = watermarkImage.height * scale;

    withCanvasState(ctx, () => {
      ctx.globalCompositeOperation = blendMode;
      ctx.globalAlpha = opacity;

      let yOffset = 0;
      for (let y = -watermarkHeight; y < canvas.height + watermarkHeight; y += spacing.y) {
        const xOffset = stagger && yOffset % 2 === 1 ? spacing.x / 2 : 0;

        for (let x = -watermarkWidth; x < canvas.width + watermarkWidth; x += spacing.x) {
          withCanvasState(ctx, () => {
            // 타일마다 자기 영역 중심을 기준으로 회전한다 (격자는 캔버스 축에 정렬된 채로 유지)
            applyRotation(ctx, {
              x: x + xOffset,
              y,
              width: watermarkWidth,
              height: watermarkHeight,
              rotation,
            });

            ctx.drawImage(watermarkImage, x + xOffset, y, watermarkWidth, watermarkHeight);
          });
        }
        yOffset++;
      }
    });

    return canvas;
  }
}
