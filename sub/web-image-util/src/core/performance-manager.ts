/**
 * 통합 성능 관리자
 * SVG 처리 전략 최적화 및 성능 예측 시스템
 *
 * @description Phase 3 Step 4: 브라우저 기능과 SVG 복잡도를 분석하여
 * 최적의 처리 전략을 자동 선택하고 성능을 예측하는 시스템
 */

import { BrowserCapabilityDetector } from '../utils/browser-capabilities';
import { OffscreenSVGProcessor } from '../advanced/offscreen-svg-processor';
import { SVGProcessor } from '../advanced/svg-processor';
import { SvgOptimizer } from '../utils/svg-optimizer';
import { analyzeSvgComplexity } from '../core/svg-complexity-analyzer';
import type { BrowserCapabilities } from '../utils/browser-capabilities';
import type { SvgProcessingOptions, SvgProcessingResult } from '../advanced/svg-processor';
import type { SvgOptimizationOptions } from '../utils/svg-optimizer';

// ============================================================================
// TYPES - 성능 관리 관련 타입 정의
// ============================================================================

/**
 * 처리 전략 정의
 */
export interface ProcessingStrategy {
  /** OffscreenCanvas 사용 여부 */
  useOffscreenCanvas: boolean;
  /** Web Worker 사용 여부 */
  useWebWorker: boolean;
  /** SVG 최적화 적용 여부 */
  optimizeSvg: boolean;
  /** 품질 레벨 */
  qualityLevel: 'low' | 'medium' | 'high' | 'ultra';
  /** 예상 성능 향상율 (백분율) */
  expectedPerformanceGain: number;
  /** 예상 처리 시간 (밀리초) */
  estimatedProcessingTimeMs: number;
  /** 예상 메모리 사용량 (MB) */
  estimatedMemoryUsageMB: number;
  /** 전략 선택 이유 */
  reason: string;
}

/**
 * 성능 분석 컨텍스트
 */
export interface PerformanceContext {
  /** SVG 문자열 길이 */
  svgSize: number;
  /** 목표 픽셀 수 */
  targetPixelCount: number;
  /** SVG 복잡도 점수 (0-1) */
  complexityScore: number;
  /** 브라우저 기능 */
  browserCapabilities: BrowserCapabilities;
  /** 시스템 성능 메트릭 */
  systemMetrics: SystemMetrics;
}

/**
 * 시스템 성능 메트릭
 */
export interface SystemMetrics {
  /** 사용 가능한 메모리 추정치 (MB) */
  availableMemoryMB: number;
  /** CPU 코어 수 추정치 */
  estimatedCores: number;
  /** 장치 픽셀 비율 */
  devicePixelRatio: number;
  /** 연결 상태 (추정) */
  connectionQuality: 'high' | 'medium' | 'low';
}

/**
 * 전략 캐시 엔트리
 */
interface StrategyCacheEntry {
  /** 전략 */
  strategy: ProcessingStrategy;
  /** 생성 시간 */
  createdAt: number;
  /** 사용 횟수 */
  useCount: number;
  /** 실제 성능 결과 */
  actualPerformance?: {
    processingTimeMs: number;
    memoryUsageMB: number;
    qualityScore: number;
  };
}

// ============================================================================
// PERFORMANCE MANAGER CLASS - 메인 성능 관리 클래스
// ============================================================================

/**
 * 통합 성능 관리자
 * SVG 처리 전략 최적화 및 성능 예측 시스템
 */
export class PerformanceManager {
  /** 브라우저 기능 감지기 인스턴스 */
  private static detector = BrowserCapabilityDetector.getInstance();

  /** 전략 캐시 (키: 컨텍스트 해시, 값: 전략) */
  private static strategies = new Map<string, StrategyCacheEntry>();

  /** 캐시 만료 시간 (30분) */
  private static readonly CACHE_EXPIRY_MS = 30 * 60 * 1000;

