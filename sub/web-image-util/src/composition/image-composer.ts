import { withManagedCanvas } from '../base/canvas-utils';
import type { Rectangle, Size } from './position-types';
import { productionLog } from '../utils/debug';

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
      // Set background color
      if (backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
      }

      // Draw each layer
      for (const layer of layers) {
        if (layer.visible === false) continue;

        ctx.save();

        // Set opacity and blending mode
        ctx.globalAlpha = layer.opacity || 1;
        ctx.globalCompositeOperation = layer.blendMode || 'source-over';

        // Set rotation
        if (layer.rotation) {
          const centerX = layer.x + (layer.width || layer.image.width) / 2;
          const centerY = layer.y + (layer.height || layer.image.height) / 2;
          ctx.translate(centerX, centerY);
          ctx.rotate((layer.rotation * Math.PI) / 180);
          ctx.translate(-centerX, -centerY);
        }

        // Draw image
        ctx.drawImage(
          layer.image,
          layer.x,
          layer.y,
          layer.width || layer.image.width,
          layer.height || layer.image.height
        );

        ctx.restore();
      }

      return canvas;
    });
  }

  /**
   * Grid layout composition
   */
  static async composeGrid(images: HTMLImageElement[], options: GridLayoutOptions): Promise<HTMLCanvasElement> {
    const { rows, cols, spacing = 10, backgroundColor = '#ffffff', fit = 'contain' } = options;

    if (images.length === 0) throw new Error('No images provided');
    if (images.length > rows * cols) {
      productionLog.warn(`Too many images (${images.length}). Grid size: ${rows}x${cols}`);
    }

    // Calculate grid size
    const maxImages = Math.min(images.length, rows * cols);
    const cellWidth = Math.max(...images.map((img) => img.width));
    const cellHeight = Math.max(...images.map((img) => img.height));

    const canvasWidth = cols * cellWidth + (cols + 1) * spacing;
    const canvasHeight = rows * cellHeight + (rows + 1) * spacing;

    return withManagedCanvas(canvasWidth, canvasHeight, (canvas, ctx) => {
      // Set background
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Place images
      for (let i = 0; i < maxImages; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const image = images[i];

        const cellX = spacing + col * (cellWidth + spacing);
        const cellY = spacing + row * (cellHeight + spacing);

        // Calculate image size adjustment
        const { x, y, width, height } = this.calculateFitSize(image.width, image.height, cellWidth, cellHeight, fit);

        ctx.drawImage(image, cellX + x, cellY + y, width, height);
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
      // Set background
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

      // Randomly place images
      const usedAreas: Rectangle[] = [];

      for (let i = 0; i < images.length; i++) {
        const image = images[i];

        // Scale adjustment (15-30% of canvas size)
        const minScale = 0.15;
        const maxScale = 0.3;
        const scale = minScale + Math.random() * (maxScale - minScale);

        const scaledWidth = image.width * scale;
        const scaledHeight = image.height * scale;

        // Determine position
        let x, y;
        let attempts = 0;
        const maxAttempts = 50;

        do {
          x = Math.random() * (canvasSize.width - scaledWidth);
          y = Math.random() * (canvasSize.height - scaledHeight);
          attempts++;
        } while (
          !overlap &&
          attempts < maxAttempts &&
          this.isOverlapping({ x, y, width: scaledWidth, height: scaledHeight }, usedAreas)
        );

        // Record area
        usedAreas.push({ x, y, width: scaledWidth, height: scaledHeight });

        ctx.save();

        // Rotation
        if (randomRotation) {
          const rotation = (Math.random() - 0.5) * 2 * maxRotation;
          const centerX = x + scaledWidth / 2;
          const centerY = y + scaledHeight / 2;
          ctx.translate(centerX, centerY);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.translate(-centerX, -centerY);
        }

        // Shadow effect
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        // Draw image
        ctx.drawImage(image, x, y, scaledWidth, scaledHeight);

        ctx.restore();
      }

      return canvas;
    });
  }

  /**
   * Calculate image size fitting
   */
  private static calculateFitSize(
    imageWidth: number,
    imageHeight: number,
    containerWidth: number,
    containerHeight: number,
    fit: 'contain' | 'cover' | 'fill'
  ): { x: number; y: number; width: number; height: number } {
    let width = imageWidth;
    let height = imageHeight;
    let x = 0;
    let y = 0;

    switch (fit) {
      case 'contain': {
        const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);
        width = imageWidth * scale;
        height = imageHeight * scale;
        x = (containerWidth - width) / 2;
        y = (containerHeight - height) / 2;
        break;
      }

      case 'cover': {
        const scale = Math.max(containerWidth / imageWidth, containerHeight / imageHeight);
        width = imageWidth * scale;
        height = imageHeight * scale;
        x = (containerWidth - width) / 2;
        y = (containerHeight - height) / 2;
        break;
      }

      case 'fill':
        width = containerWidth;
        height = containerHeight;
        break;
    }

    return { x, y, width, height };
  }

  /**
   * Check area overlap
   */
  private static isOverlapping(rect: Rectangle, areas: Rectangle[]): boolean {
    return areas.some(
      (area) =>
        rect.x < area.x + area.width &&
        rect.x + rect.width > area.x &&
        rect.y < area.y + area.height &&
        rect.y + rect.height > area.y
    );
  }
}
