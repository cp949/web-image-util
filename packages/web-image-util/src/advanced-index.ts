/**
 * @cp949/web-image-util - 고급 기능 API
 *
 * Phase 3에서 구현된 모든 고급 기능들을 제공하는 서브 엔트리포인트
 *
 * @example 사용법
 * ```typescript
 * // 고급 통합 처리
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
 * // 또는 개별 기능 사용
 * import { smartResize, addTextWatermark, autoOptimize } from '@cp949/web-image-util/advanced';
 * ```
 */

// ===== 통합 처리 시스템 =====
export {
  addWatermarkAndOptimize,
  AdvancedImageProcessor,
  processWithFilters,
  smartResize,
} from './core/advanced-processor';
export type { AdvancedProcessingOptions, AdvancedProcessingResult } from './core/advanced-processor';

// ===== 필터 플러그인 시스템 =====
export {
  applyFilter,
  applyFilterChain,
  // 플러그인 매니저
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

// 기본 필터 플러그인들
export { AllFilterPlugins, BlurFilterPlugins, ColorFilterPlugins, EffectFilterPlugins } from './filters/plugins';

// ===== 간소화된 워터마크 시스템 =====
export { addCopyright, addImageWatermark, addTextWatermark, SimpleWatermark } from './composition/simple-watermark';
export type {
  PresetTextStyle,
  SimpleImageWatermarkOptions,
  SimplePosition,
  SimpleTextWatermarkOptions,
} from './composition/simple-watermark';

// ===== 자동 고해상도 처리 =====
export { AutoHighResProcessor, smartResize as autoSmartResize, smartResizeWithProgress } from './core/auto-high-res';
export type { AutoProcessingResult } from './core/auto-high-res';

// ===== 스마트 포맷 최적화 =====
export {
  autoOptimize,
  ImagePurpose,
  optimizeForThumbnail,
  optimizeForWeb,
  SmartFormatSelector,
} from './core/smart-format';
export type { FormatOptimizationResult, SmartFormatOptions } from './core/smart-format';

// ===== 고급 기능들 =====

// 필터 시스템 - 플러그인 기반 아키텍처
// 사용법: filterManager.applyFilter(imageData, { name: 'brightness', params: { value: 10 } })

// 워터마크 시스템 (세밀한 제어)
export type { ImageWatermarkOptions, TextWatermarkOptions } from './composition';
export { ImageWatermark } from './composition/image-watermark';
export { TextWatermark } from './composition/text-watermark';

// 고해상도 처리 (수동 제어)
export { HighResolutionManager } from './base/high-res-manager';
export type { HighResolutionOptions, ProcessingResult } from './base/high-res-manager';

// 포맷 관련
export { FORMAT_MIME_MAP, FormatDetector, ImageFormat } from './base/format-detector';

// ===== 편의 함수들 =====

/**
 * 빠른 썸네일 생성 (가장 일반적인 사용 사례)
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

  // Blob이 없는 경우 기본 생성
  if (!result.blob) {
    result.blob = await new Promise<Blob>((resolve, reject) => {
      result.canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Blob 생성 실패'));
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
 * 소셜 미디어용 이미지 최적화
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
          else reject(new Error('Blob 생성 실패'));
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
 * 배치 최적화 - 여러 이미지를 한 번에 처리
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
 * 고급 기능 사용 통계 및 정보
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

// ===== 플러그인 개발자를 위한 유틸리티 =====

/**
 * 커스텀 필터 플러그인 생성 도우미
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
    preview: config.apply, // 기본적으로 전체 적용과 동일
  };
}