  /** 최대 캐시 크기 */
  private static readonly MAX_CACHE_SIZE = 100;

  /** 성능 임계값 */
  private static readonly PERFORMANCE_THRESHOLDS = {
    highComplexity: 0.7,    // 복잡도 70% 이상 = 고복잡도
    mediumComplexity: 0.4,  // 복잡도 40% 이상 = 중복잡도
    highLoad: 1000000,      // 100만 픽셀 이상 = 고부하
    mediumLoad: 400000,     // 40만 픽셀 이상 = 중부하
    maxMemoryMB: 500,       // 최대 메모리 사용량 500MB
    timeoutMs: 30000,       // 최대 처리 시간 30초
  } as const;

  /**
   * 최적 처리 전략 선택
   * 브라우저 기능과 SVG 특성을 분석하여 최적의 처리 전략 결정
   *
   * @param svgString SVG XML 문자열
   * @param targetWidth 목표 너비
   * @param targetHeight 목표 높이
   * @param options 추가 옵션
   * @returns 최적화된 처리 전략
   */
  static async selectOptimalStrategy(
    svgString: string,
    targetWidth: number,
    targetHeight: number,
    options: Partial<SvgProcessingOptions> = {}
  ): Promise<ProcessingStrategy> {
    try {
      // 1. 성능 분석 컨텍스트 생성
      const context = await this.createPerformanceContext(
        svgString,
        targetWidth,
        targetHeight
      );

      // 2. 캐시 확인
      const cacheKey = this.generateCacheKey(context, options);
      const cached = this.getCachedStrategy(cacheKey);
      if (cached) {
        cached.useCount++;
        return cached.strategy;
      }

      // 3. 새로운 전략 계산
      const strategy = this.computeOptimalStrategy(context, options);

      // 4. 캐시에 저장
      this.cacheStrategy(cacheKey, strategy);

      return strategy;

    } catch (error) {
      console.warn('성능 전략 선택 실패, 기본 전략 사용:', error);
      return this.getDefaultStrategy();
    }
  }

  /**
   * 최적 전략으로 SVG 처리 실행
   * 선택된 전략에 따라 실제 처리를 수행하고 성능 메트릭 수집
   *
   * @param svgString SVG XML 문자열
   * @param options 처리 옵션
   * @returns 처리 결과 및 성능 메트릭
   */
  static async processWithOptimalStrategy(
    svgString: string,
    options: SvgProcessingOptions
  ): Promise<SvgProcessingResult & { strategy: ProcessingStrategy }> {
    const startTime = performance.now();

    // Node.js 환경 체크 (가장 먼저) - 실제 브라우저 API 존재 여부 확인
    if (typeof process !== 'undefined' && process.versions?.node) {
      throw new Error('PerformanceManager는 브라우저 환경에서만 사용할 수 있습니다. Node.js 환경에서는 기본 processImage() API를 사용해주세요.');
    }

    try {
      // 1. 최적 전략 선택
      const strategy = await this.selectOptimalStrategy(
        svgString,
        options.targetWidth,
        options.targetHeight,
        options
      );

      // 2. SVG 최적화 (필요시)
      let processingSvg = svgString;
      if (strategy.optimizeSvg) {
        const optimizationResult = SvgOptimizer.optimize(
          processingSvg,
          this.getOptimizationOptions(strategy)
        );
        processingSvg = optimizationResult.optimizedSvg;
      }

      // 3. 처리 옵션 조정
      const processingOptions: SvgProcessingOptions = {
        ...options,
        quality: strategy.qualityLevel
      };

      // 4. 전략에 따른 실제 처리
      let result: SvgProcessingResult;

      if (strategy.useOffscreenCanvas && strategy.useWebWorker) {
        result = await OffscreenSVGProcessor.processWithOffscreenCanvas(
          processingSvg,
          processingOptions
        );
      } else {
        result = await SVGProcessor.processWithQuality(
          processingSvg,
          processingOptions
        );
      }

      // 5. 실제 성능 메트릭 기록
      const actualProcessingTime = performance.now() - startTime;
      this.recordActualPerformance(strategy, {
        processingTimeMs: actualProcessingTime,
        memoryUsageMB: result.memorySizeMB,
        qualityScore: this.estimateQualityScore(result)
      });

      return {
        ...result,
        strategy,
        processingTimeMs: actualProcessingTime
      };

    } catch (error) {
      console.warn('최적 전략 처리 실패, 표준 프로세서로 폴백:', error);

      // Node.js 환경 체크 - 실제 브라우저 API 존재 여부 확인
      if (typeof process !== 'undefined' && process.versions?.node) {
        throw new Error('Node.js 환경에서는 SVG 고급 처리가 지원되지 않습니다. 브라우저 환경에서 사용해주세요.');
      }

      // 폴백: 표준 프로세서 사용 (브라우저 환경에서만)
      const fallbackResult = await SVGProcessor.processWithQuality(svgString, options);
      return {
        ...fallbackResult,
        strategy: this.getDefaultStrategy(),
        processingTimeMs: performance.now() - startTime
      };
    }
  }

