/**
 * Smart image processor - Simplified high-resolution processing
 *
 * @description Wraps complex HighResolutionManager with simple API.
 * Users don't need to know complex strategies, internal optimization is automatic.
 */

import { applySmoothing, createOwnedCanvas } from '../base/canvas-utils.internal';
import { createImageError } from '../base/error-helpers';
import type { ProcessingStrategy } from '../base/high-res-detector.internal';
import { HighResolutionManager } from '../base/high-res-manager';
import type { SmartResizeOptions } from '../types';
import { readMemoryBudget } from '../utils/browser-capabilities/index';
import { AutoMemoryManager } from './auto-memory-manager.internal';
import { type BatchResizeJob, BatchResizer } from './batch-resizer';
import type { ResizeProfile } from './performance-config';

/**
 * Smart processor - Class that hides the complexity of high-resolution image processing
 *
 * @example
 * ```typescript
 * // ✅ Simplest usage - everything automatic
 * const result = await SmartProcessor.process(img, 800, 600);
 *
 * // ✅ Specify strategy (still simple)
 * const result = await SmartProcessor.process(img, 800, 600, {
 *   strategy: 'quality',
 *   onProgress: (progress) => console.log(`${progress}%`)
 * });
 * ```
 */
export class SmartProcessor {
  /**
   * Smart image resizing - Simple API
   *
   * @param img Source image
   * @param width Target width
   * @param height Target height
   * @param options Simple options (default values are sufficient)
   * @returns Processed Canvas
   */
  static async process(
    img: HTMLImageElement,
    width: number,
    height: number,
    options: SmartResizeOptions = {}
  ): Promise<HTMLCanvasElement> {
    try {
      // Set default values - reasonable defaults
      const strategy = options.strategy || 'auto';

      // Determine automatic optimization
      const shouldUseHighRes = SmartProcessor.shouldUseHighResProcessing(img.width, img.height, width, height);

      if (!shouldUseHighRes) {
        // Regular resizing - simple and fast
        return SmartProcessor.simpleResize(img, width, height, options);
      }

      // High-resolution processing needed - convert complex options to simple options
      const internalOptions = SmartProcessor.convertToInternalOptions(options, img.width, img.height);

      // Automatic memory status check
      const memoryManager = AutoMemoryManager.getInstance();
      await memoryManager.checkAndOptimize();

      const result = await HighResolutionManager.smartResize(img, width, height, internalOptions);

      return result.canvas;
    } catch (error) {
      throw createImageError('PROCESSING_FAILED', { cause: error instanceof Error ? error : new Error(String(error)) });
    }
  }

  /**
   * Automatically determine if high-resolution processing is needed
   * Users don't need to know this complex logic
   */
  private static shouldUseHighResProcessing(
    originalWidth: number,
    originalHeight: number,
    targetWidth: number,
    targetHeight: number
  ): boolean {
    const originalPixels = originalWidth * originalHeight;
    const targetPixels = targetWidth * targetHeight;

    // Simple heuristic: 4MP or more, or large scaling needed
    return originalPixels > 4_000_000 || Math.max(originalWidth / targetWidth, originalHeight / targetHeight) > 4;
  }

  /**
   * Simple resizing - General case
   */
  private static async simpleResize(
    img: HTMLImageElement,
    width: number,
    height: number,
    options: SmartResizeOptions
  ): Promise<HTMLCanvasElement> {
    const { canvas, ctx } = createOwnedCanvas(width, height);

    // 기본 고품질 설정
    applySmoothing(ctx, 'high');

    // Simple progress reporting
    if (options.onProgress) {
      options.onProgress(50);
    }

    ctx.drawImage(img, 0, 0, width, height);

    if (options.onProgress) {
      options.onProgress(100);
    }

    return canvas;
  }

