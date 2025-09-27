/**
 * @cp949/web-image-util - 고급 기능 API
 *
 * 고급 기능들을 제공하는 서브 엔트리포인트
 *
 * @example 사용법
 * ```typescript
 * // 고급 이미지 처리
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

// ===== 이미지 처리 시스템 =====
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

// ===== 성능 최적화 시스템 =====
export { autoResize, fastResize, qualityResize, ResizePerformance } from './core/performance-utils';
export { BatchResizer } from './core/batch-resizer';
export { getPerformanceConfig, RESIZE_PROFILES } from './core/performance-config';
export type { ResizePerformanceOptions, ResizeProfile } from './core/performance-config';

// ===== 향상된 에러 처리 시스템 =====
export { createAndHandleError, createQuickError, getErrorStats, withErrorHandling } from './base/error-helpers';
export { globalErrorHandler, ImageErrorHandler } from './core/error-handler';
export type { ErrorStats } from './core/error-handler';

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
export { FORMAT_MIME_MAP, FormatDetector } from './base/format-detector';
export type { ImageFormat } from './base/format-detector';

// ===== 편의 함수들 =====

/**
 * 빠른 썸네일 생성 (가장 일반적인 사용 사례)
 *
 * @description 고급 옵션을 사용하여 최적화된 썸네일을 생성합니다.
 * 워터마크, 필터, 자동 포맷 선택 등의 기능을 포함합니다.
 * @param image 원본 이미지 엘리먼트
 * @param size 썸네일 크기 (정사각형)
 * @param options 썸네일 생성 옵션
 * @returns 생성된 썸네일과 통계 정보
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
 *
 * @description 각 소셜 미디어 플랫폼의 권장 사이즈와 포맷에 맞춰 이미지를 최적화합니다.
 * 플랫폼별 최적 크기와 품질 설정을 자동으로 적용합니다.
 * @param image 원본 이미지 엘리먼트
 * @param platform 최적화할 소셜 미디어 플랫폼
 * @param options 추가 옵션 (워터마크, 필터 등)
 * @returns 최적화된 이미지 Canvas와 Blob
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
 *
 * @description 여러 이미지를 동시에 처리하여 효율성을 높입니다.
 * 동시성 제어와 진행률 콜백을 통해 대용량 배치 작업을 안정적으로 수행합니다.
 * @param images 처리할 이미지 배열 (이미지와 옵션 포함)
 * @param options 배치 처리 옵션 (동시성, 진행률 콜백 등)
 * @returns 처리 결과 배열 (이름과 결과 포함)
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
 *
 * @description 현재 환경에서 사용 가능한 고급 기능들의 상태와 정보를 반환합니다.
 * 브라우저 지원 여부, 등록된 플러그인 수, 성능 정보 등을 포함합니다.
 * @returns 고급 기능 정보 객체 (버전, 기능, 플러그인, 성능 정보)
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
 *
 * @description 개발자가 쉽게 커스텀 필터 플러그인을 만들 수 있도록 도와주는 팩토리 함수입니다.
 * 타입 안전성을 보장하면서 필터 플러그인의 필수 구조를 제공합니다.
 * @template TParams 필터 매개변수의 타입
 * @param config 필터 플러그인 설정 객체
 * @returns 생성된 필터 플러그인 객체
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
