/**
 * SVG 문자열을 HTMLImageElement로 렌더링하는 핵심 로직이다.
 *
 * sanitizer 정책 분기, 호환성 보정, 복잡도 분석을 거쳐 Blob URL/Base64 Data URL
 * 하이브리드 경로로 이미지를 디코딩한다.
 */

import type { SvgSanitizerMode } from '../../../types';
import { ImageProcessError } from '../../../types';
import { debugLog, productionLog } from '../../../utils/debug';
import { enhanceSvgForBrowser } from '../../../utils/svg-compatibility';
import { extractSvgDimensions } from '../../../utils/svg-dimensions';
import { sanitizeSvgForRendering } from '../../../utils/svg-sanitizer';
import type { QualityLevel } from '../../svg-complexity-analyzer';
import { analyzeSvgComplexity } from '../../svg-complexity-analyzer';
import type { SvgPassthroughMode } from '../options';
import { createBase64DataUrl } from './data-url';
import { assertSafeSvgContent, checkSvgSizeLimit } from './safety';

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

  // 테스트 환경에서는 실제 SVG 디코딩을 우회해 타임아웃을 방지한다.
  if (typeof globalThis !== 'undefined' && (globalThis as any)._SVG_MOCK_MODE) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = document.createElement('img');
      img.onload = () => {
        img.onload = null;
        img.onerror = null;
        resolve(img);
      };
      img.onerror = () => {
        img.onload = null;
        img.onerror = null;
        reject(new ImageProcessError('Mock SVG image loading failed', 'IMAGE_LOAD_FAILED'));
      };
      // 최소 비용의 1x1 투명 PNG로 대체한다.
      img.src =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    });
  }

  try {
    // unsafe 경로는 호환성 보정을 건너뛰고, 그 외 경로는 브라우저 호환성 보정을 수행한다.
    const shouldSkipCompatibilityEnhancement = options?.passthroughMode === 'unsafe-pass-through';
    const svgForLoad = shouldSkipCompatibilityEnhancement ? svgForSafety : enhanceSvgForBrowser(svgForSafety);

    // 2. 원본 SVG의 크기 정보를 추출한다.
    const dimensions = extractSvgDimensions(svgForLoad);

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
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = document.createElement('img');
      let objectUrl: string | null = null;

      // Promise 결정 시 핸들러를 해제하고 Blob URL을 정리한다.
      const cleanup = () => {
        img.onload = null;
        img.onerror = null;
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      };

      // 로드 성공 시 임시 URL을 정리한다.
      img.onload = () => {
        cleanup();
        resolve(img);
      };

      // 로드 실패 시에도 임시 URL을 정리하고 표준 오류로 감싼다.
      img.onerror = (error) => {
        cleanup();
        reject(
          new ImageProcessError(
            `SVG load failed: quality level ${qualityLevel}, size ${renderWidth}x${renderHeight}, error: ${error}`,
            'SOURCE_LOAD_FAILED'
          )
        );
      };

      // SVG 크기에 따라 메모리 효율과 속도 사이의 균형점을 선택한다.
      const svgSize = new Blob([enhancedSvg]).size;
      const SIZE_THRESHOLD = 50 * 1024; // 50KB threshold

      if (svgSize > SIZE_THRESHOLD) {
        // 큰 SVG는 Blob URL이 메모리 사용량에 유리하다.
        try {
          const blob = new Blob([enhancedSvg], { type: 'image/svg+xml' });
          objectUrl = URL.createObjectURL(blob);
          img.src = objectUrl;
        } catch (blobError) {
          // Blob 생성이 실패하면 Base64 방식으로 폴백한다.
          productionLog.warn('Failed to create Blob URL, fallback to Base64:', blobError);
          img.src = createBase64DataUrl(enhancedSvg);
        }
      } else {
        // 작은 SVG는 Base64가 더 단순하고 빠르다.
        img.src = createBase64DataUrl(enhancedSvg);
      }

      // 비동기 디코딩을 요청해 메인 스레드 부담을 줄인다.
      img.decoding = 'async';

      // 필요 시 CORS 설정을 전달한다.
      if (options?.crossOrigin) {
        img.crossOrigin = options.crossOrigin;
      }
    });
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