  // ============================================================================
  // PRIVATE METHODS - 내부 구현 메서드들
  // ============================================================================

  /**
   * 성능 분석 컨텍스트 생성
   */
  private static async createPerformanceContext(
    svgString: string,
    targetWidth: number,
    targetHeight: number
  ): Promise<PerformanceContext> {
    const [capabilities, complexityAnalysis] = await Promise.all([
      this.detector.detectCapabilities({ timeout: 2000 }),
      analyzeSvgComplexity(svgString)
    ]);

    const systemMetrics = this.estimateSystemMetrics(capabilities);

    return {
      svgSize: svgString.length,
      targetPixelCount: targetWidth * targetHeight,
      complexityScore: complexityAnalysis.complexityScore,
      browserCapabilities: capabilities,
      systemMetrics
    };
  }

  /**
   * 시스템 메트릭 추정
   */
  private static estimateSystemMetrics(capabilities: BrowserCapabilities): SystemMetrics {
    // 브라우저 기능을 바탕으로 시스템 성능 추정
    const devicePixelRatio = capabilities.devicePixelRatio || 1;

    // 기능별 가중치를 사용한 성능 점수 계산
    let performanceScore = 0.5; // 기본값

    if (capabilities.offscreenCanvas) performanceScore += 0.2;
    if (capabilities.webWorkers) performanceScore += 0.15;
    if (capabilities.imageBitmap) performanceScore += 0.1;
    if (capabilities.sharedArrayBuffer) performanceScore += 0.05;

    return {
      availableMemoryMB: Math.min(500, 100 + performanceScore * 400), // 100~500MB
      estimatedCores: capabilities.webWorkers ? Math.min(8, Math.max(2, Math.floor(performanceScore * 8))) : 1,
      devicePixelRatio,
      connectionQuality: performanceScore > 0.8 ? 'high' : performanceScore > 0.6 ? 'medium' : 'low'
    };
  }

