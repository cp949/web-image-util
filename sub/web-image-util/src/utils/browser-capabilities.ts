/**
 * 브라우저 기능 감지와 성능 최적화 판단을 담당한다.
 *
 * 실제 구현은 `utils/browser-capabilities/` 서브모듈로 분리되어 있으며,
 * 본 파일은 외부 import 호환을 위한 배럴 역할만 한다.
 */

export type { BrowserCapabilities, DetectionOptions, PerformanceFeatures } from './browser-capabilities/index';

export {
  analyzePerformanceFeatures,
  BrowserCapabilityDetector,
  DEFAULT_DETECTION_OPTIONS,
  detectBrowserCapabilities,
  detectCanvasFormatSupport,
  detectFormatSupport,
  detectSyncCapabilities,
  FEATURE_PERFORMANCE_WEIGHTS,
  getCachedBrowserCapabilities,
  getCachedFormatSupport,
  getOptimalProcessingMode,
  PROCESSING_MODE_DESCRIPTIONS,
} from './browser-capabilities/index';
