/**
 * 고해상도 이미지 처리 통합 모듈.
 *
 * 이전에는 HighResolutionDetector(분석) + HighResolutionManager(전략 선택·실행) +
 * AutoHighResProcessor(라우팅·표준 경로) 3개 클래스가 "이미지 하나에 어떤 전략을 쓸지
 * 정하고 실행한다"는 같은 개념을 각자 다른 어휘(quality/priority)로 반복 정의했다.
 * 자세한 배경은 CHANGELOG.md의 이 변경 항목 참고.
 */

import { CanvasPool } from '../base/canvas-pool.internal';
import type { SmoothingQuality } from '../base/canvas-utils.internal';
import { createImageError } from '../base/error-helpers';
import type { ImageAnalysis } from '../base/high-res-detector.internal';
import { HighResolutionDetector } from '../base/high-res-detector.internal';
import { getResizeStrategyAdapter } from '../base/resize-strategy.internal';
import {
  exceedsMaxSafeDimension,
  ProcessingStrategy,
  selectFastStrategy,
  selectHighQualityStrategy,
  selectMemoryEfficientStrategy,
} from '../base/strategy-policy.internal';
import { ImageProcessError } from '../errors.internal';
import { readMemoryBudget, requestMemoryRelief } from '../utils/browser-capabilities/index';
import { processInChunks } from '../utils/chunked-batch-runner.internal';
import { productionLog } from '../utils/debug.internal';

export type { ImageAnalysis };
export { ProcessingStrategy };

export type HighResolutionPriority = 'fast' | 'balanced' | 'quality';

export interface HighResolutionThresholds {
  /** 고해상도 경로로 진입시키는 픽셀 수 기준(기본 8MP) */
  highResPixelThreshold: number;
  /** 이 이상 예상 메모리 사용 시 onMemoryWarning + validate() 경고(기본 200MB) */
  memoryWarningThreshold: number;
  /** 고해상도 경로 실행 중 가용 메모리 부족 경고 기준(기본 300MB, priority:'quality'는 ×1.5) — TILED 전환 여부와는 무관하다 */
  autoTileThreshold: number;
  /** validate()의 처리시간 경고 기준(기본 10초) */
  timeWarningThreshold: number;
}

const DEFAULT_THRESHOLDS: HighResolutionThresholds = {
  highResPixelThreshold: HighResolutionDetector.DEFAULT_HIGH_RES_PIXEL_THRESHOLD,
  memoryWarningThreshold: 200,
  autoTileThreshold: 300,
  timeWarningThreshold: 10,
};

export interface HighResolutionProcessOptions {
  /** 기본 'balanced' */
  priority?: HighResolutionPriority;
  /** priority 무시하고 특정 전략 강제(escape hatch) */
  forceStrategy?: ProcessingStrategy;
  /** 0~100 진행도 */
  onProgress?: (progress: number, message: string) => void;
  onMemoryWarning?: (message: string) => void;
  thresholds?: Partial<HighResolutionThresholds>;
}

export interface HighResolutionProcessResult {
  canvas: HTMLCanvasElement;
  /**
   * `analysis.strategy`는 `analyzeImage()`가 이미지 하나만 보고 계산한 balanced 기준
   * 추정치다. 실제 실행된 전략은 이 값이 아니라 `strategy` 필드를 봐야 한다 —
   * 고해상도 경로 미만(표준 경로)에서는 캔버스 크기 한계 초과 여부만으로 direct/tiled를
   * 다시 정하므로, 메모리 추정치가 16~64MB 구간인 이미지는 `analysis.strategy`가
   * 'tiled'여도 `strategy`는 'direct'일 수 있다.
   */
  analysis: ImageAnalysis;
  /** 실제 적용된 값(입력 생략 시 'balanced') */
  priority: HighResolutionPriority;
  /** 실제 실행된 전략(direct/stepped/tiled). `analysis.strategy`와 다를 수 있다 */
  strategy: ProcessingStrategy;
  processingTime: number;
  memoryPeakUsageMB: number;
  /** strategy === 'tiled' */
  memoryOptimized: boolean;
  estimatedTimeSaved: number;
  userMessage?: string;
}

