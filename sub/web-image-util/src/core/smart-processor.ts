/**
 * 스마트 이미지 프로세서 - 간소화된 고해상도 처리
 *
 * @description 복잡한 HighResolutionManager를 간단한 API로 포장합니다.
 * 사용자는 복잡한 전략을 몰라도 되고, 내부에서 자동으로 최적화됩니다.
 */

import { createImageError } from '../base/error-helpers';
import type { ProcessingStrategy } from '../base/high-res-detector';
import type { SmartResizeOptions } from '../types';
import { AutoMemoryManager } from './auto-memory-manager';
import { BatchResizer, type BatchResizeJob } from './batch-resizer';
import { InternalHighResProcessor } from './internal/internal-high-res-processor';
import type { ResizeProfile } from './performance-config';


/**
 * 스마트 프로세서 - 고해상도 이미지 처리의 복잡성을 숨기는 클래스
 *
 * @example
 * ```typescript
 * // ✅ 가장 간단한 사용 - 모든 것이 자동
 * const result = await SmartProcessor.process(img, 800, 600);
 *
 * // ✅ 전략 지정 (여전히 간단)
 * const result = await SmartProcessor.process(img, 800, 600, {
 *   strategy: 'quality',
 *   onProgress: (progress) => console.log(`${progress}%`)
 * });
 * ```
 */
export class SmartProcessor {
  /**
   * 스마트 이미지 리사이징 - 간단한 API
   *
   * @param img 소스 이미지
   * @param width 목표 너비
   * @param height 목표 높이
   * @param options 간단한 옵션 (기본값만으로도 충분)
   * @returns 처리된 Canvas
   */
  static async process(
    img: HTMLImageElement,
    width: number,
    height: number,
    options: SmartResizeOptions = {}
  ): Promise<HTMLCanvasElement> {
    try {
      // 기본값 설정 - 합리적인 기본값
      const strategy = options.strategy || 'auto';

      // 자동 최적화 판단
      const shouldUseHighRes = this.shouldUseHighResProcessing(img.width, img.height, width, height);

      if (!shouldUseHighRes) {
        // 일반 리사이징 - 간단하고 빠름
        return this.simpleResize(img, width, height, options);
      }

      // 고해상도 처리 필요 - 복잡한 옵션을 간단한 옵션으로 변환
      const internalOptions = this.convertToInternalOptions(options, img.width, img.height);

      // 메모리 상황 자동 체크
      const memoryManager = AutoMemoryManager.getInstance();
      await memoryManager.checkAndOptimize();

      const result = await InternalHighResProcessor.smartResize(img, width, height, internalOptions);

      return result.canvas;
    } catch (error) {
      throw createImageError('PROCESSING_FAILED', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 고해상도 처리가 필요한지 자동 판단
   * 사용자는 이런 복잡한 로직을 몰라도 됨
   */
  private static shouldUseHighResProcessing(
    originalWidth: number,
    originalHeight: number,
    targetWidth: number,
    targetHeight: number
  ): boolean {
    const originalPixels = originalWidth * originalHeight;
    const targetPixels = targetWidth * targetHeight;

    // 간단한 휴리스틱: 4MP 이상이거나 큰 스케일링이 필요한 경우
    return originalPixels > 4_000_000 || Math.max(originalWidth / targetWidth, originalHeight / targetHeight) > 4;
  }

  /**
   * 간단한 리사이징 - 일반적인 경우
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

    // 기본적인 고품질 설정
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 간단한 진행률 보고
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
   * 간단한 사용자 옵션을 복잡한 내부 옵션으로 변환
   * 이 변환 로직을 사용자는 몰라도 됨
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
   * 사용자 전략을 품질 설정으로 매핑
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
   * 자동 전략 선택 - 내부에서 자동 최적화
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

    // 'auto': 이미지 크기에 따라 자동 선택
    if (pixelCount > 16_000_000) {
      return 'tiled'; // 16MP+ : 타일 방식
    } else if (pixelCount > 4_000_000) {
      return 'chunked'; // 4-16MP: 청크 방식
    } else {
      return 'stepped'; // 4MP-: 단계별 방식
    }
  }

  /**
   * 자동 메모리 제한 계산
   */
  private static getAutoMemoryLimit(): number {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      // 사용 가능한 메모리의 20% 정도를 제한으로 설정
      return Math.round(((memory.jsHeapSizeLimit - memory.usedJSHeapSize) * 0.2) / (1024 * 1024));
    }

    // 기본값: 256MB
    return 256;
  }

  /**
   * 복잡한 진행률 콜백을 간단한 콜백으로 변환
   */
  private static wrapProgressCallback(simpleCallback: (progress: number) => void) {
    return (progress: any) => {
      // 복잡한 HighResolutionProgress를 단순한 0-100 숫자로 변환
      const simpleProgress = typeof progress === 'object' ? progress.progress : progress;
      simpleCallback(Math.round(simpleProgress));
    };
  }

  /**
   * 배치 처리 - 여러 이미지를 효율적으로 동시 처리
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
   * 같은 크기로 여러 이미지 리사이징 - 편의 메서드
   *
   * @param images 처리할 이미지들
   * @param width 목표 너비
   * @param height 목표 높이
   * @param options 리사이징 옵션
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
