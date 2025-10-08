/**
 * Advanced image processor - Interface for all advanced features
 * Provides advanced features through a unified, consistent API
 */

import type { ImageFormat } from '../base/format-detector';
import type { SimpleImageWatermarkOptions, SimpleTextWatermarkOptions } from '../composition/simple-watermark';
import { SimpleWatermark } from '../composition/simple-watermark';
import { productionLog } from '../utils/debug';
import type { FilterChain } from '../filters/plugin-system';
import { filterManager } from '../filters/plugin-system';
import type { AutoProcessingResult } from './auto-high-res';
import { AutoHighResProcessor } from './auto-high-res';
import type { SmartFormatOptions } from './smart-format';
import { ImagePurpose, SmartFormatSelector } from './smart-format';

/**
 * Advanced image processing options
 */
export interface AdvancedProcessingOptions {
  /** Resize options */
  resize?: {
    width: number;
    height: number;
    priority?: 'speed' | 'balanced' | 'quality';
  };

  /** Filter chain */
  filters?: FilterChain;

  /** Watermark options */
  watermark?: {
    text?: SimpleTextWatermarkOptions;
    image?: SimpleImageWatermarkOptions;
  };

  /** Format optimization options */
  format?: SmartFormatOptions | 'auto' | ImageFormat;

  /** Progress callback */
  onProgress?: (stage: string, progress: number, message: string) => void;

  /** Memory warning callback */
  onMemoryWarning?: (message: string) => void;
}

/**
 * Processing result
 */
export interface AdvancedProcessingResult {
  /** Processed canvas */
  canvas: HTMLCanvasElement;

  /** Final blob (when format optimization is applied) */
  blob?: Blob;

  /** Applied processing information */
  processing: {
    resizing?: AutoProcessingResult['optimizations'];
    filtersApplied: number;
    watermarkApplied: boolean;
    formatOptimization?: {
      originalFormat?: ImageFormat;
      finalFormat: ImageFormat;
      quality: number;
      estimatedSavings: number;
    };
  };

  /** Performance statistics */
  stats: {
    totalProcessingTime: number;
    memoryPeakUsage: number;
    finalFileSize?: number;
  };

  /** User messages */
  messages: string[];
}

/**
 * Advanced image processor class
 */
export class AdvancedImageProcessor {
  /**
   * Advanced image processing - Apply all features at once
   *
   * @param source - Source image
   * @param options - Processing options
   * @returns Processing result
   */
  static async processImage(
    source: HTMLImageElement,
    options: AdvancedProcessingOptions = {}
  ): Promise<AdvancedProcessingResult> {
    const startTime = Date.now();
    const { onProgress, onMemoryWarning } = options;
    const messages: string[] = [];

    let canvas: HTMLCanvasElement;
    let resizingResult: AutoProcessingResult | undefined;
    let filtersApplied = 0;
    let watermarkApplied = false;

    // 1. Resizing (automatic high-resolution optimization)
    if (options.resize) {
      onProgress?.('resizing', 10, 'Resizing image...');

      resizingResult = await AutoHighResProcessor.smartResize(source, options.resize.width, options.resize.height, {
        priority: options.resize.priority,
        onProgress: (progress, message) => {
          onProgress?.('resizing', 10 + progress * 0.4, message);
        },
        onMemoryWarning,
      });

      canvas = resizingResult.canvas;

      if (resizingResult.userMessage) {
        messages.push(resizingResult.userMessage);
      }
    } else {
      // Create canvas when not resizing
      canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(source, 0, 0);
    }

    onProgress?.('filtering', 50, 'Applying filters...');

    // 2. Apply filters (new plugin system)
    if (options.filters && options.filters.filters.length > 0) {
      try {
        const imageData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
        const filteredData = filterManager.applyFilterChain(imageData, options.filters);
        canvas.getContext('2d')!.putImageData(filteredData, 0, 0);

        filtersApplied = options.filters.filters.filter((f) => f.enabled !== false).length;
        messages.push(`Applied ${filtersApplied} filter(s).`);
      } catch (error) {
        productionLog.error('Filter application failed:', error);
        messages.push('Some filters failed to apply.');
      }
    }

    onProgress?.('watermarking', 70, 'Applying watermark...');

    // 3. Apply watermark (simplified API)
    if (options.watermark) {
      if (options.watermark.text) {
        SimpleWatermark.addText(canvas, options.watermark.text);
        watermarkApplied = true;
      }

      if (options.watermark.image) {
        SimpleWatermark.addImage(canvas, options.watermark.image);
        watermarkApplied = true;
      }

      if (watermarkApplied) {
        messages.push('Watermark applied.');
      }
    }

    onProgress?.('optimizing', 85, 'Optimizing format...');

    // 4. Format optimization (smart format selection)
    let blob: Blob | undefined;
    let formatOptimization: AdvancedProcessingResult['processing']['formatOptimization'];

    if (options.format) {
      try {
        if (options.format === 'auto') {
          // Auto optimization
          const formatResult = await SmartFormatSelector.selectOptimalFormat(canvas, {
            purpose: ImagePurpose.WEB,
          });

          blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Failed to create Blob'));
              },
              formatResult.mimeType,
              formatResult.quality
            );
          });