export interface HighResolutionValidation {
  canProcess: boolean;
  warnings: string[];
  recommendations: string[];
  estimatedTime: number;
  /**
   * `analysis.strategy` 기준의 balanced 추정치다. `resize()`가 실제 실행 시 반영하는
   * priority/isMemoryLow 분기를 반영하지 않는다 — 실제 선택 전략과 다를 수 있다.
   */
  recommendedStrategy: ProcessingStrategy;
  analysis: ImageAnalysis;
}

export type HighResolutionBatchItem =
  | HTMLImageElement
  | { img: HTMLImageElement; width?: number; height?: number; name?: string };

export interface HighResolutionBatchOptions extends Omit<HighResolutionProcessOptions, 'onProgress'> {
  /** 기본 2 */
  concurrency?: number;
  onProgress?: (completed: number, total: number, currentItemName?: string) => void;
  onItemComplete?: (index: number, result: HighResolutionProcessResult) => void;
}

interface RunResult {
  canvas: HTMLCanvasElement;
  strategy: ProcessingStrategy;
  processingTime: number;
  memoryPeakUsageMB: number;
}

export class HighResolutionProcessor {
  static async resize(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    options: HighResolutionProcessOptions = {}
  ): Promise<HighResolutionProcessResult> {
    const { priority = 'balanced', forceStrategy, onProgress, onMemoryWarning, thresholds: customThresholds } = options;
    const thresholds = { ...DEFAULT_THRESHOLDS, ...customThresholds };

    const analysis = HighResolutionDetector.analyzeImage(img);
    const smoothingQuality = HighResolutionProcessor.toSmoothingQuality(priority);
    const scaleRatio = Math.max(img.width / targetWidth, img.height / targetHeight);
    const shouldUseHighResPath = HighResolutionDetector.shouldUseHighResolutionPath(
      analysis.totalPixels,
      scaleRatio,
      thresholds.highResPixelThreshold
    );

    // 이 호출 동안 최대 한 번만 발화시킨다 — 아래 두 지점(정적 크기 추정치, 고해상도 경로
    // 진입 후 실시간 가용 메모리)이 같은 이미지에 대해 동시에 조건을 만족할 수 있어,
    // 감싸지 않으면 resize() 한 번에 onMemoryWarning이 두 번 호출될 수 있다.
    let memoryWarningFired = false;
    const fireMemoryWarningOnce = onMemoryWarning
      ? (message: string) => {
          if (memoryWarningFired) return;
          memoryWarningFired = true;
          onMemoryWarning(message);
        }
      : undefined;

    onProgress?.(10, 'Analyzing image...');

    if (analysis.estimatedMemoryMB > thresholds.memoryWarningThreshold) {
      fireMemoryWarningOnce?.(
        `Memory usage may increase up to ${Math.round(analysis.estimatedMemoryMB)}MB due to large image processing.`
      );
    }

    onProgress?.(20, `Optimization strategy: ${HighResolutionProcessor.describePriority(priority)}`);

    let processingResult: RunResult;
    if (shouldUseHighResPath || forceStrategy) {
      try {
        processingResult = await HighResolutionProcessor.runHighResPath(img, targetWidth, targetHeight, analysis, {
          smoothingQuality,
          forceStrategy,
          maxMemoryUsageMB: HighResolutionProcessor.maxMemoryFor(priority, thresholds),
          onProgress,
          onMemoryWarning: fireMemoryWarningOnce,
        });
      } catch (error) {
        if (error instanceof ImageProcessError && error.code === 'FEATURE_NOT_SUPPORTED') {
          throw error;
        }
        productionLog.warn('High-resolution processing failed, switching to standard processing:', error);
        onProgress?.(50, 'Changing processing method...');
        processingResult = await HighResolutionProcessor.runStandardPath(
          img,
          targetWidth,
          targetHeight,
          'balanced',
          analysis
        );
      }
    } else {
      processingResult = await HighResolutionProcessor.runStandardPath(
        img,
        targetWidth,
        targetHeight,
        smoothingQuality,
        analysis
      );
    }

    onProgress?.(100, 'Processing complete');

    const memoryOptimized = processingResult.strategy === ProcessingStrategy.TILED;

    const result: HighResolutionProcessResult = {
      canvas: processingResult.canvas,
      analysis,
      priority,
      strategy: processingResult.strategy,
      processingTime: processingResult.processingTime,
      memoryPeakUsageMB: processingResult.memoryPeakUsageMB,
      memoryOptimized,
      estimatedTimeSaved: HighResolutionProcessor.calculateTimeSaved(analysis, memoryOptimized),
    };

    if (shouldUseHighResPath && memoryOptimized) {
      result.userMessage = `High-resolution image processed memory-efficiently. (${HighResolutionProcessor.describePriority(priority)} applied)`;
    }

    return result;
  }

