/**
 * SVG 문자열을 HTMLImageElement로 렌더링하는 핵심 로직이다.
 *
 * sanitizer 정책 분기, 호환성 보정, 복잡도 분석을 거쳐 Blob URL/Base64 Data URL
 * 하이브리드 경로로 이미지를 디코딩한다.
 */

import type { SvgSanitizerMode } from '../../../svg-contract.internal';
import { ImageProcessError } from '../../../types';
import { debugLog, productionLog } from '../../../utils/debug.internal';
import { decodeImageFromBlob, decodeImageFromUrl, type ImageDecodeOptions } from '../../../utils/image-decode.internal';
import { enhanceSvgForBrowserWithDimensions } from '../../../utils/svg-compatibility/enhance';
import { extractSvgDimensions } from '../../../utils/svg-dimensions';
import { sanitizeSvgForRendering } from '../../../utils/svg-sanitizer';
import type { QualityLevel } from '../../svg-complexity-analyzer';
import { analyzeSvgComplexity } from '../../svg-complexity-analyzer';
import type { SvgPassthroughMode } from '../options.internal';
import { createBase64DataUrl } from './data-url.internal';
import { assertSafeSvgContent, checkSvgSizeLimit } from './safety.internal';

/** SVG 렌더링 시 품질과 CORS 동작을 제어하는 옵션이다. */
export interface SvgRenderingOptions {
  /** 품질 수준 또는 자동 선택 */
  quality?: QualityLevel | 'auto';
  /** CORS 설정 */
  crossOrigin?: string;
  /** SVG passthrough 모드 — unsafe는 sanitize와 호환성 보정을 건너뛴다 */
  passthroughMode?: SvgPassthroughMode;
  /** SVG sanitizer 정책 */
  sanitizerMode?: SvgSanitizerMode;
}

/**
 * Blob URL 준비 실패만 Base64 폴백 대상으로 골라내기 위한 지역 신호다.
 *
 * 디코드 실패(`SOURCE_LOAD_FAILED`)와 구분해야 폴백이 실제 로드 실패를 삼키지 않는다.
 * 이 코드는 같은 함수 안에서 즉시 소비되며 호출자에게 노출되지 않는다.
 */
const OBJECT_URL_FALLBACK_CODE = 'SVG_PROCESSING_FAILED' as const;

/**
 * strict sanitizer는 opt-in일 때만 로드한다.
 *
 * 기본 lightweight 경로에서 DOMPurify 기반 subpath를 top-level import하지 않기 위해
 * 동적 import를 사용한다.
 */
async function sanitizeSvgStrictForProcessing(svgString: string): Promise<string> {
  const { sanitizeSvgStrict } = await import('../../../svg-sanitizer');
  return sanitizeSvgStrict(svgString);
}

/**
 * SVG 문자열을 HTMLImageElement로 변환한다.
 *
 * @description
 * 벡터 품질을 완전히 보존하면서 SVG를 HTMLImageElement로 변환한다.
 *
 * **핵심 최적화:**
 * - SVG 원본 유지 (벡터 → 래스터 변환 지연)
 * - Canvas에 목표 크기로 직접 렌더링 (중간 단계 제거)
 * - 복잡도 분석을 통한 자동 품질 수준 선택
 * - 대형 SVG는 Blob URL, 소형 SVG는 Base64 하이브리드 방식
 *
 * @param svgString 변환할 SVG 문자열
 * @param targetWidth 목표 너비 (픽셀, 선택)
 * @param targetHeight 목표 높이 (픽셀, 선택)
 * @param options 렌더링 옵션 (품질 수준, CORS 등)
 * @returns 완전히 로드된 HTMLImageElement
 */
