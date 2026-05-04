/**
 * 공개 export 계약에서 기대하는 value export 목록.
 *
 * @description
 * `/advanced`가 `/filters`의 export 목록을 재노출하므로, 목록 조합은 이 fixture에서만 처리한다.
 * 테스트 파일끼리 상수를 가져다 쓰는 교차 의존을 피하기 위한 단일 출처다.
 */

export const ROOT_VALUE_EXPORTS = [
  // 핵심 API
  'ImageProcessor',
  'processImage',
  'unsafe_processImage',
  // 단축 API
  'ShortcutBuilder',
  // 편의 preset
  'createAvatar',
  'createSocialImage',
  'createThumbnail',
  // 에러 / 상수
  'ImageErrorCode',
  'ImageProcessError',
  'OPTIMAL_QUALITY_BY_FORMAT',
  // 레거시 facade
  'features',
  // SVG 복잡도 분석 (루트 전용)
  'analyzeSvgComplexity',
  // SVG 크기 추출 (루트 전용)
  'extractSvgDimensions',

  // /utils 재노출 - 변환
  'convertToBlob',
  'convertToBlobDetailed',
  'convertToDataURL',
  'convertToDataURLDetailed',
  'convertToElement',
  'convertToFile',
  'convertToFileDetailed',
  'ensureBlob',
  'ensureBlobDetailed',
  'ensureDataURL',
  'ensureDataURLDetailed',
  'ensureFile',
  'ensureFileDetailed',
  'ensureImageElement',
  'ensureImageElementDetailed',
  // /utils 재노출 - Data URL
  'blobToDataURL',
  'dataURLToBlob',
  'decodeSvgDataURL',
  'estimateDataURLPayloadByteLength',
  'estimateDataURLSize',
  'isDataURLString',
  // /utils 재노출 - 포맷
  'formatToMimeType',
  'getOutputFilename',
  'isSupportedOutputFormat',
  'mimeTypeToImageFormat',
  'mimeTypeToOutputFormat',
  'replaceImageExtension',
  'resolveOutputFormat',
  // /utils 재노출 - 이미지 정보
  'fetchImageFormat',
  'fetchImageSourceBlob',
  'getImageAspectRatio',
  'getImageDimensions',
  'getImageFormat',
  'getImageInfo',
  'getImageOrientation',
  // /utils 재노출 - 이미지 검사
  'hasTransparency',
  // /utils 재노출 - 소스 판정
  'detectImageSourceInfo',
  'detectImageSourceType',
  'detectImageStringSourceInfo',
  'detectImageStringSourceType',
  // /utils 재노출 - SVG
  'enhanceBrowserCompatibility',
  'enhanceSvgForBrowser',
  'isInlineSvg',
  'sanitizeSvg',
  'sanitizeSvgForRendering',
  // /utils 재노출 - 브라우저 기능 감지 (캐시 헬퍼는 /utils 서브패스 미노출)
  'analyzePerformanceFeatures',
  'BrowserCapabilityDetector',
  'DEFAULT_DETECTION_OPTIONS',
  'detectBrowserCapabilities',
  'detectFormatSupport',
  'detectSyncCapabilities',
  'FEATURE_PERFORMANCE_WEIGHTS',
  'getCachedBrowserCapabilities',
  'getCachedFormatSupport',
  'getOptimalProcessingMode',
  'PROCESSING_MODE_DESCRIPTIONS',
].sort();

