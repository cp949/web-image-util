/**
 * Automatic high-resolution image processing system
 * Transparent system that automatically processes high-resolution images
 */

import { HighResolutionDetector } from '../base/high-res-detector';
import type { HighResolutionOptions, ProcessingResult } from '../base/high-res-manager';
import { HighResolutionManager } from '../base/high-res-manager';
import { productionLog } from '../utils/debug';

/**
 * Automatic processing thresholds
 */
interface AutoProcessingThresholds {
  /** Pixel count considered 4K+ image (default: 8MP) */
  highResPixelThreshold: number;

  /** Memory usage warning threshold (MB) */
  memoryWarningThreshold: number;

  /** Auto-tiling application threshold (MB) */
  autoTileThreshold: number;

  /** Processing time warning threshold (seconds) */
  timeWarningThreshold: number;
}

/**
 * Automatic processing result
 */
export interface AutoProcessingResult {
  /** Processed canvas */
  canvas: HTMLCanvasElement;

  /** Automatically applied optimization information */
  optimizations: {
    strategy: string;
    memoryOptimized: boolean;
    tileProcessing: boolean;
    estimatedTimeSaved: number; // seconds
  };

  /** Processing statistics */
  stats: {
    originalSize: { width: number; height: number };
    finalSize: { width: number; height: number };
    processingTime: number;
    memoryPeakUsage: number;
    qualityLevel: 'fast' | 'balanced' | 'high';
  };

  /** Message to display to user (optional) */
  userMessage?: string;
}

/**
 * Automatic high-resolution processing class
 */
export class AutoHighResProcessor {
  private static defaultThresholds: AutoProcessingThresholds = {
    highResPixelThreshold: 8_000_000, // 8MP (approx 4K)
    memoryWarningThreshold: 200, // 200MB
    autoTileThreshold: 300, // 300MB
    timeWarningThreshold: 10, // 10 seconds
  };

  /**
   * Automatically optimized image resizing
   * Users can call simply without complex settings
   *
   * @param img - Source image
   * @param targetWidth - Target width
   * @param targetHeight - Target height
   * @param options - Optional options
   * @returns Optimized processing result
   */
  static async smartResize(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    options: {
      /** Quality priority: 'speed' (fast), 'balanced' (default), 'quality' (high quality) */
      priority?: 'speed' | 'balanced' | 'quality';

      /** Progress callback */
      onProgress?: (progress: number, message: string) => void;

      /** Memory warning callback */
      onMemoryWarning?: (message: string) => void;

      /** Custom thresholds */
      thresholds?: Partial<AutoProcessingThresholds>;
    } = {}
  ): Promise<AutoProcessingResult> {
    const { priority = 'balanced', onProgress, onMemoryWarning, thresholds: customThresholds } = options;

    // Set thresholds
    const thresholds = { ...this.defaultThresholds, ...customThresholds };

    // Analyze image
    const analysis = HighResolutionDetector.analyzeImage(img);
    const isHighRes = analysis.totalPixels > thresholds.highResPixelThreshold;

    onProgress?.(10, 'Analyzing image...');

    // Determine automatic optimization strategy
    const strategy = this.determineOptimalStrategy(analysis, priority, thresholds);

    onProgress?.(20, `Optimization strategy: ${strategy.name}`);

    // Check memory warning
    if (analysis.estimatedMemoryMB > thresholds.memoryWarningThreshold) {
      const warningMessage = `Memory usage may increase up to ${Math.round(analysis.estimatedMemoryMB)}MB due to large image processing.`;
      onMemoryWarning?.(warningMessage);
    }

    // Configure high-resolution processing options
    const highResOptions: HighResolutionOptions = {
      quality: strategy.quality,
      forceStrategy: strategy.processingStrategy,
      maxMemoryUsageMB: strategy.maxMemory,
      enableProgressTracking: !!onProgress,
      onProgress: onProgress
        ? (progress) => {
            onProgress(20 + progress.progress * 0.6, progress.details || 'Processing...');
          }
        : undefined,
    };

    // Perform actual processing
    let processingResult: ProcessingResult;
    try {
      if (isHighRes) {
        processingResult = await HighResolutionManager.smartResize(img, targetWidth, targetHeight, highResOptions);
      } else {
        // Direct processing for standard resolution
        processingResult = await this.standardResize(img, targetWidth, targetHeight, strategy.quality);
      }
    } catch (error) {
      // Fallback processing on failure
      productionLog.warn('High-resolution processing failed, switching to standard processing:', error);
      onProgress?.(50, 'Changing processing method...');
      processingResult = await this.standardResize(img, targetWidth, targetHeight, 'balanced');
    }

    onProgress?.(100, 'Processing complete');

    // Configure result
    const autoResult: AutoProcessingResult = {
      canvas: processingResult.canvas,
      optimizations: {
        strategy: strategy.name,
        memoryOptimized: strategy.memoryOptimized,
        tileProcessing: strategy.tileProcessing,
        estimatedTimeSaved: this.calculateTimeSaved(analysis, strategy),
      },
      stats: {
        originalSize: { width: img.width, height: img.height },
        finalSize: { width: targetWidth, height: targetHeight },
        processingTime: processingResult.processingTime,
        memoryPeakUsage: processingResult.memoryPeakUsageMB,
        qualityLevel: processingResult.quality,
      },
    };

    // Generate user message
    if (isHighRes && strategy.memoryOptimized) {
      autoResult.userMessage = `High-resolution image processed memory-efficiently. (${strategy.name} applied)`;
    }

    return autoResult;
  }