  /**
   * 최적 전략 계산 (핵심 알고리즘)
   */
  private static computeOptimalStrategy(
    context: PerformanceContext,
    options: Partial<SvgProcessingOptions>
  ): ProcessingStrategy {
    const {
      targetPixelCount,
      complexityScore,
      browserCapabilities,
      systemMetrics
    } = context;

    // 부하 레벨 판단
    const isHighLoad = complexityScore > this.PERFORMANCE_THRESHOLDS.highComplexity ||
                       targetPixelCount > this.PERFORMANCE_THRESHOLDS.highLoad;

    const isMediumLoad = complexityScore > this.PERFORMANCE_THRESHOLDS.mediumComplexity ||
                         targetPixelCount > this.PERFORMANCE_THRESHOLDS.mediumLoad;

    // 브라우저 능력 평가
    const canUseOffscreen = browserCapabilities.offscreenCanvas &&
                           browserCapabilities.webWorkers &&
                           browserCapabilities.imageBitmap;

    const canUseWorkers = browserCapabilities.webWorkers &&
                         browserCapabilities.transferableObjects;

    // 전략 결정 로직
    let strategy: ProcessingStrategy;

    if (isHighLoad && canUseOffscreen) {
      // 고부하 + OffscreenCanvas 지원 = 최고 성능 전략
      strategy = {
        useOffscreenCanvas: true,
        useWebWorker: true,
        optimizeSvg: true,
        qualityLevel: 'high',
        expectedPerformanceGain: 40,
        estimatedProcessingTimeMs: this.estimateProcessingTime(targetPixelCount, 'offscreen'),
        estimatedMemoryUsageMB: this.estimateMemoryUsage(targetPixelCount, 3),
        reason: '고부하 작업을 위한 OffscreenCanvas + Web Worker 최적화'
      };
    } else if (isMediumLoad && canUseWorkers) {
      // 중부하 + Web Worker 지원 = 멀티스레드 전략
      strategy = {
        useOffscreenCanvas: false,
        useWebWorker: true,
        optimizeSvg: true,
        qualityLevel: 'medium',
        expectedPerformanceGain: 25,
        estimatedProcessingTimeMs: this.estimateProcessingTime(targetPixelCount, 'worker'),
        estimatedMemoryUsageMB: this.estimateMemoryUsage(targetPixelCount, 2),
        reason: '중부하 작업을 위한 Web Worker 멀티스레드 처리'
      };
    } else if (complexityScore > 0.3) {
      // 복잡한 SVG = 품질 우선 전략
      strategy = {
        useOffscreenCanvas: false,
        useWebWorker: false,
        optimizeSvg: true,
        qualityLevel: 'high',
        expectedPerformanceGain: 15,
        estimatedProcessingTimeMs: this.estimateProcessingTime(targetPixelCount, 'main-thread'),
        estimatedMemoryUsageMB: this.estimateMemoryUsage(targetPixelCount, 3),
        reason: '복잡한 SVG를 위한 고품질 메인스레드 처리'
      };
    } else {
      // 기본 전략 = 빠른 처리
      strategy = {
        useOffscreenCanvas: false,
        useWebWorker: false,
        optimizeSvg: false,
        qualityLevel: 'medium',
        expectedPerformanceGain: 0,
        estimatedProcessingTimeMs: this.estimateProcessingTime(targetPixelCount, 'main-thread'),
        estimatedMemoryUsageMB: this.estimateMemoryUsage(targetPixelCount, 2),
        reason: '단순한 SVG를 위한 빠른 메인스레드 처리'
      };
    }

    // 메모리 제한 체크
    if (strategy.estimatedMemoryUsageMB > systemMetrics.availableMemoryMB * 0.8) {
      strategy = this.downgradeTEStrategy(strategy, '메모리 부족');
    }

    return strategy;
  }

  /**
   * 전략 다운그레이드 (제약사항으로 인한 조정)
   */
  private static downgradeTEStrategy(strategy: ProcessingStrategy, reason: string): ProcessingStrategy {
    return {
      ...strategy,
      qualityLevel: strategy.qualityLevel === 'ultra' ? 'high' :
                   strategy.qualityLevel === 'high' ? 'medium' : 'low',
      useOffscreenCanvas: false,
      optimizeSvg: true, // 메모리 절약을 위해 최적화 활성화
      expectedPerformanceGain: Math.max(0, strategy.expectedPerformanceGain - 15),
      estimatedMemoryUsageMB: strategy.estimatedMemoryUsageMB * 0.7,
      reason: `${strategy.reason} (${reason}으로 인한 다운그레이드)`
    };
  }

