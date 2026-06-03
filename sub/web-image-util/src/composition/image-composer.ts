import { withManagedCanvas } from '../base/canvas-utils.internal';
import { ImageProcessError } from '../errors.internal';
import { productionLog } from '../utils/debug.internal';
import { drawImageLayer, drawPlacedImage, drawShadowedImage, fillCanvasBackground } from './canvas-drawing.internal';
import { calculateFitSize, calculateGridMetrics, rectanglesOverlap } from './image-composer-layout.internal';
import type { Rectangle, Size } from './position-types';

/**
 * Layer information
 *
 * @description Interface that defines the properties of layers used in image composition.
 * You can set position, size, transparency, blend mode, rotation, and more.
 */
export interface Layer {
  image: HTMLImageElement;
  x: number;
  y: number;
  width?: number;
  height?: number;
  opacity?: number;
  blendMode?: GlobalCompositeOperation;
  rotation?: number;
  visible?: boolean;
}

/**
 * Composition options
 *
 * @description Interface that defines basic options used for image composition.
 * You can set canvas size and background color.
 */
export interface CompositionOptions {
  backgroundColor?: string;
  width: number;
  height: number;
}

/**
 * Grid layout options
 *
 * @description Interface that defines options used when arranging multiple images in grid format.
 * You can set number of rows and columns, spacing, background color, image fit mode, etc.
 */
export interface GridLayoutOptions {
  rows: number;
  cols: number;
  spacing?: number;
  backgroundColor?: string;
  fit?: 'contain' | 'cover' | 'fill';
}

/**
 * Image composition class
 *
 * @description Static class that provides functions to composite multiple images into one image.
 * Supports layer-based composition, grid layout, collage-style composition, etc.
 */
export class ImageComposer {
  /**
   * Layer-based composition
   */
  static async composeLayers(layers: Layer[], options: CompositionOptions): Promise<HTMLCanvasElement> {
    const { width, height, backgroundColor } = options;

    return withManagedCanvas(width, height, (canvas, ctx) => {
      fillCanvasBackground(ctx, width, height, backgroundColor);

      for (const layer of layers) {
        if (layer.visible === false) continue;

        drawImageLayer(ctx, layer);
      }

      return canvas;
    });
  }

  /**
   * Grid layout composition
   */
  static async composeGrid(images: HTMLImageElement[], options: GridLayoutOptions): Promise<HTMLCanvasElement> {
    const { rows, cols, spacing = 10, backgroundColor = '#ffffff', fit = 'contain' } = options;

    if (images.length === 0) {
      throw new ImageProcessError('No images provided', 'INVALID_SOURCE', {
        details: { label: 'empty-image-list' },
      });
    }
    if (images.length > rows * cols) {
      productionLog.warn(`Too many images (${images.length}). Grid size: ${rows}x${cols}`);
    }

    // Calculate grid size
    const { maxImages, cellWidth, cellHeight, canvasWidth, canvasHeight } = calculateGridMetrics(images, {
      rows,
      cols,
      spacing,
    });

    return withManagedCanvas(canvasWidth, canvasHeight, (canvas, ctx) => {
      fillCanvasBackground(ctx, canvasWidth, canvasHeight, backgroundColor);

      for (let i = 0; i < maxImages; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const image = images[i];

        const cellX = spacing + col * (cellWidth + spacing);
        const cellY = spacing + row * (cellHeight + spacing);

        const { x, y, width, height } = calculateFitSize(image.width, image.height, cellWidth, cellHeight, fit);

        drawPlacedImage(ctx, image, { x: cellX + x, y: cellY + y, width, height });
      }

      return canvas;
    });
  }

  /**
   * Collage-style composition
   */
  static async composeCollage(
    images: HTMLImageElement[],
    canvasSize: Size,
    options: {
      backgroundColor?: string;
      randomRotation?: boolean;
      maxRotation?: number;
      overlap?: boolean;
    } = {}
  ): Promise<HTMLCanvasElement> {
    const { backgroundColor = '#ffffff', randomRotation = true, maxRotation = 15, overlap = true } = options;

    return withManagedCanvas(canvasSize.width, canvasSize.height, (canvas, ctx) => {
      fillCanvasBackground(ctx, canvasSize.width, canvasSize.height, backgroundColor);

      const usedAreas: Rectangle[] = [];

      for (let i = 0; i < images.length; i++) {
        const image = images[i];

        const minScale = 0.15;
        const maxScale = 0.3;
        const scale = minScale + Math.random() * (maxScale - minScale);

        const scaledWidth = image.width * scale;
        const scaledHeight = image.height * scale;

        let x: number, y: number;
        let attempts = 0;
        const maxAttempts = 50;

        do {
          x = Math.random() * (canvasSize.width - scaledWidth);
          y = Math.random() * (canvasSize.height - scaledHeight);
          attempts++;
        } while (
          !overlap &&
          attempts < maxAttempts &&
          rectanglesOverlap({ x, y, width: scaledWidth, height: scaledHeight }, usedAreas)
        );

        usedAreas.push({ x, y, width: scaledWidth, height: scaledHeight });

        drawShadowedImage(ctx, image, {
          x,
          y,
          width: scaledWidth,
          height: scaledHeight,
          rotation: randomRotation ? (Math.random() - 0.5) * 2 * maxRotation : undefined,
        });
      }

      return canvas;
    });
  }
}
