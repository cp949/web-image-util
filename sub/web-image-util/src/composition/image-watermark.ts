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
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get Canvas 2D context');

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

    ctx.save();

    // Set blending mode and opacity
    ctx.globalCompositeOperation = blendMode;
    ctx.globalAlpha = opacity;

    // Set rotation
    if (rotation !== 0) {
      const centerX = watermarkPosition.x + watermarkSize.width / 2;
      const centerY = watermarkPosition.y + watermarkSize.height / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-centerX, -centerY);
    }

    // Draw image
    ctx.drawImage(watermarkImage, watermarkPosition.x, watermarkPosition.y, watermarkSize.width, watermarkSize.height);

    ctx.restore();
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

    return this.addToCanvas(canvas, {
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
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get Canvas 2D context');

    const {
      watermarkImage,
      scale = 1,
      opacity = 1,
      rotation = 0,
      blendMode = 'source-over',
      spacing,
      stagger = false,
    } = options;

    const watermarkWidth = watermarkImage.width * scale;
    const watermarkHeight = watermarkImage.height * scale;

    ctx.save();
    ctx.globalCompositeOperation = blendMode;
    ctx.globalAlpha = opacity;

    let yOffset = 0;
    for (let y = -watermarkHeight; y < canvas.height + watermarkHeight; y += spacing.y) {
      const xOffset = stagger && yOffset % 2 === 1 ? spacing.x / 2 : 0;

      for (let x = -watermarkWidth; x < canvas.width + watermarkWidth; x += spacing.x) {
        ctx.save();

        if (rotation !== 0) {
          const centerX = x + xOffset + watermarkWidth / 2;
          const centerY = y + watermarkHeight / 2;
          ctx.translate(centerX, centerY);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.translate(-centerX, -centerY);
        }

        ctx.drawImage(watermarkImage, x + xOffset, y, watermarkWidth, watermarkHeight);

        ctx.restore();
      }
      yOffset++;
    }

    ctx.restore();
    return canvas;
  }
}