  /**
   * 처리 시간 추정
   */
  private static estimateProcessingTime(pixelCount: number, mode: 'offscreen' | 'worker' | 'main-thread'): number {
    const baseTime = Math.sqrt(pixelCount) * 0.1; // 기본 처리 시간

    switch (mode) {
      case 'offscreen':
        return baseTime * 0.6; // 40% 성능 향상
      case 'worker':
        return baseTime * 0.75; // 25% 성능 향상
      case 'main-thread':
      default:
        return baseTime;
    }
  }

  /**
   * 메모리 사용량 추정
   */
  private static estimateMemoryUsage(pixelCount: number, scaleFactor: number): number {
    const bytesPerPixel = 4; // RGBA
    const actualPixels = pixelCount * scaleFactor * scaleFactor;
    const baseMemoryBytes = actualPixels * bytesPerPixel;
    const overheadFactor = 1.5; // Canvas 오버헤드

    return (baseMemoryBytes * overheadFactor) / (1024 * 1024); // MB 변환
  }

  /**
   * 캐시 키 생성
   */
  private static generateCacheKey(
    context: PerformanceContext,
    options: Partial<SvgProcessingOptions>
  ): string {
    const keyData = {
      svgSize: Math.floor(context.svgSize / 1000), // KB 단위
      pixelCount: Math.floor(context.targetPixelCount / 1000), // K픽셀 단위
      complexity: Math.round(context.complexityScore * 10) / 10, // 0.1 단위
      offscreen: context.browserCapabilities.offscreenCanvas,
      workers: context.browserCapabilities.webWorkers,
      format: options.format || 'png',
      quality: options.quality || 'auto'
    };

    return JSON.stringify(keyData);
  }

  /**
   * 캐시된 전략 조회
   */
  private static getCachedStrategy(cacheKey: string): StrategyCacheEntry | null {
    const entry = this.strategies.get(cacheKey);

    if (!entry) return null;

    // 만료 확인
    if (Date.now() - entry.createdAt > this.CACHE_EXPIRY_MS) {
      this.strategies.delete(cacheKey);
      return null;
    }

    return entry;
  }

  /**
   * 전략 캐시 저장
   */
  private static cacheStrategy(cacheKey: string, strategy: ProcessingStrategy): void {
    // 캐시 크기 제한
    if (this.strategies.size >= this.MAX_CACHE_SIZE) {
      this.cleanupOldestCacheEntries();
    }

    this.strategies.set(cacheKey, {
      strategy,
      createdAt: Date.now(),
      useCount: 1
    });
  }

  /**
   * 오래된 캐시 항목 정리
   */
  private static cleanupOldestCacheEntries(): void {
    const entries = Array.from(this.strategies.entries());
    entries.sort((a, b) => a[1].createdAt - b[1].createdAt);

    // 가장 오래된 25% 제거
    const removeCount = Math.floor(entries.length * 0.25);
    for (let i = 0; i < removeCount; i++) {
      this.strategies.delete(entries[i][0]);
    }
  }

  /**
   * 실제 성능 기록
   */
  private static recordActualPerformance(
    strategy: ProcessingStrategy,
    performance: { processingTimeMs: number; memoryUsageMB: number; qualityScore: number }
  ): void {
    // 실제 성능 데이터를 사용하여 향후 예측 정확도 향상
    // 현재는 로깅만 수행, 향후 머신러닝 모델 학습에 활용 가능
    const variance = {
      timeVariance: Math.abs(performance.processingTimeMs - strategy.estimatedProcessingTimeMs),
      memoryVariance: Math.abs(performance.memoryUsageMB - strategy.estimatedMemoryUsageMB)
    };

    if (variance.timeVariance > strategy.estimatedProcessingTimeMs * 0.5) {
      console.warn('처리 시간 예측 정확도 낮음:', variance);
    }
  }

