/**
 * 고해상도 이미지 처리 통합 모듈.
 *
 * 이전에는 HighResolutionDetector(분석) + HighResolutionManager(전략 선택·실행) +
 * AutoHighResProcessor(라우팅·표준 경로) 3개 클래스가 "이미지 하나에 어떤 전략을 쓸지
 * 정하고 실행한다"는 같은 개념을 각자 다른 어휘(quality/priority)로 반복 정의했다.
 * 정합성 버그가 반복 수정됐던 이력은 _works/high-res-processor/decisions.md 참고.
 */

import { CanvasPool } from '../base/canvas-pool.internal';
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
import type { SmoothingQuality } from '../base/canvas-utils.internal';
import { ImageProcessError } from '../errors.internal';
import { readMemoryBudget, requestMemoryRelief } from '../utils/browser-capabilities/index';
import { processInChunks } from '../utils/chunked-batch-runner.internal';
import { productionLog } from '../utils/debug.internal';

export { ProcessingStrategy };
export type { ImageAnalysis };

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

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    return {
      canvas,
      analysis,
      priority,
      strategy: ProcessingStrategy.DIRECT,
      processingTime: 0,
      memoryPeakUsageMB: 0,
      memoryOptimized: false,
      estimatedTimeSaved: 0,
    };
  }

  private static toSmoothingQuality(priority: HighResolutionPriority): SmoothingQuality {
    if (priority === 'fast') return 'fast';
    if (priority === 'quality') return 'high';
    return 'balanced';
  }
}
