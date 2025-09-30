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
// (제거됨: SVGProcessor, OffscreenSVGProcessor - v2.0에서 불필요)

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

import type { BrowserCapabilities, PerformanceFeatures } from '../utils/browser-capabilities';
import type { QualityLevel } from '../core/svg-complexity-analyzer';

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