  static async batchResize(
    items: HighResolutionBatchItem[],
    targetWidth: number,
    targetHeight: number,
    options: HighResolutionBatchOptions = {}
  ): Promise<HighResolutionProcessResult[]> {
    const { concurrency = 2, onProgress, onItemComplete, ...resizeOptions } = options;
    const normalized = items.map((item) => HighResolutionProcessor.normalizeBatchItem(item, targetWidth, targetHeight));
    let completed = 0;

    return processInChunks(
      normalized,
      concurrency,
      async ({ img, width, height, name }, index) => {
        try {
          return await HighResolutionProcessor.resize(img, width, height, resizeOptions);
        } catch (error) {
          productionLog.error(`Image processing failed (${name || index}):`, error);
          throw createImageError('RESIZE_FAILED', {
            cause: error,
            context: { debug: { stage: 'Batch processing', index } },
          });
        }
      },
      {
        onItemComplete: (index, result) => {
          completed++;
          onProgress?.(completed, items.length, normalized[index].name);
          onItemComplete?.(index, result);
        },
      }
    );
  }

  static validate(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    options: { thresholds?: Partial<HighResolutionThresholds> } = {}
  ): HighResolutionValidation {
    const thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };

    // 캔버스 한계·512MB 초과·extreme 복잡도·전면 차단(canProcess) 4개 검사는
    // HighResolutionDetector.validateProcessingCapability()가 단일 소유한다 — 여기서 재계산하지 않는다.
    const {
      canProcess,
      analysis,
      limitations,
      recommendations: capabilityRecommendations,
    } = HighResolutionDetector.validateProcessingCapability(img);

    const warnings: string[] = [...limitations];
    const recommendations: string[] = [...capabilityRecommendations];

    if (analysis.estimatedMemoryMB > thresholds.memoryWarningThreshold) {
      warnings.push(
        `Expected memory usage exceeds limit: ${analysis.estimatedMemoryMB}MB > ${thresholds.memoryWarningThreshold}MB`
      );
      recommendations.push('To reduce memory usage, resize to a smaller size.');
    }

    const targetPixels = targetWidth * targetHeight;
    const maxSafePixels = analysis.maxSafeDimension * analysis.maxSafeDimension;
    if (targetPixels > maxSafePixels) {
      warnings.push('Target image size may exceed browser limits.');
    }

    const recommendedStrategy = analysis.strategy;

    const timeEstimate = HighResolutionDetector.estimateProcessingTime(analysis);
    const timeMultiplier = getResizeStrategyAdapter(recommendedStrategy)?.getTimeMultiplier(analysis) ?? 1;
    const estimatedTime = Math.round(timeEstimate.estimatedSeconds * timeMultiplier * 10) / 10;

    if (estimatedTime > thresholds.timeWarningThreshold) {
      warnings.push(`Long processing time expected: ${Math.round(estimatedTime)} seconds`);
      recommendations.push('For faster processing, set priority to "fast".');
    }
    if (analysis.totalPixels > thresholds.highResPixelThreshold) {
      recommendations.push('This is a high-resolution image. Automatic optimization will be applied.');
    }

