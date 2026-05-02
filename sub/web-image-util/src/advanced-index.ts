/**
 * 고급 이미지 처리 기능을 한곳에서 노출하는 서브 엔트리다.
 *
 * @example
 * ```typescript
 * // 고급 이미지 처리
 * import { AdvancedImageProcessor, initializeFilterSystem } from '@cp949/web-image-util/advanced';
 *
 * initializeFilterSystem();
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
 * // 또는 개별 기능만 선택해서 사용
 * import { smartResize, addTextWatermark, autoOptimize } from '@cp949/web-image-util/advanced';
 * ```
 */

import type { FilterCategory, FilterOptions, FilterPlugin, FilterValidationResult } from './filters/plugin-system';
import { getMissingFilterNames } from './filters/plugin-system';
import { ImageProcessError } from './types';

// ===== 고급 오류 처리 =====
export { createAndHandleError, createQuickError, getErrorStats, withErrorHandling } from './base/error-helpers';
export type {
  PresetTextStyle,
  SimpleImageWatermarkOptions,
  SimplePosition,
  SimpleTextWatermarkOptions,
} from './composition/simple-watermark';
// ===== 단순 워터마크 시스템 =====
export { addCopyright, addImageWatermark, addTextWatermark, SimpleWatermark } from './composition/simple-watermark';
export type { AdvancedProcessingOptions, AdvancedProcessingResult } from './core/advanced-processor';
// ===== 고급 이미지 처리 =====
export {
  AdvancedImageProcessor,
  addWatermarkAndOptimize,
  processWithFilters,
  smartResize,
} from './core/advanced-processor';
export type { AutoProcessingResult } from './core/auto-high-res';
// ===== 자동 고해상도 처리 =====
export { AutoHighResProcessor, smartResize as autoSmartResize, smartResizeWithProgress } from './core/auto-high-res';
export { BatchResizer } from './core/batch-resizer';
export type { ErrorStats } from './core/error-handler';
export { globalErrorHandler, ImageErrorHandler } from './core/error-handler';
export type { ResizePerformanceOptions, ResizeProfile } from './core/performance-config';
export { getPerformanceConfig, RESIZE_PROFILES } from './core/performance-config';
// ===== 성능 최적화 =====
export { autoResize, fastResize, qualityResize, ResizePerformance } from './core/performance-utils';
export type { FormatOptimizationResult, SmartFormatOptions } from './core/smart-format';
// ===== 스마트 포맷 최적화 =====
export {
  autoOptimize,
  ImagePurpose,
  optimizeForThumbnail,
  optimizeForWeb,
  SmartFormatSelector,
} from './core/smart-format';
export type {
  BlendMode,
  FilterChain,
  FilterOptions,
  FilterPlugin,
  FilterValidationResult,
} from './filters/plugin-system';
// ===== 필터 플러그인 시스템 =====
export {
  applyFilter,
  applyFilterChain,
  FilterCategory,
  // 플러그인 매니저
  filterManager,
  getAvailableFilters,
  registerFilter,
} from './filters/plugin-system';
// 기본 필터 플러그인 (개별 플러그인, 카테고리별 컬렉션, AllFilterPlugins, 초기화 함수를 포함)
export * from './filters/plugins';

// ===== 고급 기능 =====

// 필터 시스템은 플러그인 아키텍처를 사용한다.
// 사용 예: filterManager.applyFilter(imageData, { name: 'brightness', params: { value: 10 } })

export type AdvancedFilterOption<TParams = unknown> = Pick<FilterOptions<TParams>, 'name' | 'params'>;

export type { ImageFormat } from './base/format-detector';
// 포맷 관련 기능
export { FORMAT_MIME_MAP, FormatDetector } from './base/format-detector';
export type { HighResolutionOptions, ProcessingResult } from './base/high-res-manager';

// 고해상도 처리 수동 제어
export { HighResolutionManager } from './base/high-res-manager';
// 세밀한 워터마크 제어
export type { ImageWatermarkOptions, TextWatermarkOptions } from './composition';
export { ImageWatermark } from './composition/image-watermark';
export { TextWatermark } from './composition/text-watermark';

// ===== 편의 함수 =====

/**
 * 가장 자주 쓰는 고급 썸네일 생성 흐름을 묶어 제공한다.
 *
 * @param image 원본 이미지 요소
 * @param size 정사각형 썸네일 한 변 길이
 * @param options 포맷, 품질, 워터마크, 필터 옵션
 * @returns 생성된 썸네일과 통계 정보
 */
export async function createAdvancedThumbnail(
  image: HTMLImageElement,
  size: number,
  options: {
    format?: 'auto' | 'webp' | 'jpeg' | 'png';
    quality?: 'fast' | 'balanced' | 'high';
    watermark?: string;
    filters?: AdvancedFilterOption[];
  } = {}
): Promise<{ canvas: HTMLCanvasElement; blob: Blob; stats: any }> {
  assertAdvancedFiltersInitialized(options.filters);

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

  // 브라우저 구현 차이로 Blob이 비어 있으면 기본 JPEG Blob을 다시 만든다.
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
 * 소셜 미디어 플랫폼 권장 크기에 맞춰 이미지를 최적화한다.
 *
 * @param image 원본 이미지 요소
 * @param platform 최적화 대상 플랫폼
 * @param options 워터마크와 필터 등 추가 옵션
 * @returns 최적화된 캔버스와 Blob
 */
export async function optimizeForSocial(
  image: HTMLImageElement,
  platform: 'instagram' | 'twitter' | 'facebook' | 'linkedin',
  options: {
    watermark?: string;
    filters?: AdvancedFilterOption[];
  } = {}
): Promise<{ canvas: HTMLCanvasElement; blob: Blob }> {
  assertAdvancedFiltersInitialized(options.filters);

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
 * advanced 편의 API에 전달된 필터가 초기화되었는지 사전 확인한다.
 *
 * @param filters 편의 API에 전달된 필터 목록
 * @throws {ImageProcessError} 초기화되지 않은 필터가 있으면
 */
function assertAdvancedFiltersInitialized(filters?: AdvancedFilterOption[]): void {
  if (!filters || filters.length === 0) {
    return;
  }

  const missingFilters = getMissingFilterNames(filters);

  if (missingFilters.length > 0) {
    throw new ImageProcessError(
      `Requested filters are not initialized: ${missingFilters.join(', ')}. Call initializeFilterSystem() before using advanced filters.`,
      'PROCESSING_FAILED'
    );
  }
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
  category: FilterCategory;
  defaultParams: TParams;
  apply: (imageData: ImageData, params: TParams) => ImageData;
  validate: (params: TParams) => FilterValidationResult;
}): FilterPlugin<TParams> {
  return {
    ...config,
    preview: config.apply, // Default to same as full application
  };
}
