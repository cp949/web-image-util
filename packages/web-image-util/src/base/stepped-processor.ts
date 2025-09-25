import { withManagedCanvas } from './canvas-utils';
import { createImageError } from './error-helpers';

/**
 * 단계적 축소 품질 옵션
 */
export interface SteppedProcessingOptions {
  quality?: 'fast' | 'high';
  maxSteps?: number;
  minStepRatio?: number;
}

/**
 * 단계적 축소를 통한 고품질 리사이징 처리기
 * 대용량 이미지를 여러 단계에 걸쳐 점진적으로 축소하여
 * 앨리어싱을 최소화하고 품질을 향상시킵니다.
 */
export class SteppedProcessor {
  private static readonly DEFAULT_OPTIONS: Required<SteppedProcessingOptions> = {
    quality: 'high',
    maxSteps: 10,
    minStepRatio: 0.5,
  };

  /**
   * 단계적 축소로 이미지 리사이징
   *
   * @param img - 소스 이미지
   * @param targetWidth - 목표 너비
   * @param targetHeight - 목표 높이
   * @param options - 처리 옵션
   * @returns 리사이징된 Canvas
   */
  static async resizeWithSteps(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    options: SteppedProcessingOptions = {}
  ): Promise<HTMLCanvasElement> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const sourceWidth = img.width;
    const sourceHeight = img.height;

