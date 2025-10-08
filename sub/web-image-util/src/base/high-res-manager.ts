import { withManagedCanvas } from './canvas-utils';
import { createImageError } from './error-helpers';
import { productionLog } from '../utils/debug';
import type { ImageAnalysis } from './high-res-detector';
import { HighResolutionDetector, ProcessingStrategy } from './high-res-detector';
// Memory management optimized for browser environment
import { SteppedProcessor } from './stepped-processor';
import { TiledProcessor } from './tiled-processor';

/**
 * High-resolution processing options
 */
export interface HighResolutionOptions {
  quality?: 'fast' | 'balanced' | 'high';
  forceStrategy?: ProcessingStrategy;
  maxMemoryUsageMB?: number;
  enableProgressTracking?: boolean;
  onProgress?: (progress: HighResolutionProgress) => void;
  onMemoryWarning?: (memoryInfo: { usageRatio: number; availableMB: number }) => void;
}

/**
 * High-resolution processing progress
 */
export interface HighResolutionProgress {
  stage: 'analyzing' | 'processing' | 'finalizing' | 'completed';
  progress: number; // 0-100
  currentStrategy: ProcessingStrategy;
  timeElapsed: number; // seconds
  estimatedTimeRemaining: number; // seconds
  memoryUsageMB: number;
  details?: string;
}

/**
 * Processing result information
 */
export interface ProcessingResult {
  canvas: HTMLCanvasElement;
  analysis: ImageAnalysis;
  strategy: ProcessingStrategy;
  processingTime: number;
  memoryPeakUsageMB: number;
  quality: 'fast' | 'balanced' | 'high';
}

/**
 * High-resolution image processing manager
 * Provides optimal results by combining various processing strategies.
 */
export class HighResolutionManager {
  private static readonly DEFAULT_OPTIONS = {
    quality: 'balanced' as const,
    maxMemoryUsageMB: 256,
    enableProgressTracking: false,
  };

  /**
   * Resize image with optimal strategy
   *
   * @param img - Source image
   * @param targetWidth - Target width
   * @param targetHeight - Target height
   * @param options - Processing options
   * @returns Processing result
   */
  static async smartResize(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    options: HighResolutionOptions = {}
  ): Promise<ProcessingResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();
    let memoryPeakUsage = 0;

    // Initialize progress tracking
    const progressTracker = opts.enableProgressTracking ? this.createProgressTracker(opts.onProgress) : null;

