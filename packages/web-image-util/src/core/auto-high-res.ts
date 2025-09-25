/**
 * 자동 고해상도 이미지 처리 시스템
 * 기존의 복잡한 고해상도 처리를 사용자에게 투명하게 제공
 */

import type { HighResolutionOptions, ProcessingResult } from '../base/high-res-manager';
import { HighResolutionManager } from '../base/high-res-manager';
import { HighResolutionDetector } from '../base/high-res-detector';

/**
 * 자동 처리 임계값
 */
interface AutoProcessingThresholds {
  /** 4K 이상 이미지로 간주하는 픽셀 수 (기본: 8MP) */
  highResPixelThreshold: number;

  /** 메모리 사용량 경고 임계값 (MB) */
  memoryWarningThreshold: number;

  /** 자동 타일링 적용 임계값 (MB) */
  autoTileThreshold: number;

  /** 처리 시간 경고 임계값 (초) */
  timeWarningThreshold: number;
}

/**
 * 자동 처리 결과
 */
export interface AutoProcessingResult {
  /** 처리된 캔버스 */
  canvas: HTMLCanvasElement;

  /** 자동으로 적용된 최적화 정보 */
  optimizations: {
    strategy: string;
    memoryOptimized: boolean;
    tileProcessing: boolean;
    estimatedTimeSaved: number; // 초
  };

  /** 처리 통계 */
  stats: {
    originalSize: { width: number; height: number };
    finalSize: { width: number; height: number };
    processingTime: number;
    memoryPeakUsage: number;
    qualityLevel: 'fast' | 'balanced' | 'high';
  };

  /** 사용자에게 표시할 메시지 (선택적) */
  userMessage?: string;
}

/**
 * 자동 고해상도 처리 클래스
 */
export class AutoHighResProcessor {
  private static defaultThresholds: AutoProcessingThresholds = {
    highResPixelThreshold: 8_000_000, // 8MP (약 4K)
    memoryWarningThreshold: 200, // 200MB
    autoTileThreshold: 300, // 300MB
    timeWarningThreshold: 10, // 10초
  };

  /**
   * 자동 최적화된 이미지 리사이징
   * 사용자는 복잡한 설정 없이 간단하게 호출 가능
   *
   * @param img - 소스 이미지
   * @param targetWidth - 목표 너비
   * @param targetHeight - 목표 높이
   * @param options - 선택적 옵션
   * @returns 최적화된 처리 결과
   */
  static async smartResize(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    options: {
      /** 품질 우선순위: 'speed' (빠름), 'balanced' (기본), 'quality' (품질) */
      priority?: 'speed' | 'balanced' | 'quality';

      /** 진행률 콜백 */
      onProgress?: (progress: number, message: string) => void;

      /** 메모리 경고 콜백 */
      onMemoryWarning?: (message: string) => void;

      /** 커스텀 임계값 */
      thresholds?: Partial<AutoProcessingThresholds>;
    } = {}
  ): Promise<AutoProcessingResult> {
    const { priority = 'balanced', onProgress, onMemoryWarning, thresholds: customThresholds } = options;

    // 임계값 설정
    const thresholds = { ...this.defaultThresholds, ...customThresholds };

    // 이미지 분석
    const analysis = HighResolutionDetector.analyzeImage(img);
    const isHighRes = analysis.totalPixels > thresholds.highResPixelThreshold;

    onProgress?.(10, '이미지 분석 중...');

    // 자동 최적화 전략 결정
    const strategy = this.determineOptimalStrategy(analysis, priority, thresholds);

    onProgress?.(20, `최적화 전략: ${strategy.name}`);

    // 메모리 경고 확인
    if (analysis.estimatedMemoryMB > thresholds.memoryWarningThreshold) {
      const warningMessage = `대용량 이미지 처리로 인해 메모리 사용량이 ${Math.round(analysis.estimatedMemoryMB)}MB까지 증가할 수 있습니다.`;
      onMemoryWarning?.(warningMessage);
    }

    // 고해상도 처리 옵션 구성
    const highResOptions: HighResolutionOptions = {
      quality: strategy.quality,
      forceStrategy: strategy.processingStrategy,
      maxMemoryUsageMB: strategy.maxMemory,
      enableProgressTracking: !!onProgress,
      onProgress: onProgress
        ? (progress) => {
            onProgress(20 + progress.progress * 0.6, progress.details || '처리 중...');
          }
        : undefined,
    };

    // 실제 처리 수행
    let processingResult: ProcessingResult;
    try {
      if (isHighRes) {
        processingResult = await HighResolutionManager.smartResize(img, targetWidth, targetHeight, highResOptions);
      } else {
        // 일반 해상도는 직접 처리
        processingResult = await this.standardResize(img, targetWidth, targetHeight, strategy.quality);
      }
    } catch (error) {
      // 실패 시 fallback 처리
      console.warn('고해상도 처리 실패, 표준 처리로 전환:', error);
      onProgress?.(50, '처리 방식을 변경 중...');
      processingResult = await this.standardResize(img, targetWidth, targetHeight, 'balanced');
    }

    onProgress?.(100, '처리 완료');

    // 결과 구성
    const autoResult: AutoProcessingResult = {
      canvas: processingResult.canvas,
      optimizations: {
        strategy: strategy.name,
        memoryOptimized: strategy.memoryOptimized,
        tileProcessing: strategy.tileProcessing,
        estimatedTimeSaved: this.calculateTimeSaved(analysis, strategy),
      },
      stats: {
        originalSize: { width: img.width, height: img.height },
        finalSize: { width: targetWidth, height: targetHeight },
        processingTime: processingResult.processingTime,
        memoryPeakUsage: processingResult.memoryPeakUsageMB,
        qualityLevel: processingResult.quality,
      },
    };

    // 사용자 메시지 생성
    if (isHighRes && strategy.memoryOptimized) {
      autoResult.userMessage = `고해상도 이미지가 메모리 효율적으로 처리되었습니다. (${strategy.name} 적용)`;
    }

    return autoResult;
  }

