/**
 * @cp949/web-image-util - Advanced Features API
 *
 * Sub-entry point providing advanced features
 *
 * @example Usage
 * ```typescript
 * // Advanced image processing
 * import { AdvancedImageProcessor } from '@cp949/web-image-util/advanced';
 *
 * const result = await AdvancedImageProcessor.processImage(image, {
 *   resize: { width: 800, height: 600, priority: 'quality' },
 *   filters: {
 *     filters: [
 *       { name: 'brightness', params: { value: 10 } },
 *       { name: 'contrast', params: { value: 15 } }
 *     ]
 *   },
 *   watermark: {
 *     text: { text: '© 2024 Company', position: 'bottom-right' }
 *   },
 *   format: 'auto'
 * });
 *
 * // Or use individual features
 * import { smartResize, addTextWatermark, autoOptimize } from '@cp949/web-image-util/advanced';
 * ```
 */

// ===== Image Processing System =====
export {
  addWatermarkAndOptimize,
  AdvancedImageProcessor,
  processWithFilters,
  smartResize,
} from './core/advanced-processor';
export type { AdvancedProcessingOptions, AdvancedProcessingResult } from './core/advanced-processor';

// ===== Filter Plugin System =====
export {
  applyFilter,
  applyFilterChain,
  // Plugin manager
  filterManager,
  getAvailableFilters,
  registerFilter,
} from './filters/plugin-system';
export type {
  BlendMode,
  FilterCategory,
  FilterChain,
  FilterOptions,
  FilterPlugin,
  FilterValidationResult,
} from './filters/plugin-system';

// Default filter plugins
export { AllFilterPlugins, BlurFilterPlugins, ColorFilterPlugins, EffectFilterPlugins } from './filters/plugins';

// ===== Simplified Watermark System =====
export { addCopyright, addImageWatermark, addTextWatermark, SimpleWatermark } from './composition/simple-watermark';
export type {
  PresetTextStyle,
  SimpleImageWatermarkOptions,
  SimplePosition,
  SimpleTextWatermarkOptions,
} from './composition/simple-watermark';

// ===== Automatic High Resolution Processing =====
export { AutoHighResProcessor, smartResize as autoSmartResize, smartResizeWithProgress } from './core/auto-high-res';
export type { AutoProcessingResult } from './core/auto-high-res';

// ===== Smart Format Optimization =====
export {
  autoOptimize,
  ImagePurpose,
  optimizeForThumbnail,
  optimizeForWeb,
  SmartFormatSelector,
} from './core/smart-format';
export type { FormatOptimizationResult, SmartFormatOptions } from './core/smart-format';

// ===== Performance Optimization System =====
export { autoResize, fastResize, qualityResize, ResizePerformance } from './core/performance-utils';
export { BatchResizer } from './core/batch-resizer';
export { getPerformanceConfig, RESIZE_PROFILES } from './core/performance-config';
export type { ResizePerformanceOptions, ResizeProfile } from './core/performance-config';

// ===== Enhanced Error Handling System =====
export { createAndHandleError, createQuickError, getErrorStats, withErrorHandling } from './base/error-helpers';
export { globalErrorHandler, ImageErrorHandler } from './core/error-handler';
export type { ErrorStats } from './core/error-handler';

// ===== Advanced Features =====

// Filter system - plugin-based architecture
// Usage: filterManager.applyFilter(imageData, { name: 'brightness', params: { value: 10 } })

// Watermark system (fine-grained control)
export type { ImageWatermarkOptions, TextWatermarkOptions } from './composition';
export { ImageWatermark } from './composition/image-watermark';
export { TextWatermark } from './composition/text-watermark';

// High-resolution processing (manual control)
export { HighResolutionManager } from './base/high-res-manager';
export type { HighResolutionOptions, ProcessingResult } from './base/high-res-manager';

// Format related
export { FORMAT_MIME_MAP, FormatDetector } from './base/format-detector';
export type { ImageFormat } from './base/format-detector';

// ===== Convenience Functions =====

/**
 * Quick thumbnail generation (most common use case)
 *
 * @description Creates optimized thumbnails using advanced options.
 * Includes features like watermarks, filters, and automatic format selection.
 * @param image Original image element
 * @param size Thumbnail size (square)
 * @param options Thumbnail generation options
 * @returns Generated thumbnail and statistics information
 */
