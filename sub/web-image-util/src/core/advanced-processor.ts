/**
 * 고급 이미지 프로세서 - 모든 고급 기능들의 인터페이스
 * 고급 기능들을 하나의 일관된 API로 제공
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
 * 고급 이미지 처리 옵션
 */
export interface AdvancedProcessingOptions {
  /** 리사이징 옵션 */
  resize?: {
    width: number;
    height: number;
    priority?: 'speed' | 'balanced' | 'quality';
  };

  /** 필터 체인 */
  filters?: FilterChain;

  /** 워터마크 옵션 */
  watermark?: {
    text?: SimpleTextWatermarkOptions;
    image?: SimpleImageWatermarkOptions;
  };

  /** 포맷 최적화 옵션 */
  format?: SmartFormatOptions | 'auto' | ImageFormat;

  /** 진행률 콜백 */
  onProgress?: (stage: string, progress: number, message: string) => void;

  /** 메모리 경고 콜백 */
  onMemoryWarning?: (message: string) => void;
}

/**
 * 처리 결과
 */
export interface AdvancedProcessingResult {
  /** 처리된 캔버스 */
  canvas: HTMLCanvasElement;

  /** 최종 Blob (포맷 최적화 적용 시) */
  blob?: Blob;

  /** 적용된 처리 정보 */
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

  /** 성능 통계 */
  stats: {
    totalProcessingTime: number;
    memoryPeakUsage: number;
    finalFileSize?: number;
  };

  /** 사용자 메시지 */
  messages: string[];
}

/**
 * 고급 이미지 프로세서 클래스
 */
export class AdvancedImageProcessor {
  /**
   * 고급 이미지 처리 - 모든 기능을 한 번에 적용
   *
   * @param source - 소스 이미지
   * @param options - 처리 옵션
   * @returns 처리 결과
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

    // 1. 리사이징 (고해상도 자동 최적화)
    if (options.resize) {
      onProgress?.('resizing', 10, '이미지 리사이징 중...');

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
      // 리사이징하지 않는 경우 캔버스 생성
      canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(source, 0, 0);
    }

    onProgress?.('filtering', 50, '필터 적용 중...');

    // 2. 필터 적용 (새로운 플러그인 시스템)
    if (options.filters && options.filters.filters.length > 0) {
      try {
        const imageData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
        const filteredData = filterManager.applyFilterChain(imageData, options.filters);
        canvas.getContext('2d')!.putImageData(filteredData, 0, 0);

        filtersApplied = options.filters.filters.filter((f) => f.enabled !== false).length;
        messages.push(`${filtersApplied}개의 필터가 적용되었습니다.`);
      } catch (error) {
        productionLog.error('필터 적용 실패:', error);
        messages.push('일부 필터 적용에 실패했습니다.');
      }
    }

    onProgress?.('watermarking', 70, '워터마크 적용 중...');

    // 3. 워터마크 적용 (간소화된 API)
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
        messages.push('워터마크가 적용되었습니다.');
      }
    }

    onProgress?.('optimizing', 85, '포맷 최적화 중...');

    // 4. 포맷 최적화 (스마트 포맷 선택)
    let blob: Blob | undefined;
    let formatOptimization: AdvancedProcessingResult['processing']['formatOptimization'];

    if (options.format) {
      try {
        if (options.format === 'auto') {
          // 자동 최적화
          const formatResult = await SmartFormatSelector.selectOptimalFormat(canvas, {
            purpose: ImagePurpose.WEB,
          });

          blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Blob 생성 실패'));
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

          messages.push(`포맷 최적화: ${formatResult.format.toUpperCase()} (${formatResult.reason})`);
        } else if (typeof options.format === 'string') {
          // 특정 포맷 지정
          const mimeType = `image/${options.format}`;
          blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Blob 생성 실패'));
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
          // SmartFormatOptions 사용
          const formatResult = await SmartFormatSelector.selectOptimalFormat(canvas, options.format);

          blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Blob 생성 실패'));
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

          messages.push(`포맷 최적화: ${formatResult.reason}`);
        }
      } catch (error) {
        productionLog.error('포맷 최적화 실패:', error);
        messages.push('포맷 최적화에 실패했습니다.');
      }
    }

    onProgress?.('finalizing', 100, '처리 완료');

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
   * 빠른 썸네일 생성 - 가장 자주 사용되는 패턴
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
      // Blob이 생성되지 않은 경우 기본 JPEG로 생성
      const blob = await new Promise<Blob>((resolve, reject) => {
        result.canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Blob 생성 실패'));
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
   * 배치 처리 - 여러 이미지를 효율적으로 처리
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

    // 청크로 나누어 병렬 처리
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
          productionLog.error(`이미지 처리 실패 (${item.name || globalIndex}):`, error);
          throw error;
        }
      });

      await Promise.all(chunkPromises);
    }

    return results;
  }

  /**
   * 처리 미리보기 - 실제 처리 전 결과 예상
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

    let estimatedTime = 1; // 기본 1초
    let estimatedMemory = 50; // 기본 50MB

    // 리사이징 검증
    if (options.resize) {
      const validation = AutoHighResProcessor.validateProcessing(source, options.resize.width, options.resize.height);

      warnings.push(...validation.warnings);
      recommendations.push(...validation.recommendations);
      estimatedTime += validation.estimatedTime;
      estimatedMemory = Math.max(estimatedMemory, validation.estimatedMemory);
    }

    // 필터 검증
    if (options.filters) {
      const filterValidation = filterManager.validateFilterChain(options.filters);
      if (!filterValidation.valid) {
        warnings.push(...(filterValidation.errors || []));
      }
      if (filterValidation.warnings) {
        warnings.push(...filterValidation.warnings);
      }

      estimatedTime += options.filters.filters.length * 0.5; // 필터당 0.5초
    }

    // 파일 크기 예상 (rough estimate)
    let estimatedFileSize: number | undefined;
    if (options.format && options.resize) {
      const pixels = options.resize.width * options.resize.height;
      const baseSize = pixels * 0.5; // 픽셀당 0.5바이트 기준

      if (options.format === 'auto' || typeof options.format === 'object') {
        estimatedFileSize = baseSize * 0.3; // 자동 최적화로 30% 예상
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
      estimatedFileSize: estimatedFileSize ? Math.round(estimatedFileSize / 1024) : undefined, // KB 단위
      recommendations,
    };
  }
}

/**
 * 편의 함수들 - 가장 일반적인 사용 사례들
 */

/**
 * 스마트 리사이징 (자동 최적화 적용)
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
 * 필터와 함께 처리
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
 * 워터마크 추가
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