export const UTILS_VALUE_EXPORTS = [
  // 브라우저 기능 감지 (캐시 헬퍼 미노출)
  'analyzePerformanceFeatures',
  'BrowserCapabilityDetector',
  'DEFAULT_DETECTION_OPTIONS',
  'detectBrowserCapabilities',
  'detectFormatSupport',
  'detectSyncCapabilities',
  'FEATURE_PERFORMANCE_WEIGHTS',
  'getOptimalProcessingMode',
  'PROCESSING_MODE_DESCRIPTIONS',
  // 변환
  'convertToBlob',
  'convertToBlobDetailed',
  'convertToDataURL',
  'convertToDataURLDetailed',
  'convertToElement',
  'convertToFile',
  'convertToFileDetailed',
  'ensureBlob',
  'ensureBlobDetailed',
  'ensureDataURL',
  'ensureDataURLDetailed',
  'ensureFile',
  'ensureFileDetailed',
  'ensureImageElement',
  'ensureImageElementDetailed',
  // Data URL
  'blobToDataURL',
  'dataURLToBlob',
  'decodeSvgDataURL',
  'estimateDataURLPayloadByteLength',
  'estimateDataURLSize',
  'isDataURLString',
  // 포맷
  'formatToMimeType',
  'getOutputFilename',
  'isSupportedOutputFormat',
  'mimeTypeToImageFormat',
  'mimeTypeToOutputFormat',
  'replaceImageExtension',
  'resolveOutputFormat',
  // 이미지 정보
  'fetchImageFormat',
  'fetchImageSourceBlob',
  'getImageAspectRatio',
  'getImageDimensions',
  'getImageFormat',
  'getImageInfo',
  'getImageOrientation',
  // 이미지 검사
  'hasTransparency',
  // 소스 판정
  'detectImageSourceInfo',
  'detectImageSourceType',
  'detectImageStringSourceInfo',
  'detectImageStringSourceType',
  // SVG
  'enhanceBrowserCompatibility',
  'enhanceSvgForBrowser',
  'isInlineSvg',
  'sanitizeSvg',
  'sanitizeSvgForRendering',
  'SvgOptimizer',
].sort();

export const PRESETS_VALUE_EXPORTS = ['createAvatar', 'createSocialImage', 'createThumbnail'].sort();

export const SVG_SANITIZER_VALUE_EXPORTS = ['sanitizeSvgStrict', 'sanitizeSvgStrictDetailed'].sort();

export const FILTERS_VALUE_EXPORTS = [
  // 필터 시스템
  'AllFilterPlugins',
  'initializeFilterSystem',
  'registerDefaultFilters',
  // blur 필터
  'BlurFilterPlugin',
  'BlurFilterPlugins',
  'EdgeDetectionFilterPlugin',
  'EmbossFilterPlugin',
  'SharpenFilterPlugin',
  // color 필터
  'BrightnessFilterPlugin',
  'ColorFilterPlugins',
  'ContrastFilterPlugin',
  'SaturationFilterPlugin',
  // effect 필터
  'EffectFilterPlugins',
  'GrayscaleFilterPlugin',
  'InvertFilterPlugin',
  'NoiseFilterPlugin',
  'PixelateFilterPlugin',
  'PosterizeFilterPlugin',
  'SepiaFilterPlugin',
  'VignetteFilterPlugin',
].sort();

export const ADVANCED_VALUE_EXPORTS = [
  // 에러 헬퍼
  'createAndHandleError',
  'createQuickError',
  'getErrorStats',
  'withErrorHandling',
  // 단순 워터마크
  'addCopyright',
  'addImageWatermark',
  'addTextWatermark',
  'SimpleWatermark',
  // 고급 프로세서
  'AdvancedImageProcessor',
  'addWatermarkAndOptimize',
  'processWithFilters',
  'smartResize',
  // 자동 고해상도 처리
  'AutoHighResProcessor',
  'autoSmartResize',
  'smartResizeWithProgress',
  // 배치 리사이저
  'BatchResizer',
  // 에러 핸들러
  'globalErrorHandler',
  'ImageErrorHandler',
  // 성능 설정
  'getPerformanceConfig',
  'RESIZE_PROFILES',
  // 성능 유틸
  'autoResize',
  'fastResize',
  'qualityResize',
  'ResizePerformance',
  // 스마트 포맷
  'autoOptimize',
  'ImagePurpose',
  'optimizeForThumbnail',
  'optimizeForWeb',
  'SmartFormatSelector',
  // 필터 플러그인 시스템
  'applyFilter',
  'applyFilterChain',
  'FilterCategory',
  'filterManager',
  'getAvailableFilters',
  'registerFilter',
  // 포맷 감지기
  'FORMAT_MIME_MAP',
  'FormatDetector',
  // 고해상도 관리자
  'HighResolutionManager',
  // 합성
  'ImageWatermark',
  'TextWatermark',
  // advanced-index.ts에 정의된 편의 헬퍼
  'batchOptimize',
  'createAdvancedThumbnail',
  'createFilterPlugin',
  'getAdvancedFeatureInfo',
  'optimizeForSocial',
  // filters/plugins/*와 동일한 목록을 그대로 재노출한다.
  ...FILTERS_VALUE_EXPORTS,
].sort();