          formatOptimization = {
            finalFormat: formatResult.format,
            quality: formatResult.quality,
            estimatedSavings: formatResult.estimatedSavings || 0,
          };

          messages.push(`Format optimization: ${formatResult.format.toUpperCase()} (${formatResult.reason})`);
        } else if (typeof options.format === 'string') {
          // Specific format specified
          const mimeType = `image/${options.format}`;
          blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Failed to create Blob'));
              },
              mimeType,
              0.8
            );
          });

          formatOptimization = {
            finalFormat: options.format,
            quality: 0.8,
            estimatedSavings: 0,
          };
        } else {
          // Using SmartFormatOptions
          const formatResult = await SmartFormatSelector.selectOptimalFormat(canvas, options.format);

          blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Failed to create Blob'));
              },
              formatResult.mimeType,
              formatResult.quality
            );
          });

          formatOptimization = {
            finalFormat: formatResult.format,
            quality: formatResult.quality,
            estimatedSavings: formatResult.estimatedSavings || 0,
          };

          messages.push(`Format optimization: ${formatResult.reason}`);
        }
      } catch (error) {
        productionLog.error('Format optimization failed:', error);
        messages.push('Format optimization failed.');
      }
    }

    onProgress?.('finalizing', 100, 'Processing complete');

    const totalTime = (Date.now() - startTime) / 1000;

    return {
      canvas,
      blob,
      processing: {
        resizing: resizingResult?.optimizations,
        filtersApplied,
        watermarkApplied,
        formatOptimization,
      },
      stats: {
        totalProcessingTime: totalTime,
        memoryPeakUsage: resizingResult?.stats.memoryPeakUsage || 0,
        finalFileSize: blob?.size,
      },
      messages,
    };
  }

  /**
   * Quick thumbnail generation - most commonly used pattern
   */
  static async createThumbnail(
    source: HTMLImageElement,
    size: number | { width: number; height: number },
    options: {
      quality?: 'fast' | 'balanced' | 'high';
      format?: 'auto' | ImageFormat;
      watermark?: string;
    } = {}
  ): Promise<{ canvas: HTMLCanvasElement; blob: Blob }> {
    const dimensions = typeof size === 'number' ? { width: size, height: size } : size;

    const result = await this.processImage(source, {
      resize: {
        ...dimensions,
        priority: options.quality === 'fast' ? 'speed' : options.quality === 'high' ? 'quality' : 'balanced',
      },
      watermark: options.watermark
        ? {
            text: {
              text: options.watermark,
              position: 'bottom-right',
              style: 'subtle',
              size: 'small',
            },
          }
        : undefined,
      format: options.format || {
        purpose: ImagePurpose.THUMBNAIL,
        maxSizeKB: 50,
      },
    });

    if (!result.blob) {
      // Generate as default JPEG when Blob is not created
      const blob = await new Promise<Blob>((resolve, reject) => {
        result.canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Blob creation failed'));
          },
          'image/jpeg',
          0.8
        );
      });
      result.blob = blob;
    }

    return {
      canvas: result.canvas,
      blob: result.blob!,
    };
  }

  /**
   * Batch processing - efficiently process multiple images
   */
  static async batchProcess(
    sources: Array<{
      image: HTMLImageElement;
      options: AdvancedProcessingOptions;
      name?: string;
    }>,
    globalOptions: {
      concurrency?: number;
      onProgress?: (completed: number, total: number, currentImage?: string) => void;
      onImageComplete?: (index: number, result: AdvancedProcessingResult) => void;
    } = {}
  ): Promise<AdvancedProcessingResult[]> {
    const { concurrency = 2, onProgress, onImageComplete } = globalOptions;

    const results: AdvancedProcessingResult[] = new Array(sources.length);
    let completed = 0;

    // Divide into chunks for parallel processing
    const chunks: (typeof sources)[] = [];
    for (let i = 0; i < sources.length; i += concurrency) {
      chunks.push(sources.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (item, chunkIndex) => {
        const globalIndex = chunks.indexOf(chunk) * concurrency + chunkIndex;

        try {
          const result = await this.processImage(item.image, item.options);

          results[globalIndex] = result;
          completed++;

          onProgress?.(completed, sources.length, item.name);
          onImageComplete?.(globalIndex, result);

          return result;
        } catch (error) {
          productionLog.error(`Image processing failed (${item.name || globalIndex}):`, error);
          throw error;
        }
      });

      await Promise.all(chunkPromises);
    }

    return results;
  }

  /**
   * Processing preview - estimate results before actual processing
   */
  static async previewProcessing(
    source: HTMLImageElement,
    options: AdvancedProcessingOptions
  ): Promise<{
    canProcess: boolean;
    warnings: string[];
    estimatedTime: number;
    estimatedMemory: number;
    estimatedFileSize?: number;
    recommendations: string[];
  }> {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    let estimatedTime = 1; // Default 1 second
    let estimatedMemory = 50; // Default 50MB

    // Resizing validation
    if (options.resize) {
      const validation = AutoHighResProcessor.validateProcessing(source, options.resize.width, options.resize.height);

      warnings.push(...validation.warnings);
      recommendations.push(...validation.recommendations);
      estimatedTime += validation.estimatedTime;
      estimatedMemory = Math.max(estimatedMemory, validation.estimatedMemory);
    }

    // Filter validation
    if (options.filters) {
      const filterValidation = filterManager.validateFilterChain(options.filters);
      if (!filterValidation.valid) {
        warnings.push(...(filterValidation.errors || []));
      }
      if (filterValidation.warnings) {
        warnings.push(...filterValidation.warnings);
      }

      estimatedTime += options.filters.filters.length * 0.5; // 0.5 seconds per filter
    }

    // File size estimation (rough estimate)
    let estimatedFileSize: number | undefined;
    if (options.format && options.resize) {
      const pixels = options.resize.width * options.resize.height;
      const baseSize = pixels * 0.5; // Based on 0.5 bytes per pixel

      if (options.format === 'auto' || typeof options.format === 'object') {
        estimatedFileSize = baseSize * 0.3; // 30% expected with auto optimization
      } else {
        const formatMultiplier = {
          jpeg: 0.3,
          webp: 0.25,
          avif: 0.2,
          png: 1.0,
        };
        estimatedFileSize = baseSize * (formatMultiplier[options.format as keyof typeof formatMultiplier] || 0.5);
      }
    }

    return {
      canProcess: warnings.length === 0,
      warnings,
      estimatedTime: Math.round(estimatedTime * 10) / 10,
      estimatedMemory: Math.round(estimatedMemory),
      estimatedFileSize: estimatedFileSize ? Math.round(estimatedFileSize / 1024) : undefined, // KB units
      recommendations,
    };
  }
}