  /**
   * Convert simple user options to complex internal options
   * Users don't need to know this conversion logic
   */
  private static convertToInternalOptions(options: SmartResizeOptions, originalWidth: number, originalHeight: number) {
    const strategy = options.strategy || 'auto';

    return {
      quality: SmartProcessor.mapStrategyToQuality(strategy),
      forceStrategy: SmartProcessor.selectInternalStrategy(strategy, originalWidth, originalHeight),
      maxMemoryUsageMB: options.maxMemoryMB || SmartProcessor.getAutoMemoryLimit(),
      enableProgressTracking: !!options.onProgress,
      onProgress: options.onProgress ? SmartProcessor.wrapProgressCallback(options.onProgress) : undefined,
    };
  }

  /**
   * Map user strategy to quality settings
   */
  private static mapStrategyToQuality(strategy: SmartResizeOptions['strategy']): 'fast' | 'balanced' | 'high' {
    switch (strategy) {
      case 'fast':
      case 'memory-efficient':
        return 'fast';
      case 'quality':
        return 'high';
      default:
        return 'balanced';
    }
  }

  /**
   * Automatic strategy selection - Internal automatic optimization
   */
  private static selectInternalStrategy(
    userStrategy: SmartResizeOptions['strategy'],
    originalWidth: number,
    originalHeight: number
  ): ProcessingStrategy | undefined {
    const pixelCount = originalWidth * originalHeight;

    if (userStrategy === 'fast') {
      return 'direct';
    }

    if (userStrategy === 'memory-efficient') {
      // chunked is now a tiled preset (resize-strategy.internal.ts), so image size no longer changes this choice.
      return 'tiled';
    }

    if (userStrategy === 'quality') {
      return 'stepped';
    }

    // 'auto': Automatic selection based on image size
    // chunked is now a tiled preset, so every image above 4MP uses tiled.
    if (pixelCount > 4_000_000) {
      return 'tiled';
    } else {
      return 'stepped'; // 4MP-: Stepped method
    }
  }

  /**
   * Automatic memory limit calculation
   *
   * 메모리 예산은 browser-capabilities/memory.internal.ts가 단일 소유한다. 이 메서드는
   * "가용 메모리의 20%" 정책만 로컬로 유지한다.
   */
  private static getAutoMemoryLimit(): number {
    return Math.round(readMemoryBudget().availableMB * 0.2);
  }

  /**
   * Convert complex progress callback to simple callback
   */
  private static wrapProgressCallback(simpleCallback: (progress: number) => void) {
    return (progress: any) => {
      // Convert complex HighResolutionProgress to simple 0-100 number
      const simpleProgress = typeof progress === 'object' ? progress.progress : progress;
      simpleCallback(Math.round(simpleProgress));
    };
  }

  /**
   * Batch processing - efficiently process multiple images simultaneously
   *
   * @example
   * ```typescript
   * const images = [img1, img2, img3];
   * const jobs = images.map(img => ({
   *   operation: () => SmartProcessor.process(img, 300, 200)
   * }));
   * const results = await SmartProcessor.processBatch(jobs, 'fast');
   * ```
   */
  static async processBatch<T>(jobs: BatchResizeJob<T>[], performance: ResizeProfile = 'balanced'): Promise<T[]> {
    const batcher = new BatchResizer(performance);
    return batcher.processAll(jobs);
  }

  /**
   * Resize multiple images to the same size - convenience method
   *
   * @param images Images to process
   * @param width Target width
   * @param height Target height
   * @param options Resizing options
   */
  static async resizeBatch(
    images: HTMLImageElement[],
    width: number,
    height: number,
    options: SmartResizeOptions = {}
  ): Promise<HTMLCanvasElement[]> {
    const performance = options.performance || 'balanced';

    const jobs: BatchResizeJob<HTMLCanvasElement>[] = images.map((img, index) => ({
      id: `resize-${index}`,
      operation: () => SmartProcessor.process(img, width, height, options),
    }));

    return SmartProcessor.processBatch(jobs, performance);
  }
}