    try {
      // 1. Image analysis
      progressTracker?.update('analyzing', 10, 'Analyzing image...');
      const analysis = HighResolutionDetector.analyzeImage(img);

      // 2. Determine processing strategy
      const strategy = this.selectOptimalStrategy(analysis, opts, img, targetWidth, targetHeight);
      progressTracker?.update('analyzing', 20, `Strategy selected: ${strategy}`);

      // 3. Check and manage memory situation
      await this.checkAndManageMemory(opts, analysis);
      progressTracker?.update('analyzing', 30, 'Memory check completed');

      // 4. Execute actual processing
      progressTracker?.update('processing', 40, 'Starting image processing...');
      const canvas = await this.executeProcessing(img, targetWidth, targetHeight, strategy, opts, progressTracker);

      // 5. Post-processing and optimization
      progressTracker?.update('finalizing', 90, 'Finalizing...');
      const optimizedCanvas = await this.postProcess(canvas, opts);

      // 6. Generate result
      const processingTime = (Date.now() - startTime) / 1000;
      memoryPeakUsage = this.getCurrentMemoryUsage();

      progressTracker?.update('completed', 100, 'Processing completed');

      return {
        canvas: optimizedCanvas,
        analysis,
        strategy,
        processingTime: Math.round(processingTime * 100) / 100,
        memoryPeakUsageMB: Math.round(memoryPeakUsage * 100) / 100,
        quality: opts.quality,
      };
    } catch (error) {
      throw createImageError('RESIZE_FAILED', error as Error, { debug: { stage: 'High-resolution processing' } });
    }
  }

  /**
   * Select optimal processing strategy
   * @private
   */
  private static selectOptimalStrategy(
    analysis: ImageAnalysis,
    opts: HighResolutionOptions & { quality: 'fast' | 'balanced' | 'high' },
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number
  ): ProcessingStrategy {
    // If force strategy is specified
    if (opts.forceStrategy) {
      return opts.forceStrategy;
    }

    // If memory constraints are severe
    // Simple memory check
    const memoryCheck = this.isMemoryLow();
    if (memoryCheck) {
      productionLog.warn('Low memory detected, selecting memory-efficient strategy');
      return this.selectMemoryEfficientStrategy(analysis);
    }

    // Strategy adjustment based on quality settings
    if (opts.quality === 'fast') {
      return this.selectFastStrategy(analysis);
    } else if (opts.quality === 'high') {
      return this.selectHighQualityStrategy(analysis, img, targetWidth, targetHeight);
    }

    // Select balanced strategy (default)
    return analysis.strategy;
  }

  /**
   * Select memory efficient strategy
   * @private
   */
  private static selectMemoryEfficientStrategy(analysis: ImageAnalysis): ProcessingStrategy {
    if (analysis.estimatedMemoryMB > 128) {
      return ProcessingStrategy.TILED;
    } else if (analysis.estimatedMemoryMB > 32) {
      return ProcessingStrategy.CHUNKED;
    }
    return ProcessingStrategy.DIRECT;
  }

  /**
   * Select fast processing strategy
   * @private
   */
  private static selectFastStrategy(analysis: ImageAnalysis): ProcessingStrategy {
    // Select simplest strategy first for fast processing
    if (analysis.estimatedMemoryMB <= 64) {
      return ProcessingStrategy.DIRECT;
    } else if (analysis.estimatedMemoryMB <= 128) {
      return ProcessingStrategy.CHUNKED;
    }
    return ProcessingStrategy.TILED;
  }

  /**
   * Select high-quality processing strategy
   * @private
   */
  private static selectHighQualityStrategy(
    analysis: ImageAnalysis,
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number
  ): ProcessingStrategy {
    // Stepped reduction is advantageous for quality when large reduction is needed
    const scaleRatio = Math.min(targetWidth / img.width, targetHeight / img.height);

    if (scaleRatio < 0.3 && analysis.estimatedMemoryMB <= 256) {
      return ProcessingStrategy.STEPPED;
    }

    // Very large images use tile processing
    if (analysis.estimatedMemoryMB > 256) {
      return ProcessingStrategy.TILED;
    }

    return analysis.strategy;
  }

  /**
   * Perform actual processing
   * @private
   */
  private static async executeProcessing(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    strategy: ProcessingStrategy,
    opts: HighResolutionOptions & { quality: 'fast' | 'balanced' | 'high' },
    progressTracker: ReturnType<typeof this.createProgressTracker> | null
  ): Promise<HTMLCanvasElement> {
    const progressCallback = progressTracker
      ? (current: number, total: number) => {
          const progress = 40 + (current / total) * 40; // 40-80% range
          progressTracker.update('processing', progress, `Processing ${current}/${total}...`);
        }
      : undefined;

    switch (strategy) {
      case ProcessingStrategy.DIRECT:
        return this.directResize(img, targetWidth, targetHeight, opts.quality);

      case ProcessingStrategy.CHUNKED:
        return this.chunkedResize(img, targetWidth, targetHeight, opts, progressCallback);

      case ProcessingStrategy.STEPPED:
        return SteppedProcessor.resizeWithSteps(img, targetWidth, targetHeight, {
          quality: opts.quality === 'fast' ? 'fast' : 'high',
          maxSteps: opts.quality === 'high' ? 15 : 8,
        });

      case ProcessingStrategy.TILED:
        return TiledProcessor.resizeInTiles(img, targetWidth, targetHeight, {
          quality: opts.quality === 'fast' ? 'fast' : 'high',
          onProgress: progressCallback,
          enableMemoryMonitoring: true,
          maxConcurrency: opts.quality === 'fast' ? 4 : 2,
        });

      default:
        throw createImageError('FEATURE_NOT_SUPPORTED', new Error(`Unsupported processing strategy: ${strategy}`));
    }
  }

  /**
   * Direct resizing
   * @private
   */
  private static async directResize(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    quality: 'fast' | 'balanced' | 'high'
  ): Promise<HTMLCanvasElement> {
    return withManagedCanvas(targetWidth, targetHeight, (canvas, ctx) => {
      // Quality settings
      switch (quality) {
        case 'fast':
          ctx.imageSmoothingEnabled = false;
          break;
        case 'high':
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          break;
        default:
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'medium';
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      return canvas;
    });
  }

  /**
   * Chunk-based resizing
   * @private
   */
  private static async chunkedResize(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    opts: HighResolutionOptions & { quality: 'fast' | 'balanced' | 'high' },
    progressCallback?: (current: number, total: number) => void
  ): Promise<HTMLCanvasElement> {
    const analysis = HighResolutionDetector.analyzeImage(img);
    const tileSize = Math.min(2048, analysis.recommendedChunkSize);

    return TiledProcessor.resizeInTiles(img, targetWidth, targetHeight, {
      tileSize,
      quality: opts.quality === 'fast' ? 'fast' : 'high',
      onProgress: progressCallback,
      maxConcurrency: 2,
    });
  }

  /**
   * Check and manage memory situation
   * @private
   */
  private static async checkAndManageMemory(opts: HighResolutionOptions, analysis: ImageAnalysis): Promise<void> {
    const memoryInfo = this.getEstimatedUsage();
    const availableMB = (memoryInfo.limit - memoryInfo.used) / (1024 * 1024);

    // Memory warning occurred
    if (opts.onMemoryWarning && availableMB < (opts.maxMemoryUsageMB || 256)) {
      opts.onMemoryWarning({
        usageRatio: memoryInfo.used / memoryInfo.limit,
        availableMB: Math.round(availableMB),
      });
    }

    // Trigger garbage collection when memory is low
    if (this.isMemoryLow()) {
      if (typeof global !== 'undefined' && global.gc) {
        global.gc();
      }
    }
  }

  /**
   * Post-processing and optimization
   * @private
   */
  private static async postProcess(canvas: HTMLCanvasElement, opts: HighResolutionOptions): Promise<HTMLCanvasElement> {
    // Post-processing based on quality
    if (opts.quality === 'high') {
      // No additional optimization in high-quality mode
      return canvas;
    }

    // Additional optimization logic can be implemented if needed
    return canvas;
  }

  /**
   * Create progress tracker
   * @private
   */
  private static createProgressTracker(onProgress?: (progress: HighResolutionProgress) => void) {
    const startTime = Date.now();

    return {
      update: (stage: HighResolutionProgress['stage'], progress: number, details?: string) => {
        if (!onProgress) return;

        const timeElapsed = (Date.now() - startTime) / 1000;
        const estimatedTotal = progress > 0 ? (timeElapsed / progress) * 100 : 0;
        const estimatedRemaining = Math.max(0, estimatedTotal - timeElapsed);

        onProgress({
          stage,
          progress: Math.min(100, Math.max(0, progress)),
          currentStrategy: ProcessingStrategy.DIRECT, // Needs to be updated with actual strategy
          timeElapsed: Math.round(timeElapsed * 10) / 10,
          estimatedTimeRemaining: Math.round(estimatedRemaining * 10) / 10,
          memoryUsageMB: HighResolutionManager.getCurrentMemoryUsage(),
          details,
        });
      },
    };
  }

  /**
   * Return current memory usage (MB)
   * @private
   */
  private static getCurrentMemoryUsage(): number {
    const usage = this.getEstimatedUsage();
    return Math.round((usage.used / (1024 * 1024)) * 100) / 100;
  }

  /**
   * Pre-check processing capability
   *
   * @param img - image to check
   * @param targetWidth - target width
   * @param targetHeight - target height
   * @param options - processing options
   * @returns check result
   */
  static validateProcessingCapability(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    options: HighResolutionOptions = {}
  ): {
    canProcess: boolean;
    analysis: ImageAnalysis;
    recommendedStrategy: ProcessingStrategy;
    warnings: string[];
    estimatedTime: number;
  } {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const analysis = HighResolutionDetector.analyzeImage(img);
    const warnings: string[] = [];

    // Basic checks
    const validation = HighResolutionDetector.validateProcessingCapability(img);
    warnings.push(...validation.limitations);

    // Memory check
    if (analysis.estimatedMemoryMB > opts.maxMemoryUsageMB) {
      warnings.push(
        `Expected memory usage exceeds limit: ${analysis.estimatedMemoryMB}MB > ${opts.maxMemoryUsageMB}MB`
      );
    }

    // Target size check
    const targetPixels = targetWidth * targetHeight;
    const maxSafePixels = analysis.maxSafeDimension * analysis.maxSafeDimension;
    if (targetPixels > maxSafePixels) {
      warnings.push('Target image size may exceed browser limits.');
    }

    // Determine recommended strategy
    const recommendedStrategy = this.selectOptimalStrategy(analysis, opts as any, img, targetWidth, targetHeight);

    // Calculate estimated processing time
    const timeEstimate = HighResolutionDetector.estimateProcessingTime(analysis);
    let estimatedTime = timeEstimate.estimatedSeconds;

    // Time adjustment based on strategy
    switch (recommendedStrategy) {
      case ProcessingStrategy.STEPPED:
        estimatedTime *= 1.5;
        break;
      case ProcessingStrategy.TILED:
        estimatedTime *= 2.0;
        break;
    }

    return {
      canProcess: validation.canProcess,
      analysis,
      recommendedStrategy,
      warnings,
      estimatedTime: Math.round(estimatedTime * 10) / 10,
    };
  }

  /**
   * Batch image processing
   *
   * @param images - array of images to process
   * @param targetWidth - target width
   * @param targetHeight - target height
   * @param options - processing options
   * @returns array of processing results
   */
  static async batchSmartResize(
    images: HTMLImageElement[],
    targetWidth: number,
    targetHeight: number,
    options: HighResolutionOptions & {
      concurrency?: number;
      onBatchProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<ProcessingResult[]> {
    const { concurrency = 2, onBatchProgress, ...processingOptions } = options;
    const results: ProcessingResult[] = new Array(images.length);
    let completed = 0;

    // Divide images into chunks for parallel processing
    const chunks: HTMLImageElement[][] = [];
    for (let i = 0; i < images.length; i += concurrency) {
      chunks.push(images.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (img, chunkIndex) => {
        const globalIndex = chunks.indexOf(chunk) * concurrency + chunkIndex;

        try {
          const result = await this.smartResize(img, targetWidth, targetHeight, processingOptions);

          results[globalIndex] = result;
          completed++;
          onBatchProgress?.(completed, images.length);

          return result;
        } catch (error) {
          throw createImageError('RESIZE_FAILED', error as Error, {
            debug: { stage: 'Batch processing', index: globalIndex },
          });
        }
      });

      await Promise.all(chunkPromises);
    }

    return results;
  }

  /**
   * Simple memory shortage check
   * @private
   */
  private static isMemoryLow(): boolean {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      return usageRatio > 0.8;
    }
    return false;
  }

  /**
   * Estimate memory usage
   * @private
   */
  private static getEstimatedUsage(): { used: number; limit: number } {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        limit: memory.jsHeapSizeLimit,
      };
    }

    // Default values (estimated)
    return {
      used: 64 * 1024 * 1024, // 64MB
      limit: 512 * 1024 * 1024, // 512MB
    };
  }
}
