/**
 * 유틸리티 함수들 - 간단한 이미지 변환
 *
 * @description 이미지 처리 없이 순수 변환만 수행하는 유틸리티들
 * 간편하고 직관적인 이미지 처리 함수들
 */

// 변환 함수들
export {
  toBlob,
  toBlobDetailed,
  toDataURL,
  toDataURLDetailed,
  toFile,
  toFileDetailed,
  type BlobOptions,
  type BlobDetailedOptions,
  type DataURLOptions,
  type DataURLDetailedOptions,
  type FileOptions,
  type FileDetailedOptions,
} from './converters';

// SVG 호환성 함수들
export {
  enhanceBrowserCompatibility,
  normalizeSvgBasics,
  type SvgCompatibilityOptions,
  type SvgCompatibilityReport,
} from './svg-compatibility';

// ImageSource 변환 시스템
export {
  ImageSourceConverter,
  convertTo,
  ConversionBuilder,
  from,
  type ConvertibleTarget,
  type ConvertedType,
  type ConversionOptions,
} from './image-source-converter';

// 시스템 검증 및 문서화
export { SystemValidator, API_EXAMPLES, type ValidationReport } from './system-validator';

// Phase 3: 브라우저 기능 감지 시스템
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

// SVG 벡터 최적화 시스템 (Phase 3 Step 3)
export {
  SvgOptimizer,
  type SvgOptimizationOptions,
  type OptimizationResult,
} from './svg-optimizer';
