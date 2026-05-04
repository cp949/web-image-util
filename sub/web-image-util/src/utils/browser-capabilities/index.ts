/**
 * 브라우저 기능 감지 서브모듈의 공개 진입점.
 *
 * @description 외부 호출자는 이 배럴만 import해서 타입과 함수를 모두 사용한다.
 * 내부 구현은 책임별로 분리되어 있으며 직접 참조하지 않는다.
 */

export {
  analyzePerformanceFeatures,
  BrowserCapabilityDetector,
  DEFAULT_DETECTION_OPTIONS,
  detectBrowserCapabilities,
  detectSyncCapabilities,
  getCachedBrowserCapabilities,
  getOptimalProcessingMode,
} from './detector';

export { detectCanvasFormatSupport, detectFormatSupport, getCachedFormatSupport } from './format-detection';

export { FEATURE_PERFORMANCE_WEIGHTS, PROCESSING_MODE_DESCRIPTIONS } from './performance';
export type { BrowserCapabilities, DetectionOptions, PerformanceFeatures } from './types';