export async function convertSvgToElement(
  svgString: string,
  targetWidth?: number,
  targetHeight?: number,
  options?: SvgRenderingOptions
): Promise<HTMLImageElement> {
  const sanitizerMode =
    options?.sanitizerMode ?? (options?.passthroughMode === 'unsafe-pass-through' ? 'skip' : 'lightweight');

  if (sanitizerMode !== 'skip') {
    // sanitize 과정에서 제거될 콘텐츠로 원본 크기 제한을 우회하지 못하게 한다.
    checkSvgSizeLimit(svgString, 'inline SVG');
  }

  let svgForSafety: string;
  if (sanitizerMode === 'strict') {
    svgForSafety = await sanitizeSvgStrictForProcessing(svgString);
  } else if (sanitizerMode === 'lightweight') {
    svgForSafety = sanitizeSvgForRendering(svgString);
  } else if (sanitizerMode === 'skip') {
    svgForSafety = svgString;
  } else {
    throw new ImageProcessError(`Unsupported SVG sanitizer mode: ${String(sanitizerMode)}`, 'INVALID_SOURCE', {
      details: { mode: sanitizerMode },
    });
  }

  if (sanitizerMode !== 'skip') {
    // sanitizer 이후에도 Canvas 오염을 일으킬 수 있는 잔여 참조는 fail-closed로 차단한다.
    assertSafeSvgContent(svgForSafety);
  }

  // 크기 초과 입력은 skip 경로에서도 차단한다.
  checkSvgSizeLimit(svgForSafety, 'inline SVG');

  try {
    // unsafe 경로는 호환성 보정을 건너뛰고, 그 외 경로는 브라우저 호환성 보정을 수행한다.
    const shouldSkipCompatibilityEnhancement = options?.passthroughMode === 'unsafe-pass-through';

    // 2. 호환성 보강과 유효 크기 계산을 같은 파싱 결과에서 함께 얻는다.
    // 예전에는 enhanceSvgForBrowser()와 extractSvgDimensions()를 svgForSafety에 나란히 호출해
    // parse와(viewBox 없는 SVG의 경우) BBox 스캔이 두 번씩 일어났다.
    // unsafe 경로는 보강 자체를 건너뛰므로 extractSvgDimensions()를 독립 호출한다.
    const { enhancedSvg: svgForLoad, dimensions } = shouldSkipCompatibilityEnhancement
      ? { enhancedSvg: svgForSafety, dimensions: extractSvgDimensions(svgForSafety) }
      : enhanceSvgForBrowserWithDimensions(svgForSafety);

    // 3. 목표 렌더링 크기를 결정한다.
    const finalWidth = targetWidth || dimensions.width;
    const finalHeight = targetHeight || dimensions.height;

    // 4. 명시값 또는 복잡도 분석 결과로 품질 수준을 정한다.
    let qualityLevel: QualityLevel = 'medium';
    if (options?.quality === 'auto' || !options?.quality) {
      const complexityResult = analyzeSvgComplexity(svgForLoad);
      qualityLevel = complexityResult.recommendedQuality;
    } else {
      qualityLevel = options.quality;
    }

    // 5. SVG는 벡터이므로 목표 크기로 바로 렌더링해 불필요한 스케일 단계를 없앤다.
    const renderWidth = finalWidth;
    const renderHeight = finalHeight;

    debugLog.log('🔧 convertSvgToElement direct rendering:', {
      originalDimensions: `${dimensions.width}x${dimensions.height}`,
      targetDimensions: `${finalWidth}x${finalHeight}`,
      qualityLevel,
      renderDimensions: `${renderWidth}x${renderHeight}`,
      hasExplicitSize: dimensions.hasExplicitSize,
      viewBox: dimensions.viewBox,
      timestamp: Date.now(),
    });

    // 7. 정규화된 SVG를 그대로 사용해 벡터 품질을 유지한다.
    const enhancedSvg = svgForLoad;

    // 8. 크기에 따라 Blob URL과 Base64를 선택하는 하이브리드 로딩을 적용한다.
    const decodeOptions: ImageDecodeOptions = {
      errorCode: 'SOURCE_LOAD_FAILED',
      message: `SVG load failed: quality level ${qualityLevel}, size ${renderWidth}x${renderHeight}`,
      // 비동기 디코딩을 요청해 메인 스레드 부담을 줄인다.
      decoding: 'async',
      crossOrigin: options?.crossOrigin,
    };

    // SVG 크기에 따라 메모리 효율과 속도 사이의 균형점을 선택한다.
    const svgSize = new Blob([enhancedSvg]).size;
    const SIZE_THRESHOLD = 50 * 1024; // 50KB threshold

    if (svgSize > SIZE_THRESHOLD) {
      // 큰 SVG는 Blob URL이 메모리 사용량에 유리하다.
      try {
        return await decodeImageFromBlob(new Blob([enhancedSvg], { type: 'image/svg+xml' }), {
          ...decodeOptions,
          objectUrlErrorCode: OBJECT_URL_FALLBACK_CODE,
        });
      } catch (blobError) {
        const isDecodeFailure = blobError instanceof ImageProcessError && blobError.code !== OBJECT_URL_FALLBACK_CODE;
        if (isDecodeFailure) {
          throw blobError;
        }
        // Blob URL 준비가 실패하면 Base64 방식으로 폴백한다.
        productionLog.warn('Failed to create Blob URL, fallback to Base64:', blobError);
      }
    }

    // 작은 SVG는 Base64가 더 단순하고 빠르다. Blob URL 준비 실패 시의 폴백 경로이기도 하다.
    return await decodeImageFromUrl(createBase64DataUrl(enhancedSvg), decodeOptions);
  } catch (error) {
    if (error instanceof ImageProcessError) {
      throw error;
    }
    throw new ImageProcessError(
      `SVG processing failed: ${error instanceof Error ? error.message : error}`,
      'SOURCE_LOAD_FAILED'
    );
  }
}
