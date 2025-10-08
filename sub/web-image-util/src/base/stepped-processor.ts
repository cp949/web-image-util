import { withManagedCanvas } from './canvas-utils';
import { createImageError } from './error-helpers';

/**
 * Stepped reduction quality options
 */
export interface SteppedProcessingOptions {
  quality?: 'fast' | 'high';
  maxSteps?: number;
  minStepRatio?: number;
}

/**
 * High-quality resizing processor using stepped reduction
 * Progressively reduces large images through multiple stages
 * to minimize aliasing and maintain high quality.
 */
export class SteppedProcessor {
  private static readonly DEFAULT_OPTIONS: Required<SteppedProcessingOptions> = {
    quality: 'high',
    maxSteps: 10,
    minStepRatio: 0.5,
  };

  /**
   * Resize image with stepped reduction
   *
   * @param img - Source image
   * @param targetWidth - Target width
   * @param targetHeight - Target height
   * @param options - Processing options
   * @returns Resized Canvas
   */
  static async resizeWithSteps(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    options: SteppedProcessingOptions = {}
  ): Promise<HTMLCanvasElement> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const sourceWidth = img.width;
    const sourceHeight = img.height;

    // Input validation
    if (targetWidth <= 0 || targetHeight <= 0) {
      throw createImageError('RESIZE_FAILED', new Error('Invalid target dimensions'), {
        dimensions: { width: targetWidth, height: targetHeight },
      });
    }

    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw createImageError('RESIZE_FAILED', new Error('Invalid source dimensions'), {
        dimensions: { width: sourceWidth, height: sourceHeight },
      });
    }

    // Calculate reduction ratio
    const scaleX = targetWidth / sourceWidth;
    const scaleY = targetHeight / sourceHeight;
    const minScale = Math.min(scaleX, scaleY);

    // Determine if stepped reduction is needed
    if (minScale >= opts.minStepRatio || opts.quality === 'fast') {
      // Direct resizing is sufficient
      return this.directResize(img, targetWidth, targetHeight, opts.quality);
    }

    // Execute stepped reduction
    return this.performSteppedResize(img, targetWidth, targetHeight, minScale, opts);
  }

  /**
   * Execute stepped reduction
   * @private
   */
  private static async performSteppedResize(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    minScale: number,
    opts: Required<SteppedProcessingOptions>
  ): Promise<HTMLCanvasElement> {
    // Calculate steps
    const steps = this.calculateOptimalSteps(minScale, opts.maxSteps);

    let currentCanvas = await this.imageToCanvas(img);
    let currentWidth = img.width;
    let currentHeight = img.height;

    try {
      // Perform reduction for each step
      for (let step = 0; step < steps.length; step++) {
        const stepScale = steps[step];
        const stepWidth =
          step === steps.length - 1
            ? targetWidth // Last step uses exact target size
            : Math.max(targetWidth, Math.floor(currentWidth * stepScale));
        const stepHeight =
          step === steps.length - 1 ? targetHeight : Math.max(targetHeight, Math.floor(currentHeight * stepScale));

        const stepCanvas = await this.canvasToCanvas(currentCanvas, stepWidth, stepHeight, opts.quality);

        // Clean up previous Canvas (excluding original image)
        if (currentCanvas !== (img as any)) {
          currentCanvas.width = 0;
          currentCanvas.height = 0;
        }

        currentCanvas = stepCanvas;
        currentWidth = stepWidth;
        currentHeight = stepHeight;
      }

      return currentCanvas;
    } catch (error) {
      // Clean up current Canvas on error
      if (currentCanvas !== (img as any)) {
        currentCanvas.width = 0;
        currentCanvas.height = 0;
      }
      throw createImageError('RESIZE_FAILED', error as Error, { debug: { stage: 'stepped reduction processing' } });
    }
  }

  /**
   * Calculate optimal steps
   * @private
   */
  private static calculateOptimalSteps(minScale: number, maxSteps: number): number[] {
    if (minScale >= 1) {
      return [1]; // No reduction needed
    }

    const steps: number[] = [];
    const targetSteps = Math.min(maxSteps, Math.ceil(Math.log2(1 / minScale)));

    // Calculate reduction ratio for each step
    for (let i = 1; i <= targetSteps; i++) {
      if (i === targetSteps) {
        // Last step matches target size exactly
        steps.push(minScale);
      } else {
        // Intermediate steps reduce roughly by half
        const stepScale = Math.pow(minScale, i / targetSteps);
        steps.push(Math.max(0.5, stepScale));
      }
    }

    return steps;
  }

  /**
   * Convert HTMLImageElement to Canvas
   * @private
   */
  private static async imageToCanvas(img: HTMLImageElement): Promise<HTMLCanvasElement> {
    return withManagedCanvas(img.width, img.height, (canvas, ctx) => {
      // High-quality rendering settings
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(img, 0, 0);
      return canvas;
    });
  }

  /**
   * Convert Canvas to another sized Canvas
   * @private
   */
  private static async canvasToCanvas(
    sourceCanvas: HTMLCanvasElement,
    targetWidth: number,
    targetHeight: number,
    quality: 'fast' | 'high' = 'high'
  ): Promise<HTMLCanvasElement> {
    return withManagedCanvas(targetWidth, targetHeight, (targetCanvas, ctx) => {
      // Rendering settings based on quality
      if (quality === 'high') {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      } else {
        ctx.imageSmoothingEnabled = false;
      }

      ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
      return targetCanvas;
    });
  }

  /**
   * Direct resizing (without stepped reduction)
   * @private
   */
  private static async directResize(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    quality: 'fast' | 'high' = 'high'
  ): Promise<HTMLCanvasElement> {
    return withManagedCanvas(targetWidth, targetHeight, (canvas, ctx) => {
      if (quality === 'high') {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      } else {
        ctx.imageSmoothingEnabled = false;
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      return canvas;
    });
  }

  /**
   * Determine if stepped reduction is needed
   *
   * @param sourceWidth - Source width
   * @param sourceHeight - Source height
   * @param targetWidth - Target width
   * @param targetHeight - Target height
   * @param qualityThreshold - Quality threshold (default: 0.5)
   * @returns Whether stepped reduction is needed
   */
  static shouldUseSteppedResize(
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number,
    qualityThreshold: number = 0.5
  ): boolean {
    const scaleX = targetWidth / sourceWidth;
    const scaleY = targetHeight / sourceHeight;
    const minScale = Math.min(scaleX, scaleY);

    return minScale < qualityThreshold;
  }

  /**
   * Calculate estimated number of processing steps
   *
   * @param sourceWidth - Source width
   * @param sourceHeight - Source height
   * @param targetWidth - Target width
   * @param targetHeight - Target height
   * @param maxSteps - Maximum number of steps
   * @returns Estimated number of processing steps
   */
  static estimateSteps(
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number,
    maxSteps: number = 10
  ): number {
    const scaleX = targetWidth / sourceWidth;
    const scaleY = targetHeight / sourceHeight;
    const minScale = Math.min(scaleX, scaleY);

    if (minScale >= 0.5) {
      return 1; // Direct resizing
    }

    const theoreticalSteps = Math.ceil(Math.log2(1 / minScale));
    return Math.min(maxSteps, theoreticalSteps);
  }

  /**
   * Batch image stepped resizing
   * Efficiently processes multiple images.
   *
   * @param images - Array of images to process
   * @param targetWidth - Target width
   * @param targetHeight - Target height
   * @param options - Processing options
   * @returns Array of processed Canvases
   */
  static async batchResizeWithSteps(
    images: HTMLImageElement[],
    targetWidth: number,
    targetHeight: number,
    options: SteppedProcessingOptions & {
      concurrency?: number;
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<HTMLCanvasElement[]> {
    const { concurrency = 3, onProgress, ...processingOptions } = options;
    const results: HTMLCanvasElement[] = new Array(images.length);
    let completed = 0;

    // Divide into chunks for parallel processing
    const chunks: HTMLImageElement[][] = [];
    for (let i = 0; i < images.length; i += concurrency) {
      chunks.push(images.slice(i, i + concurrency));
    }

    // Process each chunk sequentially, but process items within chunk in parallel
    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (img, chunkIndex) => {
        const globalIndex = chunks.indexOf(chunk) * concurrency + chunkIndex;

        try {
          const result = await this.resizeWithSteps(img, targetWidth, targetHeight, processingOptions);

          results[globalIndex] = result;
          completed++;
          onProgress?.(completed, images.length);

          return result;
        } catch (error) {
          throw createImageError('RESIZE_FAILED', error as Error, {
            debug: { stage: 'batch processing', index: globalIndex },
          });
        }
      });

      await Promise.all(chunkPromises);
    }

    return results;
  }

  /**
   * Memory-efficient stepped reduction
   * Processes while monitoring memory usage.
   *
   * @param img - Source image
   * @param targetWidth - Target width
   * @param targetHeight - Target height
   * @param maxMemoryMB - Maximum memory usage (MB)
   * @returns Processed Canvas
   */
  static async memoryEfficientResize(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    maxMemoryMB: number = 64
  ): Promise<HTMLCanvasElement> {
    const maxPixels = (maxMemoryMB * 1024 * 1024) / 4; // RGBA 4 bytes
    const targetPixels = targetWidth * targetHeight;

    if (targetPixels > maxPixels) {
      throw createImageError(
        'FILE_TOO_LARGE',
        new Error(`Target image exceeds memory limit (limit: ${maxMemoryMB}MB)`)
      );
    }

    // Stepped processing considering memory limitations
    const sourcePixels = img.width * img.height;
    const stepPixelLimit = Math.min(sourcePixels, maxPixels * 0.8); // Reserve extra space
    const stepDimension = Math.floor(Math.sqrt(stepPixelLimit));

    if (Math.max(img.width, img.height) <= stepDimension) {
      // Direct processing possible within memory limit
      return this.resizeWithSteps(img, targetWidth, targetHeight, { quality: 'high' });
    }

    // Stepped reduction considering memory limitations
    return this.resizeWithSteps(img, targetWidth, targetHeight, {
      quality: 'high',
      maxSteps: 15, // Distribute memory usage across more steps
      minStepRatio: 0.3, // Apply more granular steps
    });
  }
}
