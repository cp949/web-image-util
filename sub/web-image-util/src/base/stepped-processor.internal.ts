import { applySmoothing, createOwnedCanvas, type SmoothingQuality } from './canvas-utils.internal';
import { createImageError } from './error-helpers';

/**
 * Stepped reduction quality options
 */
export interface SteppedProcessingOptions {
  quality?: SmoothingQuality;
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
    const opts = { ...SteppedProcessor.DEFAULT_OPTIONS, ...options };
    const sourceWidth = img.width;
    const sourceHeight = img.height;

    // Input validation
    if (targetWidth <= 0 || targetHeight <= 0) {
      throw createImageError('RESIZE_FAILED', {
        cause: new Error('Invalid target dimensions'),
        context: { dimensions: { width: targetWidth, height: targetHeight } },
      });
    }

    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw createImageError('RESIZE_FAILED', {
        cause: new Error('Invalid source dimensions'),
        context: { dimensions: { width: sourceWidth, height: sourceHeight } },
      });
    }

    // Calculate reduction ratio
    const scaleX = targetWidth / sourceWidth;
    const scaleY = targetHeight / sourceHeight;
    const minScale = Math.min(scaleX, scaleY);

    // Determine if stepped reduction is needed
    if (minScale >= opts.minStepRatio || opts.quality === 'fast') {
      // Direct resizing is sufficient
      return SteppedProcessor.directResize(img, targetWidth, targetHeight, opts.quality);
    }

    // Execute stepped reduction
    return SteppedProcessor.performSteppedResize(img, targetWidth, targetHeight, minScale, opts);
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
    const steps = SteppedProcessor.calculateOptimalSteps(minScale, opts.maxSteps);

    let currentCanvas = await SteppedProcessor.imageToCanvas(img);
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

        const stepCanvas = await SteppedProcessor.canvasToCanvas(currentCanvas, stepWidth, stepHeight, opts.quality);

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
      throw createImageError('RESIZE_FAILED', {
        cause: error,
        context: { debug: { stage: 'stepped reduction processing' } },
      });
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
        const stepScale = minScale ** (i / targetSteps);
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
    // 반환되는 canvas는 호출자가 소비 후 직접 폐기한다 — pool 미사용
    const { canvas, ctx } = createOwnedCanvas(img.width, img.height);
    applySmoothing(ctx, 'high');

    ctx.drawImage(img, 0, 0);
    return canvas;
  }

  /**
   * Convert Canvas to another sized Canvas
   * @private
   */
  private static async canvasToCanvas(
    sourceCanvas: HTMLCanvasElement,
    targetWidth: number,
    targetHeight: number,
    quality: SmoothingQuality = 'high'
  ): Promise<HTMLCanvasElement> {
    // 반환되는 canvas는 호출자가 소비 후 직접 폐기한다 — pool 미사용
    const { canvas: targetCanvas, ctx } = createOwnedCanvas(targetWidth, targetHeight);
    applySmoothing(ctx, quality);

    ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
    return targetCanvas;
  }

  /**
   * Direct resizing (without stepped reduction)
   * @private
   */
  private static async directResize(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    quality: SmoothingQuality = 'high'
  ): Promise<HTMLCanvasElement> {
    // 결과 canvas는 호출자 소유 — pool을 거치지 않는다
    const { canvas, ctx } = createOwnedCanvas(targetWidth, targetHeight);
    applySmoothing(ctx, quality);

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    return canvas;
  }
}