  /**
   * 이미지 처리 전 사전 검증
   * 처리 가능 여부와 예상 리소스 사용량을 미리 확인
   */
  static validateProcessing(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    options: { thresholds?: Partial<AutoProcessingThresholds> } = {}
  ): {
    canProcess: boolean;
    warnings: string[];
    recommendations: string[];
    estimatedTime: number;
    estimatedMemory: number;
    suggestedStrategy: string;
  } {
    const thresholds = { ...this.defaultThresholds, ...options.thresholds };

    // 기본 유효성 검사
    const validation = HighResolutionManager.validateProcessingCapability(img, targetWidth, targetHeight);
    const analysis = HighResolutionDetector.analyzeImage(img);
    const strategy = this.determineOptimalStrategy(analysis, 'balanced', thresholds);

    const warnings: string[] = [...validation.warnings];
    const recommendations: string[] = [];

    // 메모리 경고
    if (analysis.estimatedMemoryMB > thresholds.memoryWarningThreshold) {
      warnings.push(`높은 메모리 사용량 예상: ${Math.round(analysis.estimatedMemoryMB)}MB`);
      recommendations.push('메모리 사용량을 줄이려면 더 작은 크기로 리사이징하세요.');
    }

    // 처리 시간 경고
    if (validation.estimatedTime > thresholds.timeWarningThreshold) {
      warnings.push(`긴 처리 시간 예상: ${Math.round(validation.estimatedTime)}초`);
      recommendations.push('빠른 처리를 위해 priority를 "speed"로 설정하세요.');
    }

    // 권장사항
    if (analysis.totalPixels > thresholds.highResPixelThreshold) {
      recommendations.push('고해상도 이미지입니다. 자동 최적화가 적용됩니다.');
    }

    return {
      canProcess: validation.canProcess,
      warnings,
      recommendations,
      estimatedTime: validation.estimatedTime,
      estimatedMemory: analysis.estimatedMemoryMB,
      suggestedStrategy: strategy.name,
    };
  }