  /**
   * Pre-validation before image processing
   * Check processing capability and estimated resource usage in advance
   */
  static validateProcessing(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    options: { thresholds?: Partial<AutoProcessingThresholds> } = {}
  ): {
    canProcess: boolean;
    warnings: string[];
    recommendations: string[];
    estimatedTime: number;
    estimatedMemory: number;
    suggestedStrategy: string;
  } {
    const thresholds = { ...this.defaultThresholds, ...options.thresholds };

    // Basic validation
    const validation = HighResolutionManager.validateProcessingCapability(img, targetWidth, targetHeight);
    const analysis = HighResolutionDetector.analyzeImage(img);
    const strategy = this.determineOptimalStrategy(analysis, 'balanced', thresholds);

    const warnings: string[] = [...validation.warnings];
    const recommendations: string[] = [];

    // Memory warning
    if (analysis.estimatedMemoryMB > thresholds.memoryWarningThreshold) {
      warnings.push(`High memory usage expected: ${Math.round(analysis.estimatedMemoryMB)}MB`);
      recommendations.push('To reduce memory usage, resize to a smaller size.');
    }

    // Processing time warning
    if (validation.estimatedTime > thresholds.timeWarningThreshold) {
      warnings.push(`Long processing time expected: ${Math.round(validation.estimatedTime)} seconds`);
      recommendations.push('For faster processing, set priority to "speed".');
    }

    // Recommendations
    if (analysis.totalPixels > thresholds.highResPixelThreshold) {
      recommendations.push('This is a high-resolution image. Automatic optimization will be applied.');
    }

    return {
      canProcess: validation.canProcess,
      warnings,
      recommendations,
      estimatedTime: validation.estimatedTime,
      estimatedMemory: analysis.estimatedMemoryMB,
      suggestedStrategy: strategy.name,
    };
  }