    return { canProcess, warnings, recommendations, estimatedTime, recommendedStrategy, analysis };
  }

  private static async runHighResPath(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    analysis: ImageAnalysis,
    opts: {
      smoothingQuality: SmoothingQuality;
      forceStrategy?: ProcessingStrategy;
      maxMemoryUsageMB: number;
      onProgress?: (progress: number, message: string) => void;
      onMemoryWarning?: (message: string) => void;
    }
  ): Promise<RunResult> {
    const startTime = Date.now();

    const strategy = HighResolutionProcessor.selectOptimalStrategy(
      analysis,
      opts.smoothingQuality,
      opts.forceStrategy,
      img,
      targetWidth,
      targetHeight
    );
    opts.onProgress?.(30, `Strategy selected: ${strategy}`);

    await HighResolutionProcessor.checkAndManageMemory(opts.maxMemoryUsageMB, opts.onMemoryWarning);

    const progressCallback = opts.onProgress
      ? (current: number, total: number) => {
          opts.onProgress?.(30 + (current / total) * 60, `Processing ${current}/${total}...`);
        }
      : undefined;

    const canvas = await HighResolutionProcessor.executeProcessing(
      img,
      targetWidth,
      targetHeight,
      strategy,
      opts.smoothingQuality,
      analysis,
      progressCallback
    );

    return {
      canvas,
      strategy,
      processingTime: HighResolutionProcessor.elapsedSeconds(startTime),
      memoryPeakUsageMB: Math.round(HighResolutionProcessor.getCurrentMemoryUsage() * 100) / 100,
    };
  }

  private static selectOptimalStrategy(
    analysis: ImageAnalysis,
    smoothingQuality: SmoothingQuality,
    forceStrategy: ProcessingStrategy | undefined,
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number
  ): ProcessingStrategy {
    if (forceStrategy) return forceStrategy;

    if (HighResolutionProcessor.isMemoryLow()) {
      productionLog.warn('Low memory detected, selecting memory-efficient strategy');
      return selectMemoryEfficientStrategy(
        analysis.estimatedMemoryMB,
        analysis.width,
        analysis.height,
        analysis.maxSafeDimension
      );
    }

    if (smoothingQuality === 'fast') {
      return selectFastStrategy(analysis.estimatedMemoryMB, analysis.width, analysis.height, analysis.maxSafeDimension);
    }
    if (smoothingQuality === 'high') {
      // resize() 상단의 scaleRatio(축소 배율, src/target 중 큰 값)와는 다른 값이다 —
      // 여기는 target/src 중 작은 값(축소일수록 0에 가까움)으로, stepped 선택 기준인
      // HIGH_QUALITY_STEPPED_SCALE_RATIO와 직접 비교하기 위한 형태다.
      const fitScaleRatio = Math.min(targetWidth / img.width, targetHeight / img.height);
      return selectHighQualityStrategy(
        analysis.estimatedMemoryMB,
        analysis.width,
        analysis.height,
        analysis.maxSafeDimension,
        fitScaleRatio,
        analysis.strategy
      );
    }
    return analysis.strategy;
  }

  private static async checkAndManageMemory(
    maxMemoryUsageMB: number,
    onMemoryWarning?: (message: string) => void
  ): Promise<void> {
    const budget = readMemoryBudget();

    if (onMemoryWarning && budget.availableMB < maxMemoryUsageMB) {
      onMemoryWarning(
        `Available memory is low: ${Math.round(budget.availableMB)}MB remaining (${Math.round(budget.pressure * 100)}% used).`
      );
    }

    if (HighResolutionProcessor.isMemoryLow()) {
      CanvasPool.getInstance().clear();
      requestMemoryRelief();
    }
  }

  private static isMemoryLow(): boolean {
    return readMemoryBudget().pressure > 0.8;
  }

  private static getCurrentMemoryUsage(): number {
    return readMemoryBudget().usedMB;
  }

  private static maxMemoryFor(priority: HighResolutionPriority, thresholds: HighResolutionThresholds): number {
    return priority === 'quality' ? thresholds.autoTileThreshold * 1.5 : thresholds.autoTileThreshold;
  }

  /**
   * 표준 경로(고해상도가 아닌 경우, 또는 고해상도 경로 실행 실패 후 폴백) 처리.
   *
   * shouldUseHighResolutionPath()가 false를 반환한 이미지, 그리고 runHighResPath()가
   * 실패해 폴백한 이미지 둘 다 여기로 온다 — 어느 쪽이든 runHighResPath() 안의
   * strategy-policy 가드(exceedsMaxSafeDimension)는 여기까지 닿지 않는다. 저픽셀이면서
   * 가로/세로 한 축만 매우 큰 이미지(파노라마 등)가 이 경로로 들어올 수 있으므로,
   * DIRECT로 넘기기 전에 같은 가드를 여기서도 직접 통과시킨다.
   */
  private static async runStandardPath(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    smoothingQuality: SmoothingQuality,
    analysis: ImageAnalysis
  ): Promise<RunResult> {
    const startTime = Date.now();
    const strategy = exceedsMaxSafeDimension(analysis.width, analysis.height, analysis.maxSafeDimension)
      ? ProcessingStrategy.TILED
      : ProcessingStrategy.DIRECT;

    const canvas = await HighResolutionProcessor.executeProcessing(
      img,
      targetWidth,
      targetHeight,
      strategy,
      smoothingQuality,
      analysis
    );

    return {
      canvas,
      strategy,
      processingTime: HighResolutionProcessor.elapsedSeconds(startTime),
      memoryPeakUsageMB: 0,
    };
  }

  /** startTime(Date.now() 시점) 대비 경과 시간을 소수점 둘째 자리까지의 초 단위로 반환한다 */
  private static elapsedSeconds(startTime: number): number {
    return Math.round(((Date.now() - startTime) / 1000) * 100) / 100;
  }

  private static async executeProcessing(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    strategy: ProcessingStrategy,
    smoothingQuality: SmoothingQuality,
    analysis: ImageAnalysis,
    onProgress?: (current: number, total: number) => void
  ): Promise<HTMLCanvasElement> {
    const adapter = getResizeStrategyAdapter(strategy);
    if (!adapter) {
      throw createImageError('FEATURE_NOT_SUPPORTED', {
        cause: new Error(`Unsupported processing strategy: ${strategy}`),
      });
    }

    try {
      return await adapter.execute({ img, targetWidth, targetHeight, quality: smoothingQuality, analysis, onProgress });
    } catch (error) {
      if (error instanceof ImageProcessError) throw error;
      throw createImageError('RESIZE_FAILED', {
        cause: error,
        context: { debug: { stage: 'High-resolution processing' } },
      });
    }
  }

  private static calculateTimeSaved(analysis: ImageAnalysis, memoryOptimized: boolean): number {
    // 옛 코드는 memoryOptimized/tileProcessing 두 플래그를 따로 뒀지만 값이 항상 같았다
    // (tileProcessing = memoryOptimized = strategy === TILED) — 하나로 정리한다.
    const baseTime = analysis.totalPixels / 1_000_000;
    const timeSaved = memoryOptimized ? baseTime * 0.5 : 0;
    return Math.round(timeSaved * 10) / 10;
  }

  private static describePriority(priority: HighResolutionPriority): string {
    if (priority === 'fast') return 'High-speed Processing';
    if (priority === 'quality') return 'High-quality Processing';
    return 'Balanced Optimization';
  }

  private static toSmoothingQuality(priority: HighResolutionPriority): SmoothingQuality {
    if (priority === 'fast') return 'fast';
    if (priority === 'quality') return 'high';
    return 'balanced';
  }

  private static normalizeBatchItem(
    item: HighResolutionBatchItem,
    targetWidth: number,
    targetHeight: number
  ): { img: HTMLImageElement; width: number; height: number; name?: string } {
    if (item && typeof item === 'object' && 'img' in item) {
      return {
        img: item.img,
        width: item.width ?? targetWidth,
        height: item.height ?? targetHeight,
        name: item.name,
      };
    }
    return { img: item as HTMLImageElement, width: targetWidth, height: targetHeight };
  }
}