  /**
   * 배치 처리 - 여러 이미지를 효율적으로 처리
   */
  static async batchSmartResize(
    images: { img: HTMLImageElement; targetWidth: number; targetHeight: number; name?: string }[],
    options: {
      priority?: 'speed' | 'balanced' | 'quality';
      concurrency?: number; // 동시 처리할 이미지 수
      onProgress?: (completed: number, total: number, currentImage?: string) => void;
      onImageComplete?: (index: number, result: AutoProcessingResult) => void;
    } = {}
  ): Promise<AutoProcessingResult[]> {
    const { priority = 'balanced', concurrency = 2, onProgress, onImageComplete } = options;

    const results: AutoProcessingResult[] = new Array(images.length);
    let completed = 0;

    // 청크로 나누어 병렬 처리
    const chunks: (typeof images)[] = [];
    for (let i = 0; i < images.length; i += concurrency) {
      chunks.push(images.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (imageItem, chunkIndex) => {
        const globalIndex = chunks.indexOf(chunk) * concurrency + chunkIndex;
        const { img, targetWidth, targetHeight, name } = imageItem;

        try {
          const result = await this.smartResize(img, targetWidth, targetHeight, {
            priority,
            onProgress: (progress, message) => {
              // 개별 이미지 진행률은 전체에 반영하지 않음 (너무 복잡)
            },
          });

          results[globalIndex] = result;
          completed++;

          onProgress?.(completed, images.length, name);
          onImageComplete?.(globalIndex, result);

          return result;
        } catch (error) {
          console.error(`이미지 처리 실패 (${name || globalIndex}):`, error);
          throw error;
        }
      });

      await Promise.all(chunkPromises);
    }

    return results;
  }

  /**
   * 최적 전략 결정 (내부 메서드)
   */
  private static determineOptimalStrategy(
    analysis: any,
    priority: 'speed' | 'balanced' | 'quality',
    thresholds: AutoProcessingThresholds
  ) {
    const isHighMem = analysis.estimatedMemoryMB > thresholds.autoTileThreshold;

    // 우선순위별 전략 결정
    switch (priority) {
      case 'speed':
        return {
          name: '고속 처리',
          quality: 'fast' as const,
          processingStrategy: isHighMem ? analysis.strategy : undefined,
          memoryOptimized: isHighMem,
          tileProcessing: isHighMem,
          maxMemory: thresholds.autoTileThreshold,
        };

      case 'quality':
        return {
          name: '고품질 처리',
          quality: 'high' as const,
          processingStrategy: analysis.strategy,
          memoryOptimized: true,
          tileProcessing: isHighMem,
          maxMemory: thresholds.autoTileThreshold * 1.5,
        };

      default: // balanced
        return {
          name: '균형 최적화',
          quality: 'balanced' as const,
          processingStrategy: analysis.strategy,
          memoryOptimized: isHighMem,
          tileProcessing: isHighMem,
          maxMemory: thresholds.autoTileThreshold,
        };
    }
  }

  /**
   * 표준 리사이징 (고해상도가 아닌 경우)
   */
  private static async standardResize(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    quality: 'fast' | 'balanced' | 'high'
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d')!;

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

    const processingTime = (Date.now() - startTime) / 1000;

    return {
      canvas,
      analysis: HighResolutionDetector.analyzeImage(img),
      strategy: 'direct' as any,
      processingTime,
      memoryPeakUsageMB: 0,
      quality,
    };
  }

  /**
   * 시간 절약 계산 (추정)
   */
  private static calculateTimeSaved(analysis: any, strategy: any): number {
    // 단순한 추정 로직
    const baseTime = analysis.totalPixels / 1_000_000; // 메가픽셀당 1초 기준

    let timeSaved = 0;
    if (strategy.memoryOptimized) {
      timeSaved += baseTime * 0.3; // 30% 시간 절약
    }
    if (strategy.tileProcessing) {
      timeSaved += baseTime * 0.2; // 20% 추가 절약
    }

    return Math.round(timeSaved * 10) / 10;
  }
}

/**
 * 편의 함수들
 */

/**
 * 가장 간단한 고해상도 리사이징
 * 모든 최적화가 자동으로 적용됨
 */
export async function smartResize(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number
): Promise<HTMLCanvasElement> {
  const result = await AutoHighResProcessor.smartResize(img, targetWidth, targetHeight);
  return result.canvas;
}

/**
 * 진행률과 함께 고해상도 리사이징
 */
export async function smartResizeWithProgress(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  onProgress: (progress: number, message: string) => void
): Promise<AutoProcessingResult> {
  return AutoHighResProcessor.smartResize(img, targetWidth, targetHeight, { onProgress });
}
