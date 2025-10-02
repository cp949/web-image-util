/**
 * @cp949/web-image-util/advanced
 *
 * @description
 * 고급 이미지 처리 기능 및 성능 최적화 모듈
 *
 * **주요 기능:**
 * - SVG 복잡도 분석 및 품질 최적화
 * - 브라우저 기능 감지 및 성능 프로파일링
 * - 고성능 Canvas 설정 및 최적화
 * - SVG 호환성 향상 및 차원 처리
 * - 시스템 리소스 기반 최적 설정 추천
 *
 * **사용 시나리오:**
 * - 복잡한 SVG 파일의 최적 렌더링 품질 결정
 * - 브라우저별 최적화 설정 자동 감지
 * - 시스템 성능에 맞는 이미지 처리 파라미터 설정
 * - Canvas 기반 고품질 이미지 렌더링
 *
 * @example
 * ```typescript
 * import { profileSystemPerformance, analyzeSvgComplexity } from '@cp949/web-image-util/advanced';
 *
 * // 시스템 성능 프로파일링
 * const profile = await profileSystemPerformance();
 * console.log('최적 품질 레벨:', profile.recommendedSettings.optimalQualityLevel);
 *
 * // SVG 복잡도 분석
 * const analysis = analyzeSvgComplexity(svgString);
 * console.log('권장 품질:', analysis.recommendedQuality);
 * ```
 */

// ============================================================================
// SVG 고급 처리 기능들
// ============================================================================
// 참고: SVGProcessor, OffscreenSVGProcessor는 v2.0에서 통합 파이프라인으로 대체됨

// ============================================================================
// 브라우저 기능 감지 및 최적화 시스템
// ============================================================================

/**
 * 브라우저 기능 감지 및 성능 분석 모듈
 *
 * @description 현재 브라우저의 이미지 처리 관련 기능을 감지하고
 * 최적의 처리 모드를 결정하는 유틸리티들
 */
export {
  analyzePerformanceFeatures,
  BrowserCapabilityDetector,
  DEFAULT_DETECTION_OPTIONS,
  detectBrowserCapabilities,
  detectFormatSupport,
  detectSyncCapabilities,
  FEATURE_PERFORMANCE_WEIGHTS,
  getOptimalProcessingMode,
  PROCESSING_MODE_DESCRIPTIONS,
} from '../utils/browser-capabilities';

export type { BrowserCapabilities, DetectionOptions, PerformanceFeatures } from '../utils/browser-capabilities';

// ============================================================================
// SVG 품질 분석 및 복잡도 시스템
// ============================================================================

/**
 * SVG 복잡도 분석 및 품질 최적화 모듈
 *
 * @description SVG 파일의 구조를 분석하여 최적의 렌더링 품질을 결정하고
 * 브라우저 호환성을 향상시키는 고급 기능들
 */
export { analyzeSvgComplexity } from '../core/svg-complexity-analyzer';
export type { ComplexityAnalysisResult, QualityLevel, SvgComplexityMetrics } from '../core/svg-complexity-analyzer';

/**
 * SVG 호환성 및 차원 처리 유틸리티
 *
 * @description 다양한 브라우저에서 일관된 SVG 렌더링을 위한
 * 호환성 향상 및 크기 정보 추출 기능
 */
export { enhanceBrowserCompatibility, normalizeSvgBasics } from '../utils/svg-compatibility';
export { extractSvgDimensions } from '../utils/svg-dimensions';
export type { SvgDimensions } from '../utils/svg-dimensions';

// ============================================================================
// Canvas 고품질 렌더링 설정
// ============================================================================

/**
 * Canvas 고품질 렌더링 설정
 *
 * @description 이미지 품질 향상을 위한 Canvas 렌더링 최적화 옵션
 */
export { setupHighQualityCanvas } from '../base/canvas-utils';
export type { HighQualityCanvasOptions } from '../base/canvas-utils';

// ============================================================================
// 편의 함수들 및 통합 API
// ============================================================================

import type { QualityLevel } from '../core/svg-complexity-analyzer';
import type { BrowserCapabilities, PerformanceFeatures } from '../utils/browser-capabilities';

/**
 * 시스템 성능 프로파일 결과 인터페이스
 *
 * @description 브라우저의 이미지 처리 성능을 종합적으로 분석한 결과
 * 시스템 특성에 맞는 최적화 설정을 포함합니다.
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
 *
 * @description
 * 현재 브라우저의 이미지 처리 성능 특성을 종합적으로 분석하고
 * 최적의 설정을 추천하는 고급 기능
 *
 * **분석 항목:**
 * - 브라우저 기능 지원 여부 (OffscreenCanvas, WebWorkers 등)
 * - 성능 특성 (렌더링 속도, 메모리 사용량 등)
 * - 최적 설정 계산 (동시 작업 수, 품질 레벨 등)
 *
 * @returns 시스템 성능 프로파일 (기능, 성능, 권장 설정)
 *
 * @example
 * ```typescript
 * const profile = await profileSystemPerformance();
 *
 * console.log('OffscreenCanvas 지원:', profile.capabilities.offscreenCanvas);
 * console.log('권장 Worker 수:', profile.recommendedSettings.maxConcurrentWorkers);
 * console.log('최적 품질 레벨:', profile.recommendedSettings.optimalQualityLevel);
 *
 * // 권장 설정에 따른 이미지 처리
 * if (profile.recommendedSettings.useOffscreenCanvas) {
 *   // OffscreenCanvas 기반 처리
 * }
 * ```
 */
export async function profileSystemPerformance(): Promise<SystemPerformanceProfile> {
  const { BrowserCapabilityDetector } = await import('../utils/browser-capabilities');

  const detector = BrowserCapabilityDetector.getInstance();
  const capabilities = await detector.detectCapabilities();
  const performance = await detector.analyzePerformance();

  // 시스템 특성에 따른 권장 설정
  const recommendedSettings = {
    maxConcurrentWorkers: capabilities.webWorkers ? (capabilities.sharedArrayBuffer ? 4 : 2) : 1,
    optimalQualityLevel: capabilities.offscreenCanvas ? ('high' as QualityLevel) : ('medium' as QualityLevel),
    useOffscreenCanvas: performance.canUseOffscreenCanvas,
  };

  return {
    capabilities,
    performance,
    recommendedSettings,
  };
}