    // 입력 검증
    if (targetWidth <= 0 || targetHeight <= 0) {
      throw createImageError('RESIZE_FAILED', new Error('Invalid target dimensions'), {
        dimensions: { width: targetWidth, height: targetHeight },
      });
    }

    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw createImageError('RESIZE_FAILED', new Error('Invalid source dimensions'), {
        dimensions: { width: sourceWidth, height: sourceHeight },
      });
    }

    // 축소 비율 계산
    const scaleX = targetWidth / sourceWidth;
    const scaleY = targetHeight / sourceHeight;
    const minScale = Math.min(scaleX, scaleY);

    // 단계별 축소가 필요한지 판단
    if (minScale >= opts.minStepRatio || opts.quality === 'fast') {
      // 직접 리사이징으로 충분
      return this.directResize(img, targetWidth, targetHeight, opts.quality);
    }

    // 단계별 축소 실행
    return this.performSteppedResize(img, targetWidth, targetHeight, minScale, opts);
  }

  /**
   * 단계적 축소 실제 수행
   * @private
   */
  private static async performSteppedResize(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    minScale: number,
    opts: Required<SteppedProcessingOptions>
  ): Promise<HTMLCanvasElement> {
    // 단계 계산
    const steps = this.calculateOptimalSteps(minScale, opts.maxSteps);

    let currentCanvas = await this.imageToCanvas(img);
    let currentWidth = img.width;
    let currentHeight = img.height;

    try {
      // 각 단계별로 축소 수행
      for (let step = 0; step < steps.length; step++) {
        const stepScale = steps[step];
        const stepWidth =
          step === steps.length - 1
            ? targetWidth // 마지막 단계는 정확한 목표 크기
            : Math.max(targetWidth, Math.floor(currentWidth * stepScale));
        const stepHeight =
          step === steps.length - 1 ? targetHeight : Math.max(targetHeight, Math.floor(currentHeight * stepScale));

        const stepCanvas = await this.canvasToCanvas(currentCanvas, stepWidth, stepHeight, opts.quality);

        // 이전 Canvas 정리 (원본 이미지는 제외)
        if (currentCanvas !== (img as any)) {
          currentCanvas.width = 0;
          currentCanvas.height = 0;
        }

        currentCanvas = stepCanvas;
        currentWidth = stepWidth;
        currentHeight = stepHeight;
      }

      return currentCanvas;
    } catch (error) {
      // 에러 발생 시 현재 Canvas 정리
      if (currentCanvas !== (img as any)) {
        currentCanvas.width = 0;
        currentCanvas.height = 0;
      }
      throw createImageError('RESIZE_FAILED', error as Error, { debug: { stage: '단계적 축소 처리' } });
    }
  }

  /**
   * 최적 단계 계산
   * @private
   */
  private static calculateOptimalSteps(minScale: number, maxSteps: number): number[] {
    if (minScale >= 1) {
      return [1]; // 축소가 필요 없음
    }

    const steps: number[] = [];
    const targetSteps = Math.min(maxSteps, Math.ceil(Math.log2(1 / minScale)));

    // 각 단계별 축소 비율 계산
    for (let i = 1; i <= targetSteps; i++) {
      if (i === targetSteps) {
        // 마지막 단계는 목표 크기에 정확히 맞춤
        steps.push(minScale);
      } else {
        // 중간 단계는 대략 절반씩 축소
        const stepScale = Math.pow(minScale, i / targetSteps);
        steps.push(Math.max(0.5, stepScale));
      }
    }

    return steps;
  }

  /**
   * HTMLImageElement를 Canvas로 변환
   * @private
   */
  private static async imageToCanvas(img: HTMLImageElement): Promise<HTMLCanvasElement> {
    return withManagedCanvas(img.width, img.height, (canvas, ctx) => {
      // 고품질 렌더링 설정
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(img, 0, 0);
      return canvas;
    });
  }

  /**
   * Canvas를 다른 크기의 Canvas로 변환
   * @private
   */
  private static async canvasToCanvas(
    sourceCanvas: HTMLCanvasElement,
    targetWidth: number,
    targetHeight: number,
    quality: 'fast' | 'high' = 'high'
  ): Promise<HTMLCanvasElement> {
    return withManagedCanvas(targetWidth, targetHeight, (targetCanvas, ctx) => {
      // 품질에 따른 렌더링 설정
      if (quality === 'high') {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      } else {
        ctx.imageSmoothingEnabled = false;
      }

      ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
      return targetCanvas;
    });
  }

  /**
   * 직접 리사이징 (단계별 축소 없이)
   * @private
   */
  private static async directResize(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    quality: 'fast' | 'high' = 'high'
  ): Promise<HTMLCanvasElement> {
    return withManagedCanvas(targetWidth, targetHeight, (canvas, ctx) => {
      if (quality === 'high') {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      } else {
        ctx.imageSmoothingEnabled = false;
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      return canvas;
    });
  }

  /**
   * 단계별 축소가 필요한지 판단
   *
   * @param sourceWidth - 원본 너비
   * @param sourceHeight - 원본 높이
   * @param targetWidth - 목표 너비
   * @param targetHeight - 목표 높이
   * @param qualityThreshold - 품질 임계값 (기본: 0.5)
   * @returns 단계별 축소 필요 여부
   */
  static shouldUseSteppedResize(
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number,
    qualityThreshold: number = 0.5
  ): boolean {
    const scaleX = targetWidth / sourceWidth;
    const scaleY = targetHeight / sourceHeight;
    const minScale = Math.min(scaleX, scaleY);

    return minScale < qualityThreshold;
  }

  /**
   * 예상 처리 단계 수 계산
   *
   * @param sourceWidth - 원본 너비
   * @param sourceHeight - 원본 높이
   * @param targetWidth - 목표 너비
   * @param targetHeight - 목표 높이
   * @param maxSteps - 최대 단계 수
   * @returns 예상 처리 단계 수
   */
  static estimateSteps(
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number,
    maxSteps: number = 10
  ): number {
    const scaleX = targetWidth / sourceWidth;
    const scaleY = targetHeight / sourceHeight;
    const minScale = Math.min(scaleX, scaleY);

    if (minScale >= 0.5) {
      return 1; // 직접 리사이징
    }

    const theoreticalSteps = Math.ceil(Math.log2(1 / minScale));
    return Math.min(maxSteps, theoreticalSteps);
  }

  /**
   * 배치 이미지 단계적 리사이징
   * 여러 이미지를 효율적으로 처리합니다.
   *
   * @param images - 처리할 이미지 배열
   * @param targetWidth - 목표 너비
   * @param targetHeight - 목표 높이
   * @param options - 처리 옵션
   * @returns 처리된 Canvas 배열
   */
  static async batchResizeWithSteps(
    images: HTMLImageElement[],
    targetWidth: number,
    targetHeight: number,
    options: SteppedProcessingOptions & {
      concurrency?: number;
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<HTMLCanvasElement[]> {
    const { concurrency = 3, onProgress, ...processingOptions } = options;
    const results: HTMLCanvasElement[] = new Array(images.length);
    let completed = 0;

    // 병렬 처리를 위한 청크 분할
    const chunks: HTMLImageElement[][] = [];
    for (let i = 0; i < images.length; i += concurrency) {
      chunks.push(images.slice(i, i + concurrency));
    }

    // 각 청크를 순차적으로 처리하되, 청크 내에서는 병렬 처리
    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (img, chunkIndex) => {
        const globalIndex = chunks.indexOf(chunk) * concurrency + chunkIndex;

        try {
          const result = await this.resizeWithSteps(img, targetWidth, targetHeight, processingOptions);

          results[globalIndex] = result;
          completed++;
          onProgress?.(completed, images.length);

          return result;
        } catch (error) {
          throw createImageError('RESIZE_FAILED', error as Error, {
            debug: { stage: '배치 처리', index: globalIndex },
          });
        }
      });

      await Promise.all(chunkPromises);
    }

    return results;
  }

  /**
   * 메모리 효율적인 단계별 축소
   * 메모리 사용량을 모니터링하면서 처리합니다.
   *
   * @param img - 소스 이미지
   * @param targetWidth - 목표 너비
   * @param targetHeight - 목표 높이
   * @param maxMemoryMB - 최대 메모리 사용량 (MB)
   * @returns 처리된 Canvas
   */
  static async memoryEfficientResize(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    maxMemoryMB: number = 64
  ): Promise<HTMLCanvasElement> {
    const maxPixels = (maxMemoryMB * 1024 * 1024) / 4; // RGBA 4바이트
    const targetPixels = targetWidth * targetHeight;

    if (targetPixels > maxPixels) {
      throw createImageError(
        'FILE_TOO_LARGE',
        new Error(`목표 이미지가 메모리 제한을 초과합니다 (제한: ${maxMemoryMB}MB)`)
      );
    }

    // 메모리 제한을 고려한 단계별 처리
    const sourcePixels = img.width * img.height;
    const stepPixelLimit = Math.min(sourcePixels, maxPixels * 0.8); // 여유분 확보
    const stepDimension = Math.floor(Math.sqrt(stepPixelLimit));

    if (Math.max(img.width, img.height) <= stepDimension) {
      // 메모리 제한 내에서 직접 처리 가능
      return this.resizeWithSteps(img, targetWidth, targetHeight, { quality: 'high' });
    }

    // 메모리 제한을 고려한 단계별 축소
    return this.resizeWithSteps(img, targetWidth, targetHeight, {
      quality: 'high',
      maxSteps: 15, // 더 많은 단계로 메모리 사용량 분산
      minStepRatio: 0.3, // 더 세밀한 단계 적용
    });
  }
}
