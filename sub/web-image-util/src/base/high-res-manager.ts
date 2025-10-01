import { withManagedCanvas } from './canvas-utils';
import { createImageError } from './error-helpers';
import { productionLog } from '../utils/debug';
import type { ImageAnalysis } from './high-res-detector';
import { HighResolutionDetector, ProcessingStrategy } from './high-res-detector';
// 브라우저 환경에 최적화된 메모리 관리
import { SteppedProcessor } from './stepped-processor';
import { TiledProcessor } from './tiled-processor';

/**
 * 고해상도 처리 옵션
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
 * 고해상도 처리 진행 상황
 */
export interface HighResolutionProgress {
  stage: 'analyzing' | 'processing' | 'finalizing' | 'completed';
  progress: number; // 0-100
  currentStrategy: ProcessingStrategy;
  timeElapsed: number; // 초
  estimatedTimeRemaining: number; // 초
  memoryUsageMB: number;
  details?: string;
}

/**
 * 처리 결과 정보
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
 * 고해상도 이미지 처리 관리자
 * 다양한 처리 전략을 조합하여 최적의 결과를 제공합니다.
 */
export class HighResolutionManager {
  private static readonly DEFAULT_OPTIONS = {
    quality: 'balanced' as const,
    maxMemoryUsageMB: 256,
    enableProgressTracking: false,
  };

  /**
   * 최적 전략으로 이미지 리사이징
   *
   * @param img - 소스 이미지
   * @param targetWidth - 목표 너비
   * @param targetHeight - 목표 높이
   * @param options - 처리 옵션
   * @returns 처리 결과
   */
  static async smartResize(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    options: HighResolutionOptions = {}
  ): Promise<ProcessingResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();
    let memoryPeakUsage = 0;

    // 진행 상황 추적 초기화
    const progressTracker = opts.enableProgressTracking ? this.createProgressTracker(opts.onProgress) : null;

