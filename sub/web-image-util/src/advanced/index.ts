/**
 * @cp949/web-image-util/advanced
 *
 * 고급 이미지 처리 기능들
 * - SVG 품질 향상 및 복잡도 분석
 * - OffscreenCanvas + Web Worker 고성능 처리
 * - 브라우저 기능 감지 및 최적화
 */

// ============================================================================
// SVG 고급 처리 기능들
// ============================================================================

// SVG 품질 기반 처리
export { SVGProcessor } from './svg-processor';
export type { SvgProcessingOptions, SvgProcessingResult } from './svg-processor';

// OffscreenCanvas + Web Worker 고성능 처리
export { OffscreenSVGProcessor, isOffscreenCanvasSupported, processSmartSvg } from './offscreen-svg-processor';

// ============================================================================
// 브라우저 기능 감지 및 최적화
// ============================================================================

// 브라우저 기능 감지
export {
  BrowserCapabilityDetector,
  detectBrowserCapabilities,
  analyzePerformanceFeatures,
  detectSyncCapabilities,
  detectFormatSupport,
  getOptimalProcessingMode,
  DEFAULT_DETECTION_OPTIONS,
  PROCESSING_MODE_DESCRIPTIONS,
  FEATURE_PERFORMANCE_WEIGHTS
} from '../utils/browser-capabilities';

export type {
  BrowserCapabilities,
  PerformanceFeatures,
  DetectionOptions
} from '../utils/browser-capabilities';

// ============================================================================
// SVG 품질 분석 및 복잡도 시스템
// ============================================================================

// SVG 복잡도 분석
export { analyzeSvgComplexity } from '../core/svg-complexity-analyzer';
export type { SvgComplexityMetrics, ComplexityAnalysisResult, QualityLevel } from '../core/svg-complexity-analyzer';

// SVG 호환성 및 차원 처리
export {
  normalizeSvgBasics,
  enhanceBrowserCompatibility
} from '../utils/svg-compatibility';

export {
  extractSvgDimensions,
  setSvgDimensions
} from '../utils/svg-dimensions';

export type { SvgDimensions, SvgEnhanceOptions } from '../utils/svg-dimensions';

// ============================================================================
// Canvas 고품질 설정
// ============================================================================

export { setupHighQualityCanvas } from '../base/canvas-utils';
export type { HighQualityCanvasOptions } from '../base/canvas-utils';

// ============================================================================
// 편의 함수들 및 통합 API
// ============================================================================

// 타입 임포트 추가
import type { SvgProcessingOptions, SvgProcessingResult } from './svg-processor';
import type { BrowserCapabilities, PerformanceFeatures } from '../utils/browser-capabilities';
import type { QualityLevel } from '../core/svg-complexity-analyzer';

/**
 * 통합 고성능 SVG 처리 API
 * 브라우저 기능에 따라 자동으로 최적 처리 방식 선택
 */
export async function processAdvancedSvg(
  svgString: string,
  options: SvgProcessingOptions
): Promise<SvgProcessingResult> {
  // processSmartSvg 함수를 통해 자동 모드 선택
  const { processSmartSvg } = await import('./offscreen-svg-processor');
  return processSmartSvg(svgString, options);
}

/**
 * SVG 처리 성능 벤치마크
 * 다양한 처리 방식의 성능을 비교 측정
 */
export async function benchmarkSvgProcessing(
  svgString: string,
  options: SvgProcessingOptions
): Promise<{
  standardTime: number;
  offscreenTime?: number;
  isOffscreenFaster: boolean;
  recommendation: 'standard' | 'offscreen';
}> {
  const { SVGProcessor } = await import('./svg-processor');
  const { OffscreenSVGProcessor, isOffscreenCanvasSupported } = await import('./offscreen-svg-processor');

  // 표준 처리 시간 측정
  const standardStart = performance.now();
  await SVGProcessor.processWithQuality(svgString, options);
  const standardTime = performance.now() - standardStart;

  let offscreenTime: number | undefined;
  let isOffscreenFaster = false;

  // OffscreenCanvas 지원 시 성능 비교
  if (await isOffscreenCanvasSupported()) {
    try {
      const offscreenStart = performance.now();
      await OffscreenSVGProcessor.processWithOffscreenCanvas(svgString, options);
      offscreenTime = performance.now() - offscreenStart;
      isOffscreenFaster = offscreenTime < standardTime;
    } catch (error) {
      // OffscreenCanvas 처리 실패 시 표준 방식 권장
      console.warn('OffscreenCanvas 벤치마크 실패:', error);
    }
  }

  return {
    standardTime,
    offscreenTime,
    isOffscreenFaster,
    recommendation: isOffscreenFaster ? 'offscreen' : 'standard'
  };
}

/**
 * 시스템 성능 프로파일 결과 타입
 */
export interface SystemPerformanceProfile {
  /** 브라우저 기능 */
  capabilities: BrowserCapabilities;
  /** 성능 특성 */
  performance: PerformanceFeatures;
  /** 권장 설정 */
  recommendedSettings: {
    /** 최대 동시 Worker 수 */
    maxConcurrentWorkers: number;
    /** 최적 품질 레벨 */
    optimalQualityLevel: QualityLevel;
    /** OffscreenCanvas 사용 여부 */
    useOffscreenCanvas: boolean;
  };
}

/**
 * 시스템 성능 프로파일링
 * 현재 브라우저의 이미지 처리 성능 특성 분석
 */
export async function profileSystemPerformance(): Promise<SystemPerformanceProfile> {
  const { BrowserCapabilityDetector } = await import('../utils/browser-capabilities');

  const detector = BrowserCapabilityDetector.getInstance();
  const capabilities = await detector.detectCapabilities();
  const performance = await detector.analyzePerformance();

  // 시스템 특성에 따른 권장 설정
  const recommendedSettings = {
    maxConcurrentWorkers: capabilities.webWorkers ?
      (capabilities.sharedArrayBuffer ? 4 : 2) : 1,
    optimalQualityLevel: capabilities.offscreenCanvas ? 'high' as QualityLevel : 'medium' as QualityLevel,
    useOffscreenCanvas: performance.canUseOffscreenCanvas
  };

  return {
    capabilities,
    performance,
    recommendedSettings
  };
}