/**
 * Convenience functions - most common use cases
 */

/**
 * Smart resizing (auto optimization applied)
 */
export async function smartResize(
  image: HTMLImageElement,
  width: number,
  height: number,
  options: { quality?: 'fast' | 'balanced' | 'high'; format?: 'auto' } = {}
): Promise<{ canvas: HTMLCanvasElement; blob?: Blob }> {
  const result = await AdvancedImageProcessor.processImage(image, {
    resize: {
      width,
      height,
      priority: options.quality === 'fast' ? 'speed' : options.quality === 'high' ? 'quality' : 'balanced',
    },
    format: options.format,
  });

  return { canvas: result.canvas, blob: result.blob };
}

/**
 * Process with filters
 */
export async function processWithFilters(
  image: HTMLImageElement,
  filters: FilterChain,
  options: { format?: 'auto' } = {}
): Promise<{ canvas: HTMLCanvasElement; blob?: Blob }> {
  const result = await AdvancedImageProcessor.processImage(image, {
    filters,
    format: options.format,
  });

  return { canvas: result.canvas, blob: result.blob };
}

/**
 * Add watermark
 */
export async function addWatermarkAndOptimize(
  image: HTMLImageElement,
  watermark: { text?: string; logo?: HTMLImageElement },
  options: { format?: 'auto' } = {}
): Promise<{ canvas: HTMLCanvasElement; blob?: Blob }> {
  const watermarkOptions: AdvancedProcessingOptions['watermark'] = {};

  if (watermark.text) {
    watermarkOptions.text = { text: watermark.text };
  }

  if (watermark.logo) {
    watermarkOptions.image = { image: watermark.logo };
  }

  const result = await AdvancedImageProcessor.processImage(image, {
    watermark: watermarkOptions,
    format: options.format,
  });

  return { canvas: result.canvas, blob: result.blob };
}