  /**
   * Batch processing - efficiently process multiple images
   */
  static async batchSmartResize(
    images: { img: HTMLImageElement; targetWidth: number; targetHeight: number; name?: string }[],
    options: {
      priority?: 'speed' | 'balanced' | 'quality';
      concurrency?: number; // Number of images to process simultaneously
      onProgress?: (completed: number, total: number, currentImage?: string) => void;
      onImageComplete?: (index: number, result: AutoProcessingResult) => void;
    } = {}
  ): Promise<AutoProcessingResult[]> {
    const { priority = 'balanced', concurrency = 2, onProgress, onImageComplete } = options;

    const results: AutoProcessingResult[] = new Array(images.length);
    let completed = 0;

    // Divide into chunks for parallel processing
    const chunks: (typeof images)[] = [];
    for (let i = 0; i < images.length; i += concurrency) {
      chunks.push(images.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (imageItem, chunkIndex) => {
        const globalIndex = chunks.indexOf(chunk) * concurrency + chunkIndex;
        const { img, targetWidth, targetHeight, name } = imageItem;

        try {
          const result = await this.smartResize(img, targetWidth, targetHeight, {
            priority,
            onProgress: (progress, message) => {
              // Individual image progress is not reflected in overall (too complex)
            },
          });

          results[globalIndex] = result;
          completed++;

          onProgress?.(completed, images.length, name);
          onImageComplete?.(globalIndex, result);

          return result;
        } catch (error) {
          productionLog.error(`Image processing failed (${name || globalIndex}):`, error);
          throw error;
        }
      });

      await Promise.all(chunkPromises);
    }

    return results;
  }

  /**
   * Determine optimal strategy (internal method)
   */
  private static determineOptimalStrategy(
    analysis: any,
    priority: 'speed' | 'balanced' | 'quality',
    thresholds: AutoProcessingThresholds
  ) {
    const isHighMem = analysis.estimatedMemoryMB > thresholds.autoTileThreshold;

    // Determine strategy by priority
    switch (priority) {
      case 'speed':
        return {
          name: 'High-speed Processing',
          quality: 'fast' as const,
          processingStrategy: isHighMem ? analysis.strategy : undefined,
          memoryOptimized: isHighMem,
          tileProcessing: isHighMem,
          maxMemory: thresholds.autoTileThreshold,
        };

      case 'quality':
        return {
          name: 'High-quality Processing',
          quality: 'high' as const,
          processingStrategy: analysis.strategy,
          memoryOptimized: true,
          tileProcessing: isHighMem,
          maxMemory: thresholds.autoTileThreshold * 1.5,
        };

      default: // balanced
        return {
          name: 'Balanced Optimization',
          quality: 'balanced' as const,
          processingStrategy: analysis.strategy,
          memoryOptimized: isHighMem,
          tileProcessing: isHighMem,
          maxMemory: thresholds.autoTileThreshold,
        };
    }
  }

  /**
   * Standard resizing (for non-high-resolution cases)
   */
  private static async standardResize(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    quality: 'fast' | 'balanced' | 'high'
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d')!;

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

    const processingTime = (Date.now() - startTime) / 1000;

    return {
      canvas,
      analysis: HighResolutionDetector.analyzeImage(img),
      strategy: 'direct' as any,
      processingTime,
      memoryPeakUsageMB: 0,
      quality,
    };
  }

  /**
   * Time saved calculation (estimation)
   */
  private static calculateTimeSaved(analysis: any, strategy: any): number {
    // Simple estimation logic
    const baseTime = analysis.totalPixels / 1_000_000; // 1 second per megapixel baseline

    let timeSaved = 0;
    if (strategy.memoryOptimized) {
      timeSaved += baseTime * 0.3; // 30% time saved
    }
    if (strategy.tileProcessing) {
      timeSaved += baseTime * 0.2; // 20% additional savings
    }

    return Math.round(timeSaved * 10) / 10;
  }
}

/**
 * Convenience functions
 */

/**
 * Simplest high-resolution resizing
 * All optimizations are applied automatically
 */
export async function smartResize(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number
): Promise<HTMLCanvasElement> {
  const result = await AutoHighResProcessor.smartResize(img, targetWidth, targetHeight);
  return result.canvas;
}

/**
 * High-resolution resizing with progress
 */
export async function smartResizeWithProgress(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  onProgress: (progress: number, message: string) => void
): Promise<AutoProcessingResult> {
  return AutoHighResProcessor.smartResize(img, targetWidth, targetHeight, { onProgress });
}
