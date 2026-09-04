import type { Point, Position, Size } from './position-types';
import type { WatermarkContentAdapter } from './watermark-content.internal';
import { renderWatermarkContentOnce, renderWatermarkContentTiled } from './watermark-content.internal';

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

    const watermarkSize: Size = {
      width: watermarkImage.width * scale,
      height: watermarkImage.height * scale,
    };
    const containerSize: Size = { width: canvas.width, height: canvas.height };

    const adapter: WatermarkContentAdapter = {
      prepare(ctx): Size {
        ctx.globalCompositeOperation = blendMode;
        ctx.globalAlpha = opacity;
        return watermarkSize;
      },
      draw(ctx, origin) {
        ctx.drawImage(watermarkImage, origin.x, origin.y, watermarkSize.width, watermarkSize.height);
      },
    };

    return renderWatermarkContentOnce(canvas, 'ImageWatermark.addToCanvas', adapter, {
      containerSize,
      position,
      customPosition,
      margin,
      rotation,
    });
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
    const {
      watermarkImage,
      scale = 1,
      opacity = 1,
      rotation = 0,
      blendMode = 'source-over',
      spacing,
      stagger = false,
    } = options;

    const watermarkSize: Size = {
      width: watermarkImage.width * scale,
      height: watermarkImage.height * scale,
    };

    const adapter: WatermarkContentAdapter = {
      prepare(ctx): Size {
        ctx.globalCompositeOperation = blendMode;
        ctx.globalAlpha = opacity;
        return watermarkSize;
      },
      draw(ctx, { x, y }) {
        ctx.drawImage(watermarkImage, x, y, watermarkSize.width, watermarkSize.height);
      },
    };

    return renderWatermarkContentTiled(canvas, adapter, {
      containerSize: { width: canvas.width, height: canvas.height },
      spacing,
      stagger,
      rotation,
      rotationMode: 'per-tile',
      context: 'ImageWatermark.addRepeatingPattern',
    });
  }
}
