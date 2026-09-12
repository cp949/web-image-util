/**
 * 고해상도 이미지 처리 통합 모듈.
 *
 * 이전에는 HighResolutionDetector(분석) + HighResolutionManager(전략 선택·실행) +
 * AutoHighResProcessor(라우팅·표준 경로) 3개 클래스가 "이미지 하나에 어떤 전략을 쓸지
 * 정하고 실행한다"는 같은 개념을 각자 다른 어휘(quality/priority)로 반복 정의했다.
 * 정합성 버그가 반복 수정됐던 이력은 _works/high-res-processor/decisions.md 참고.
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
  /** 이 이상이면 TILED로 자동 전환(기본 300MB) */
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
  analysis: ImageAnalysis;
  /** 실제 적용된 값(입력 생략 시 'balanced') */
  priority: HighResolutionPriority;
  /** 실제 실행된 전략(direct/stepped/tiled) */
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

    onProgress?.(10, 'Analyzing image...');

    if (analysis.estimatedMemoryMB > thresholds.memoryWarningThreshold) {
      onMemoryWarning?.(
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
          onMemoryWarning,
        });
      } catch (error) {
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
      processingTime: Math.round(((Date.now() - startTime) / 1000) * 100) / 100,
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
      const scaleRatio = Math.min(targetWidth / img.width, targetHeight / img.height);
      return selectHighQualityStrategy(
        analysis.estimatedMemoryMB,
        analysis.width,
        analysis.height,
        analysis.maxSafeDimension,
        scaleRatio,
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
      processingTime: Math.round(((Date.now() - startTime) / 1000) * 100) / 100,
      memoryPeakUsageMB: 0,
    };
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
}