    try {
      // 1. 이미지 분석
      progressTracker?.update('analyzing', 10, 'Analyzing image...');
      const analysis = HighResolutionDetector.analyzeImage(img);

      // 2. 처리 전략 결정
      const strategy = this.selectOptimalStrategy(analysis, opts, img, targetWidth, targetHeight);
      progressTracker?.update('analyzing', 20, `Strategy selected: ${strategy}`);

      // 3. 메모리 상황 확인 및 조정
      await this.checkAndManageMemory(opts, analysis);
      progressTracker?.update('analyzing', 30, 'Memory check completed');

      // 4. 실제 처리 수행
      progressTracker?.update('processing', 40, 'Starting image processing...');
      const canvas = await this.executeProcessing(img, targetWidth, targetHeight, strategy, opts, progressTracker);

      // 5. 후처리 및 최적화
      progressTracker?.update('finalizing', 90, 'Finalizing...');
      const optimizedCanvas = await this.postProcess(canvas, opts);

      // 6. 결과 생성
      const processingTime = (Date.now() - startTime) / 1000;
      memoryPeakUsage = this.getCurrentMemoryUsage();

      progressTracker?.update('completed', 100, 'Processing completed');

      return {
        canvas: optimizedCanvas,
        analysis,
        strategy,
        processingTime: Math.round(processingTime * 100) / 100,
        memoryPeakUsageMB: Math.round(memoryPeakUsage * 100) / 100,
        quality: opts.quality,
      };
    } catch (error) {
      throw createImageError('RESIZE_FAILED', error as Error, { debug: { stage: '고해상도 처리' } });
    }
  }

  /**
   * 최적 처리 전략 선택
   * @private
   */
  private static selectOptimalStrategy(
    analysis: ImageAnalysis,
    opts: HighResolutionOptions & { quality: 'fast' | 'balanced' | 'high' },
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number
  ): ProcessingStrategy {
    // 강제 전략이 지정된 경우
    if (opts.forceStrategy) {
      return opts.forceStrategy;
    }

    // 메모리 제약이 심각한 경우
    // 간단한 메모리 체크
    const memoryCheck = this.isMemoryLow();
    if (memoryCheck) {
      productionLog.warn('Low memory detected, selecting memory-efficient strategy');
      return this.selectMemoryEfficientStrategy(analysis);
    }

    // 품질 설정에 따른 전략 조정
    if (opts.quality === 'fast') {
      return this.selectFastStrategy(analysis);
    } else if (opts.quality === 'high') {
      return this.selectHighQualityStrategy(analysis, img, targetWidth, targetHeight);
    }

    // 균형잡힌 전략 선택 (기본)
    return analysis.strategy;
  }

  /**
   * 메모리 효율적 전략 선택
   * @private
   */
  private static selectMemoryEfficientStrategy(analysis: ImageAnalysis): ProcessingStrategy {
    if (analysis.estimatedMemoryMB > 128) {
      return ProcessingStrategy.TILED;
    } else if (analysis.estimatedMemoryMB > 32) {
      return ProcessingStrategy.CHUNKED;
    }
    return ProcessingStrategy.DIRECT;
  }

  /**
   * 빠른 처리 전략 선택
   * @private
   */
  private static selectFastStrategy(analysis: ImageAnalysis): ProcessingStrategy {
    // 빠른 처리를 위해 가장 간단한 전략 우선 선택
    if (analysis.estimatedMemoryMB <= 64) {
      return ProcessingStrategy.DIRECT;
    } else if (analysis.estimatedMemoryMB <= 128) {
      return ProcessingStrategy.CHUNKED;
    }
    return ProcessingStrategy.TILED;
  }

  /**
   * 고품질 처리 전략 선택
   * @private
   */
  private static selectHighQualityStrategy(
    analysis: ImageAnalysis,
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number
  ): ProcessingStrategy {
    // 큰 축소가 필요한 경우 단계적 축소가 품질상 유리
    const scaleRatio = Math.min(targetWidth / img.width, targetHeight / img.height);

    if (scaleRatio < 0.3 && analysis.estimatedMemoryMB <= 256) {
      return ProcessingStrategy.STEPPED;
    }

    // 매우 큰 이미지는 타일 처리
    if (analysis.estimatedMemoryMB > 256) {
      return ProcessingStrategy.TILED;
    }

    return analysis.strategy;
  }

  /**
   * 실제 처리 수행
   * @private
   */
  private static async executeProcessing(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    strategy: ProcessingStrategy,
    opts: HighResolutionOptions & { quality: 'fast' | 'balanced' | 'high' },
    progressTracker: ReturnType<typeof this.createProgressTracker> | null
  ): Promise<HTMLCanvasElement> {
    const progressCallback = progressTracker
      ? (current: number, total: number) => {
          const progress = 40 + (current / total) * 40; // 40-80% 범위
          progressTracker.update('processing', progress, `Processing ${current}/${total}...`);
        }
      : undefined;

    switch (strategy) {
      case ProcessingStrategy.DIRECT:
        return this.directResize(img, targetWidth, targetHeight, opts.quality);

      case ProcessingStrategy.CHUNKED:
        return this.chunkedResize(img, targetWidth, targetHeight, opts, progressCallback);

      case ProcessingStrategy.STEPPED:
        return SteppedProcessor.resizeWithSteps(img, targetWidth, targetHeight, {
          quality: opts.quality === 'fast' ? 'fast' : 'high',
          maxSteps: opts.quality === 'high' ? 15 : 8,
        });

      case ProcessingStrategy.TILED:
        return TiledProcessor.resizeInTiles(img, targetWidth, targetHeight, {
          quality: opts.quality === 'fast' ? 'fast' : 'high',
          onProgress: progressCallback,
          enableMemoryMonitoring: true,
          maxConcurrency: opts.quality === 'fast' ? 4 : 2,
        });

      default:
        throw createImageError('FEATURE_NOT_SUPPORTED', new Error(`Unsupported processing strategy: ${strategy}`));
    }
  }

  /**
   * 직접 리사이징
   * @private
   */
  private static async directResize(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    quality: 'fast' | 'balanced' | 'high'
  ): Promise<HTMLCanvasElement> {
    return withManagedCanvas(targetWidth, targetHeight, (canvas, ctx) => {
      // 품질 설정
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
      return canvas;
    });
  }

  /**
   * 청크 기반 리사이징
   * @private
   */
  private static async chunkedResize(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    opts: HighResolutionOptions & { quality: 'fast' | 'balanced' | 'high' },
    progressCallback?: (current: number, total: number) => void
  ): Promise<HTMLCanvasElement> {
    const analysis = HighResolutionDetector.analyzeImage(img);
    const tileSize = Math.min(2048, analysis.recommendedChunkSize);

    return TiledProcessor.resizeInTiles(img, targetWidth, targetHeight, {
      tileSize,
      quality: opts.quality === 'fast' ? 'fast' : 'high',
      onProgress: progressCallback,
      maxConcurrency: 2,
    });
  }

  /**
   * 메모리 상황 확인 및 관리
   * @private
   */
  private static async checkAndManageMemory(opts: HighResolutionOptions, analysis: ImageAnalysis): Promise<void> {
    const memoryInfo = this.getEstimatedUsage();
    const availableMB = (memoryInfo.limit - memoryInfo.used) / (1024 * 1024);

    // 메모리 경고 발생
    if (opts.onMemoryWarning && availableMB < (opts.maxMemoryUsageMB || 256)) {
      opts.onMemoryWarning({
        usageRatio: memoryInfo.used / memoryInfo.limit,
        availableMB: Math.round(availableMB),
      });
    }

    // 메모리 부족 시 가비지 컬렉션 유도
    if (this.isMemoryLow()) {
      if (typeof global !== 'undefined' && global.gc) {
        global.gc();
      }
    }
  }

  /**
   * 후처리 및 최적화
   * @private
   */
  private static async postProcess(canvas: HTMLCanvasElement, opts: HighResolutionOptions): Promise<HTMLCanvasElement> {
    // 품질에 따른 후처리
    if (opts.quality === 'high') {
      // 고품질 모드에서는 추가 최적화 없음
      return canvas;
    }

    // 필요시 추가 최적화 로직 구현 가능
    return canvas;
  }

  /**
   * 진행 상황 추적기 생성
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
          currentStrategy: ProcessingStrategy.DIRECT, // 실제 전략으로 업데이트 필요
          timeElapsed: Math.round(timeElapsed * 10) / 10,
          estimatedTimeRemaining: Math.round(estimatedRemaining * 10) / 10,
          memoryUsageMB: HighResolutionManager.getCurrentMemoryUsage(),
          details,
        });
      },
    };
  }

  /**
   * 현재 메모리 사용량 반환 (MB)
   * @private
   */
  private static getCurrentMemoryUsage(): number {
    const usage = this.getEstimatedUsage();
    return Math.round((usage.used / (1024 * 1024)) * 100) / 100;
  }

  /**
   * 처리 가능 여부 사전 검사
   *
   * @param img - 검사할 이미지
   * @param targetWidth - 목표 너비
   * @param targetHeight - 목표 높이
   * @param options - 처리 옵션
   * @returns 검사 결과
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
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const analysis = HighResolutionDetector.analyzeImage(img);
    const warnings: string[] = [];

    // 기본 검사
    const validation = HighResolutionDetector.validateProcessingCapability(img);
    warnings.push(...validation.limitations);

    // 메모리 검사
    if (analysis.estimatedMemoryMB > opts.maxMemoryUsageMB) {
      warnings.push(
        `예상 메모리 사용량이 제한을 초과합니다: ${analysis.estimatedMemoryMB}MB > ${opts.maxMemoryUsageMB}MB`
      );
    }

    // 타겟 크기 검사
    const targetPixels = targetWidth * targetHeight;
    const maxSafePixels = analysis.maxSafeDimension * analysis.maxSafeDimension;
    if (targetPixels > maxSafePixels) {
      warnings.push('목표 이미지 크기가 브라우저 한계를 초과할 수 있습니다.');
    }

    // 권장 전략 결정
    const recommendedStrategy = this.selectOptimalStrategy(analysis, opts as any, img, targetWidth, targetHeight);

    // 예상 처리 시간 계산
    const timeEstimate = HighResolutionDetector.estimateProcessingTime(analysis);
    let estimatedTime = timeEstimate.estimatedSeconds;

    // 전략에 따른 시간 조정
    switch (recommendedStrategy) {
      case ProcessingStrategy.STEPPED:
        estimatedTime *= 1.5;
        break;
      case ProcessingStrategy.TILED:
        estimatedTime *= 2.0;
        break;
    }

    return {
      canProcess: validation.canProcess,
      analysis,
      recommendedStrategy,
      warnings,
      estimatedTime: Math.round(estimatedTime * 10) / 10,
    };
  }

  /**
   * 배치 이미지 처리
   *
   * @param images - 처리할 이미지 배열
   * @param targetWidth - 목표 너비
   * @param targetHeight - 목표 높이
   * @param options - 처리 옵션
   * @returns 처리 결과 배열
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

    // 이미지를 청크로 나누어 병렬 처리
    const chunks: HTMLImageElement[][] = [];
    for (let i = 0; i < images.length; i += concurrency) {
      chunks.push(images.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (img, chunkIndex) => {
        const globalIndex = chunks.indexOf(chunk) * concurrency + chunkIndex;

        try {
          const result = await this.smartResize(img, targetWidth, targetHeight, processingOptions);

          results[globalIndex] = result;
          completed++;
          onBatchProgress?.(completed, images.length);

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
   * 간단한 메모리 부족 체크
   * @private
   */
  private static isMemoryLow(): boolean {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      return usageRatio > 0.8;
    }
    return false;
  }

  /**
   * 메모리 사용량 추정
   * @private
   */
  private static getEstimatedUsage(): { used: number; limit: number } {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        limit: memory.jsHeapSizeLimit,
      };
    }

    // 기본값 (추정치)
    return {
      used: 64 * 1024 * 1024, // 64MB
      limit: 512 * 1024 * 1024, // 512MB
    };
  }
}