export async function createAdvancedThumbnail(
  image: HTMLImageElement,
  size: number,
  options: {
    format?: 'auto' | 'webp' | 'jpeg' | 'png';
    quality?: 'fast' | 'balanced' | 'high';
    watermark?: string;
    filters?: Array<{ name: string; params: any }>;
  } = {}
): Promise<{ canvas: HTMLCanvasElement; blob: Blob; stats: any }> {
  const { AdvancedImageProcessor } = await import('./core/advanced-processor');

  const result = await AdvancedImageProcessor.processImage(image, {
    resize: {
      width: size,
      height: size,
      priority: options.quality === 'high' ? 'quality' : options.quality === 'fast' ? 'speed' : 'balanced',
    },
    filters: options.filters
      ? {
          filters: options.filters.map((f) => ({ ...f, enabled: true })),
        }
      : undefined,
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
    format: options.format || 'auto',
  });

  // Default creation if Blob is missing
  if (!result.blob) {
    result.blob = await new Promise<Blob>((resolve, reject) => {
      result.canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Blob creation failed'));
        },
        'image/jpeg',
        0.8
      );
    });
  }

  return {
    canvas: result.canvas,
    blob: result.blob!,
    stats: result.stats,
  };
}

/**
 * Social media image optimization
 *
 * @description Optimizes images for each social media platform's recommended size and format.
 * Automatically applies platform-specific optimal size and quality settings.
 * @param image Original image element
 * @param platform Social media platform to optimize for
 * @param options Additional options (watermark, filters, etc.)
 * @returns Optimized image Canvas and Blob
 */
export async function optimizeForSocial(
  image: HTMLImageElement,
  platform: 'instagram' | 'twitter' | 'facebook' | 'linkedin',
  options: {
    watermark?: string;
    filters?: Array<{ name: string; params: any }>;
  } = {}
): Promise<{ canvas: HTMLCanvasElement; blob: Blob }> {
  const { AdvancedImageProcessor } = await import('./core/advanced-processor');

  const dimensions = {
    instagram: { width: 1080, height: 1080 },
    twitter: { width: 1200, height: 675 },
    facebook: { width: 1200, height: 630 },
    linkedin: { width: 1200, height: 627 },
  };

  const result = await AdvancedImageProcessor.processImage(image, {
    resize: {
      ...dimensions[platform],
      priority: 'balanced',
    },
    filters: options.filters
      ? {
          filters: options.filters.map((f) => ({ ...f, enabled: true })),
        }
      : undefined,
    watermark: options.watermark
      ? {
          text: {
            text: options.watermark,
            position: 'bottom-right',
            style: 'white-shadow',
            size: 'medium',
          },
        }
      : undefined,
    format: 'auto',
  });

  if (!result.blob) {
    result.blob = await new Promise<Blob>((resolve, reject) => {
      result.canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Blob creation failed'));
        },
        'image/jpeg',
        0.8
      );
    });
  }

  return {
    canvas: result.canvas,
    blob: result.blob!,
  };
}

/**
 * Batch optimization - process multiple images at once
 *
 * @description Processes multiple images simultaneously to improve efficiency.
 * Performs large batch operations reliably through concurrency control and progress callbacks.
 * @param images Array of images to process (including images and options)
 * @param options Batch processing options (concurrency, progress callback, etc.)
 * @returns Array of processing results (including names and results)
 */
export async function batchOptimize(
  images: Array<{
    image: HTMLImageElement;
    name?: string;
    options?: any;
  }>,
  options: {
    concurrency?: number;
    onProgress?: (completed: number, total: number, currentImage?: string) => void;
  } = {}
): Promise<Array<{ name?: string; result: any }>> {
  const { AdvancedImageProcessor } = await import('./core/advanced-processor');

  const results = await AdvancedImageProcessor.batchProcess(
    images.map((item) => ({
      image: item.image,
      options: item.options || { format: 'auto' },
      name: item.name,
    })),
    options
  );

  return results.map((result, index) => ({
    name: images[index].name,
    result,
  }));
}

/**
 * Advanced feature usage statistics and information
 *
 * @description Returns status and information of advanced features available in the current environment.
 * Includes browser support status, number of registered plugins, performance information, etc.
 * @returns Advanced feature information object (version, features, plugins, performance info)
 */
export function getAdvancedFeatureInfo() {
  return {
    version: '2.0.0-alpha',
    features: {
      pluginSystem: true,
      autoHighRes: true,
      smartFormat: true,
      advancedWatermark: true,
      batchProcessing: true,
    },
    plugins: {
      filters: 'Plugin system available',
      totalRegistered: 0,
    },
    performance: {
      webWorkerSupport: typeof Worker !== 'undefined',
      offscreenCanvasSupport: typeof OffscreenCanvas !== 'undefined',
      imageBitmapSupport: typeof createImageBitmap !== 'undefined',
    },
  };
}

// ===== Utilities for Plugin Developers =====

/**
 * Custom filter plugin creation helper
 *
 * @description Factory function that helps developers easily create custom filter plugins.
 * Provides essential filter plugin structure while ensuring type safety.
 * @template TParams Type of filter parameters
 * @param config Filter plugin configuration object
 * @returns Created filter plugin object
 */
export function createFilterPlugin<TParams>(config: {
  name: string;
  description: string;
  category: any;
  defaultParams: TParams;
  apply: (imageData: ImageData, params: TParams) => ImageData;
  validate: (params: TParams) => any;
}): any {
  return {
    ...config,
    preview: config.apply, // Default to same as full application
  };
}
