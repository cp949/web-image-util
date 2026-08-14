import { readMemoryBudget, requestMemoryRelief } from '../utils/browser-capabilities/index';
import { productionLog } from '../utils/debug.internal';
import { createImageError } from './error-helpers';
import type { ImageAnalysis } from './high-res-detector.internal';
import { HighResolutionDetector, ProcessingStrategy } from './high-res-detector.internal';
import { getResizeStrategyAdapter } from './resize-strategy.internal';

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
    const opts = { ...HighResolutionManager.DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();
    let memoryPeakUsage = 0;

    // Initialize progress tracking
    const progressTracker = opts.enableProgressTracking
      ? HighResolutionManager.createProgressTracker(opts.onProgress)
      : null;

    try {
      // 1. Image analysis
      progressTracker?.update('analyzing', 10, 'Analyzing image...');
      const analysis = HighResolutionDetector.analyzeImage(img);

      // 2. Determine processing strategy
      const strategy = HighResolutionManager.selectOptimalStrategy(analysis, opts, img, targetWidth, targetHeight);
      progressTracker?.update('analyzing', 20, `Strategy selected: ${strategy}`);

      // 3. Check and manage memory situation
      await HighResolutionManager.checkAndManageMemory(opts, analysis);
      progressTracker?.update('analyzing', 30, 'Memory check completed');

      // 4. Execute actual processing
      progressTracker?.update('processing', 40, 'Starting image processing...');
      const canvas = await HighResolutionManager.executeProcessing(
        img,
        targetWidth,
        targetHeight,
        strategy,
        opts,
        progressTracker,
        analysis
      );

      // 5. 결과 생성
      progressTracker?.update('finalizing', 90, 'Finalizing...');
      const processingTime = (Date.now() - startTime) / 1000;
      memoryPeakUsage = HighResolutionManager.getCurrentMemoryUsage();

      progressTracker?.update('completed', 100, 'Processing completed');

      return {
        canvas,
        analysis,
        strategy,
        processingTime: Math.round(processingTime * 100) / 100,
        memoryPeakUsageMB: Math.round(memoryPeakUsage * 100) / 100,
        quality: opts.quality,
      };
    } catch (error) {
      throw createImageError('RESIZE_FAILED', {
        cause: error,
        context: { debug: { stage: 'High-resolution processing' } },
      });
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
    const memoryCheck = HighResolutionManager.isMemoryLow();
    if (memoryCheck) {
      productionLog.warn('Low memory detected, selecting memory-efficient strategy');
      return HighResolutionManager.selectMemoryEfficientStrategy(analysis);
    }

    // Strategy adjustment based on quality settings
    if (opts.quality === 'fast') {
      return HighResolutionManager.selectFastStrategy(analysis);
    } else if (opts.quality === 'high') {
      return HighResolutionManager.selectHighQualityStrategy(analysis, img, targetWidth, targetHeight);
    }

    // Select balanced strategy (default)
    return analysis.strategy;
  }

  /**
   * Select memory efficient strategy
   * @private
   *
   * chunked is now a tiled preset (resize-strategy.internal.ts). The former 128MB and
   * 32MB branches converge on TILED, leaving 32MB as the direct/tiled boundary.
   */
  private static selectMemoryEfficientStrategy(analysis: ImageAnalysis): ProcessingStrategy {
    if (analysis.estimatedMemoryMB > 32) {
      return ProcessingStrategy.TILED;
    }
    return ProcessingStrategy.DIRECT;
  }

  /**
   * Select fast processing strategy
   * @private
   *
   * chunked is now a tiled preset (resize-strategy.internal.ts), so values above 64MB use TILED.
   */
  private static selectFastStrategy(analysis: ImageAnalysis): ProcessingStrategy {
    // Select simplest strategy first for fast processing
    if (analysis.estimatedMemoryMB <= 64) {
      return ProcessingStrategy.DIRECT;
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
    progressTracker: ReturnType<typeof this.createProgressTracker> | null,
    analysis: ImageAnalysis
  ): Promise<HTMLCanvasElement> {
    const progressCallback = progressTracker
      ? (current: number, total: number) => {
          const progress = 40 + (current / total) * 40; // 40-80% range
          progressTracker.update('processing', progress, `Processing ${current}/${total}...`);
        }
      : undefined;

    const adapter = getResizeStrategyAdapter(strategy);
    if (!adapter) {
      // forceStrategy로 임의 문자열이 들어오는 런타임 경로 방어
      throw createImageError('FEATURE_NOT_SUPPORTED', {
        cause: new Error(`Unsupported processing strategy: ${strategy}`),
      });
    }

    return adapter.execute({
      img,
      targetWidth,
      targetHeight,
      quality: opts.quality,
      analysis,
      onProgress: progressCallback,
    });
  }

  /**
   * Check and manage memory situation
   * @private
   */
  private static async checkAndManageMemory(opts: HighResolutionOptions, analysis: ImageAnalysis): Promise<void> {
    const budget = readMemoryBudget();

    // Memory warning occurred
    if (opts.onMemoryWarning && budget.availableMB < (opts.maxMemoryUsageMB || 256)) {
      opts.onMemoryWarning({
        usageRatio: budget.pressure,
        availableMB: budget.availableMB,
      });
    }

    // Trigger garbage collection when memory is low
    if (HighResolutionManager.isMemoryLow()) {
      requestMemoryRelief();
    }
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
    const budget = readMemoryBudget();
    return budget.usedMB;
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
    const opts = { ...HighResolutionManager.DEFAULT_OPTIONS, ...options };
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
    const recommendedStrategy = HighResolutionManager.selectOptimalStrategy(
      analysis,
      opts as any,
      img,
      targetWidth,
      targetHeight
    );

    // Calculate estimated processing time
    const timeEstimate = HighResolutionDetector.estimateProcessingTime(analysis);
    let estimatedTime = timeEstimate.estimatedSeconds;

    // The adapter owns each strategy's time multiplier. Unknown runtime values keep the former switch default of 1.
    estimatedTime *= getResizeStrategyAdapter(recommendedStrategy)?.getTimeMultiplier(analysis) ?? 1;

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
          const result = await HighResolutionManager.smartResize(img, targetWidth, targetHeight, processingOptions);

          results[globalIndex] = result;
          completed++;
          onBatchProgress?.(completed, images.length);

          return result;
        } catch (error) {
          throw createImageError('RESIZE_FAILED', {
            cause: error,
            context: { debug: { stage: 'Batch processing', index: globalIndex } },
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
   *
   * 메모리 예산은 browser-capabilities/memory.internal.ts가 단일 소유한다. 이름과
   * 시그니처를 유지해 기존 vi.spyOn(HighResolutionManager as any, 'isMemoryLow')
   * 호출부가 깨지지 않게 한다.
   */
  private static isMemoryLow(): boolean {
    return readMemoryBudget().pressure > 0.8;
  }
}
