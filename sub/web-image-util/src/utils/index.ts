/**
 * 유틸리티 함수들 - 이미지 변환 및 지원 기능
 *
 * @description
 * 이미지 처리 없이 순수 변환만 수행하는 경량 유틸리티 모음
 * 복잡한 이미지 처리가 필요 없는 간단한 변환 작업에 최적화
 *
 * **주요 기능:**
 * - 다양한 이미지 형식 간 직접 변환 (Blob ↔ DataURL ↔ File ↔ Element)
 * - SVG 호환성 향상 및 브라우저 정규화
 * - 브라우저 기능 감지 및 성능 분석
 * - SVG 벡터 최적화 및 압축
 *
 * **사용 시나리오:**
 * - 이미지 리사이징 없이 포맷 변환만 필요한 경우
 * - SVG 파일의 브라우저 호환성 개선
 * - 현재 브라우저의 이미지 처리 성능 파악
 *
 * @example
 * ```typescript
 * import { convertToBlob, normalizeSvgBasics } from '@cp949/web-image-util/utils';
 *
 * // 간단한 포맷 변환
 * const blob = await convertToBlob(imageElement);
 *
 * // SVG 호환성 개선
 * const normalizedSvg = normalizeSvgBasics(svgString);
 * ```
 */

/**
 * 이미지 포맷 변환 함수들
 *
 * @description 이미지 리사이징 없이 순수 포맷 변환만 수행하는 함수들
 * 빠르고 가벼운 변환 작업에 적합
 */
export {
  convertToBlob,
  convertToBlobDetailed,
  convertToDataURL,
  convertToDataURLDetailed,
  convertToFile,
  convertToFileDetailed,
  convertToElement,
  type ConvertToBlobOptions,
  type ConvertToBlobDetailedOptions,
  type ConvertToDataURLOptions,
  type ConvertToDataURLDetailedOptions,
  type ConvertToFileOptions,
  type ConvertToFileDetailedOptions,
} from './converters';

/**
 * SVG 호환성 및 브라우저 정규화 함수들
 *
 * @description 다양한 브라우저에서 일관된 SVG 렌더링을 위한
 * 호환성 향상 및 표준화 기능
 */
export {
  enhanceBrowserCompatibility,
  normalizeSvgBasics,
  type SvgCompatibilityOptions,
  type SvgCompatibilityReport,
} from './svg-compatibility';

/**
 * 브라우저 기능 감지 시스템
 *
 * @description 현재 브라우저의 이미지 처리 관련 기능을 자동으로 감지하고
 * 최적의 처리 방식을 결정하는 지능형 시스템
 */
export {
  BrowserCapabilityDetector,
  detectBrowserCapabilities,
  analyzePerformanceFeatures,
  detectSyncCapabilities,
  detectFormatSupport,
  getOptimalProcessingMode,
  DEFAULT_DETECTION_OPTIONS,
  PROCESSING_MODE_DESCRIPTIONS,
  FEATURE_PERFORMANCE_WEIGHTS,
  type BrowserCapabilities,
  type PerformanceFeatures,
  type DetectionOptions,
} from './browser-capabilities';

/**
 * SVG 벡터 최적화 시스템
 *
 * @description SVG 파일의 크기를 줄이고 렌더링 성능을 향상시키는
 * 고급 최적화 도구
 */
export { SvgOptimizer, type SvgOptimizationOptions, type OptimizationResult } from './svg-optimizer';