  /**
   * 품질 점수 추정 (향후 개선 가능)
   */
  private static estimateQualityScore(result: SvgProcessingResult): number {
    // 스케일링 팩터와 처리 시간을 바탕으로 품질 점수 추정
    const scaleScore = Math.min(1, result.scaleFactor / 4); // 4x가 최대
    const timeScore = Math.max(0, 1 - result.processingTimeMs / 10000); // 10초 기준

    return (scaleScore * 0.7) + (timeScore * 0.3);
  }

  /**
   * 최적화 옵션 생성
   */
  private static getOptimizationOptions(strategy: ProcessingStrategy): SvgOptimizationOptions {
    return {
      removeMetadata: true,
      simplifyPaths: strategy.qualityLevel !== 'ultra',
      optimizeGradients: true,
      mergeElements: false, // 안전을 위해 비활성화
      removeUnusedDefs: true,
      precision: strategy.qualityLevel === 'ultra' ? 4 :
                strategy.qualityLevel === 'high' ? 3 : 2
    };
  }

  /**
   * 기본 전략 (폴백용)
   */
  private static getDefaultStrategy(): ProcessingStrategy {
    return {
      useOffscreenCanvas: false,
      useWebWorker: false,
      optimizeSvg: false,
      qualityLevel: 'medium',
      expectedPerformanceGain: 0,
      estimatedProcessingTimeMs: 1000,
      estimatedMemoryUsageMB: 50,
      reason: '기본 전략 (안전 모드)'
    };
  }

  // ============================================================================
  // PUBLIC UTILITY METHODS - 공용 유틸리티 메서드들
  // ============================================================================

  /**
   * 캐시 상태 조회 (디버깅용)
   */
  static getCacheStatus(): { size: number; maxSize: number; hitRate?: number } {
    const entries = Array.from(this.strategies.values());
    const totalUses = entries.reduce((sum, entry) => sum + entry.useCount, 0);
    const totalEntries = entries.length;

    return {
      size: totalEntries,
      maxSize: this.MAX_CACHE_SIZE,
      hitRate: totalEntries > 0 ? totalUses / totalEntries : undefined
    };
  }

  /**
   * 캐시 초기화
   */
  static clearCache(): void {
    this.strategies.clear();
  }

  /**
   * 성능 임계값 조회
   */
  static getPerformanceThresholds(): typeof PerformanceManager.PERFORMANCE_THRESHOLDS {
    return { ...this.PERFORMANCE_THRESHOLDS };
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS - 편의 함수들
// ============================================================================

/**
 * 빠른 최적 전략 선택 (편의 함수)
 */
export async function selectOptimalStrategy(
  svgString: string,
  targetWidth: number,
  targetHeight: number,
  options?: Partial<SvgProcessingOptions>
): Promise<ProcessingStrategy> {
  return PerformanceManager.selectOptimalStrategy(svgString, targetWidth, targetHeight, options);
}

/**
 * 스마트 SVG 처리 (편의 함수)
 * 자동으로 최적 전략을 선택하여 처리
 */
export async function processWithSmartOptimization(
  svgString: string,
  options: SvgProcessingOptions
): Promise<SvgProcessingResult & { strategy: ProcessingStrategy }> {
  return PerformanceManager.processWithOptimalStrategy(svgString, options);
}

/**
 * 성능 예측 (처리 전 미리보기)
 */
export async function predictPerformance(
  svgString: string,
  targetWidth: number,
  targetHeight: number,
  options?: Partial<SvgProcessingOptions>
): Promise<Pick<ProcessingStrategy, 'estimatedProcessingTimeMs' | 'estimatedMemoryUsageMB' | 'expectedPerformanceGain' | 'reason'>> {
  const strategy = await PerformanceManager.selectOptimalStrategy(svgString, targetWidth, targetHeight, options);

  return {
    estimatedProcessingTimeMs: strategy.estimatedProcessingTimeMs,
    estimatedMemoryUsageMB: strategy.estimatedMemoryUsageMB,
    expectedPerformanceGain: strategy.expectedPerformanceGain,
    reason: strategy.reason
  };
}