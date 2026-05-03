/**
 * 공개 export 계약 테스트
 *
 * @description
 * 루트 엔트리(`@cp949/web-image-util`)와 서브패스(`/utils`, `/advanced`, `/presets`, `/filters`,
 * `/svg-sanitizer`)의
 * 명시적 value export 목록을 잠근다. 의도되지 않은 추가/제거를 즉시 감지하기 위해
 * 정확 일치(`exact match`) 방식으로 검증한다.
 *
 * 새 export를 추가하거나 제거할 때는 이 파일의 목록을 의도적으로 함께 수정해야 한다.
 */

import { describe, expect, test } from 'vitest';

import * as root from '../../src';
import * as advanced from '../../src/advanced-index';
import * as filters from '../../src/filters/plugins';
import * as presets from '../../src/presets';
import * as svgSanitizer from '../../src/svg-sanitizer';
import * as utils from '../../src/utils';

/**
 * `import * as mod`로 얻은 모듈 네임스페이스에서 실제 value export 키만 추출한다.
 */
function valueExportKeys(mod: Record<string, unknown>): string[] {
  return Object.keys(mod)
    .filter((key) => key !== 'default')
    .sort();
}

const ROOT_VALUE_EXPORTS = [
  // SVG 복잡도 분석
  'analyzeSvgComplexity',
  // 편의 preset
  'createAvatar',
  'createSocialImage',
  'createThumbnail',
  // 핵심 API
  'ImageProcessor',
  'processImage',
  'unsafe_processImage',
  // 단축 API
  'ShortcutBuilder',
  // 에러 / 상수
  'ImageProcessError',
  'OPTIMAL_QUALITY_BY_FORMAT',
  // /utils에서 재노출하는 유틸 함수
  'blobToDataURL',
  'convertToBlob',
  'convertToBlobDetailed',
  'convertToDataURL',
  'convertToDataURLDetailed',
  'convertToElement',
  'convertToFile',
  'convertToFileDetailed',
  'dataURLToBlob',
  'detectImageSourceInfo',
  'detectImageSourceType',
  'detectImageStringSourceInfo',
  'detectImageStringSourceType',
  'ensureBlob',
  'ensureBlobDetailed',
  'ensureDataURL',
  'ensureDataURLDetailed',
  'ensureFile',
  'ensureFileDetailed',
  'estimateDataURLSize',
  'fetchImageFormat',
  'formatToMimeType',
  'getImageAspectRatio',
  'getImageDimensions',
  'getImageFormat',
  'getImageInfo',
  'getImageOrientation',
  'getOutputFilename',
  'hasTransparency',
  'isDataURLString',
  'isInlineSvg',
  'isSupportedOutputFormat',
  'mimeTypeToImageFormat',
  'mimeTypeToOutputFormat',
  'replaceImageExtension',
  'resolveOutputFormat',
  // 브라우저 기능 감지
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
  // SVG 호환성 보정
  'enhanceBrowserCompatibility',
  'enhanceSvgForBrowser',
  // SVG 크기 추출
  'extractSvgDimensions',
  // SVG 정제
  'sanitizeSvg',
  'sanitizeSvgForRendering',
  // 레거시 facade
  'features',
].sort();

const UTILS_VALUE_EXPORTS = [
  // 브라우저 기능 감지 (utils 서브패스는 캐시 헬퍼를 노출하지 않는다)
  'analyzePerformanceFeatures',
  'BrowserCapabilityDetector',
  'DEFAULT_DETECTION_OPTIONS',
  'detectBrowserCapabilities',
  'detectFormatSupport',
  'detectSyncCapabilities',
  'FEATURE_PERFORMANCE_WEIGHTS',
  'getOptimalProcessingMode',
  'PROCESSING_MODE_DESCRIPTIONS',
  // 변환 유틸
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
  // Data URL 유틸
  'blobToDataURL',
  'dataURLToBlob',
  'decodeSvgDataURL',
  'estimateDataURLPayloadByteLength',
  'estimateDataURLSize',
  'isDataURLString',
  // 포맷 유틸
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
  // 소스 판정 유틸
  'detectImageSourceInfo',
  'detectImageSourceType',
  'detectImageStringSourceInfo',
  'detectImageStringSourceType',
  // SVG 호환성 / 감지 / 최적화 / 정제
  'enhanceBrowserCompatibility',
  'enhanceSvgForBrowser',
  'isInlineSvg',
  'sanitizeSvg',
  'sanitizeSvgForRendering',
  'SvgOptimizer',
].sort();

const PRESETS_VALUE_EXPORTS = ['createAvatar', 'createSocialImage', 'createThumbnail'].sort();

const SVG_SANITIZER_VALUE_EXPORTS = ['sanitizeSvgStrict', 'sanitizeSvgStrictDetailed'].sort();

const FILTERS_VALUE_EXPORTS = [
  // index.ts에서 직접 노출하는 함수와 모음
  'AllFilterPlugins',
  'initializeFilterSystem',
  'registerDefaultFilters',
  // blur-plugins 재노출
  'BlurFilterPlugin',
  'BlurFilterPlugins',
  'EdgeDetectionFilterPlugin',
  'EmbossFilterPlugin',
  'SharpenFilterPlugin',
  // color-plugins 재노출
  'BrightnessFilterPlugin',
  'ColorFilterPlugins',
  'ContrastFilterPlugin',
  'SaturationFilterPlugin',
  // effect-plugins 재노출
  'EffectFilterPlugins',
  'GrayscaleFilterPlugin',
  'InvertFilterPlugin',
  'NoiseFilterPlugin',
  'PixelateFilterPlugin',
  'PosterizeFilterPlugin',
  'SepiaFilterPlugin',
  'VignetteFilterPlugin',
].sort();

const ADVANCED_VALUE_EXPORTS = [
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
  // filters/plugins/*와 동일한 목록을 그대로 재노출한다
  ...FILTERS_VALUE_EXPORTS,
].sort();

describe('공개 export 계약', () => {
  test('루트(`@cp949/web-image-util`) value export 목록이 고정되어 있다', () => {
    expect(valueExportKeys(root)).toEqual(ROOT_VALUE_EXPORTS);
  });

  test('`/utils` 서브패스 value export 목록이 고정되어 있다', () => {
    expect(valueExportKeys(utils)).toEqual(UTILS_VALUE_EXPORTS);
  });

  test('`/presets` 서브패스 value export 목록이 고정되어 있다', () => {
    expect(valueExportKeys(presets)).toEqual(PRESETS_VALUE_EXPORTS);
  });

  test('`/filters` 서브패스 value export 목록이 고정되어 있다', () => {
    expect(valueExportKeys(filters)).toEqual(FILTERS_VALUE_EXPORTS);
  });

  test('`/svg-sanitizer` 서브패스 value export 목록이 고정되어 있다', () => {
    expect(valueExportKeys(svgSanitizer)).toEqual(SVG_SANITIZER_VALUE_EXPORTS);
  });

  test('`/advanced` 서브패스 value export 목록이 고정되어 있다', () => {
    expect(valueExportKeys(advanced)).toEqual(ADVANCED_VALUE_EXPORTS);
  });
});
