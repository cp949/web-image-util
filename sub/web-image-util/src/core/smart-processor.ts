/**
 * Smart image processor - Simplified high-resolution processing
 *
 * @description Wraps complex HighResolutionManager with simple API.
 * Users don't need to know complex strategies, internal optimization is automatic.
 */

import { createImageError } from '../base/error-helpers';
import type { ProcessingStrategy } from '../base/high-res-detector';
import type { SmartResizeOptions } from '../types';
import { AutoMemoryManager } from './auto-memory-manager';
import { BatchResizer, type BatchResizeJob } from './batch-resizer';
import { InternalHighResProcessor } from './internal/internal-high-res-processor';
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
      const shouldUseHighRes = this.shouldUseHighResProcessing(img.width, img.height, width, height);

      if (!shouldUseHighRes) {
        // Regular resizing - simple and fast
        return this.simpleResize(img, width, height, options);
      }

      // High-resolution processing needed - convert complex options to simple options
      const internalOptions = this.convertToInternalOptions(options, img.width, img.height);

      // Automatic memory status check
      const memoryManager = AutoMemoryManager.getInstance();
      await memoryManager.checkAndOptimize();

      const result = await InternalHighResProcessor.smartResize(img, width, height, internalOptions);

      return result.canvas;
    } catch (error) {
      throw createImageError('PROCESSING_FAILED', error instanceof Error ? error : new Error(String(error)));
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
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw createImageError('CANVAS_CONTEXT_FAILED', new Error('Failed to get canvas context'));
    }

    canvas.width = width;
    canvas.height = height;

    // Basic high-quality settings
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

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
      quality: this.mapStrategyToQuality(strategy),
      forceStrategy: this.selectInternalStrategy(strategy, originalWidth, originalHeight),
      maxMemoryUsageMB: options.maxMemoryMB || this.getAutoMemoryLimit(),
      enableProgressTracking: !!options.onProgress,
      onProgress: options.onProgress ? this.wrapProgressCallback(options.onProgress) : undefined,
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
      case 'auto':
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
      return pixelCount > 16_000_000 ? 'tiled' : 'chunked';
    }

    if (userStrategy === 'quality') {
      return 'stepped';
    }

    // 'auto': Automatic selection based on image size
    if (pixelCount > 16_000_000) {
      return 'tiled'; // 16MP+: Tiled method
    } else if (pixelCount > 4_000_000) {
      return 'chunked'; // 4-16MP: Chunked method
    } else {
      return 'stepped'; // 4MP-: Stepped method
    }
  }

  /**
   * Automatic memory limit calculation
   */
  private static getAutoMemoryLimit(): number {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      // Set about 20% of available memory as limit
      return Math.round(((memory.jsHeapSizeLimit - memory.usedJSHeapSize) * 0.2) / (1024 * 1024));
    }

    // Default: 256MB
    return 256;
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
      operation: () => this.process(img, width, height, options),
    }));

    return this.processBatch(jobs, performance);
  }
}
