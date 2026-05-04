/**
 * @cp949/web-image-util/svg-sanitizer
 *
 * DOMPurify 기반 strict SVG sanitizer 서브패스.
 *
 * processImage() 내부의 경량 안전 처리(lightweight safety guard)와 달리,
 * 이 모듈은 신뢰할 수 없는 SVG를 processImage()에 넘기기 전에 명시적으로
 * 고강도 정제를 수행하기 위한 API를 제공한다.
 *
 * @example
 * ```ts
 * import { processImage } from '@cp949/web-image-util';
 * import { sanitizeSvgStrict } from '@cp949/web-image-util/svg-sanitizer';
 *
 * const safeSvg = sanitizeSvgStrict(svg);
 * const result = await processImage(safeSvg)
 *   .resize({ fit: 'cover', width: 300, height: 300 })
 *   .toBlob();
 * ```
 *
 * @remarks
 * processImage()는 strict sanitizer를 자동 호출하지 않는다.
 * 고강도 정제가 필요한 경우 이 모듈의 함수를 먼저 호출한 뒤
 * processImage()에 결과를 넘긴다.
 */

import { sanitizeSvgStrictCore } from './core';
import type { SanitizeSvgStrictDetailedResult, StrictSvgSanitizerOptions } from './types';

export type { SanitizeSvgStrictDetailedResult, StrictSvgSanitizerOptions } from './types';

/**
 * DOMPurify 기반 strict SVG sanitizer.
 *
 * 신뢰할 수 없는 SVG에서 XSS 벡터, 위험 태그, 위험 속성, 외부 리소스 참조를
 * 정의된 strict 정책에 따라 제거한 SVG 문자열을 반환한다.
 *
 * @param svg 입력 SVG 문자열
 * @param options sanitizer 옵션
 * @returns 정제된 SVG 문자열
 *
 * @throws {TypeError} svg가 문자열이 아닌 경우
 * @throws {Error} 입력 바이트 크기가 maxBytes를 초과하거나 정제 후 노드 개수가 maxNodeCount를 초과하는 경우
 */
export function sanitizeSvgStrict(svg: string, options?: StrictSvgSanitizerOptions): string {
  return sanitizeSvgStrictCore(svg, options).svg;
}

/**
 * DOMPurify 기반 strict SVG sanitizer (상세 결과 반환).
 *
 * sanitizeSvgStrict()와 동일하게 정제를 수행하되, 정제된 SVG와 함께
 * 정제 과정에서 발생한 경고 목록을 반환한다.
 *
 * 경고 목록에는 라이브러리가 사전/후처리한 항목(DOCTYPE/ENTITY 제거, 사용자 설정 충돌,
 * 후처리 정책에 따른 위험 속성/참조 제거)이 포함되며 DOMPurify 자체의 removed 배열은 노출하지 않는다.
 *
 * @param svg 입력 SVG 문자열
 * @param options sanitizer 옵션
 * @returns 정제된 SVG와 경고 목록을 담은 객체
 *
 * @throws {TypeError} svg가 문자열이 아닌 경우
 * @throws {Error} 입력 바이트 크기가 maxBytes를 초과하거나 정제 후 노드 개수가 maxNodeCount를 초과하는 경우
 */
export function sanitizeSvgStrictDetailed(
  svg: string,
  options?: StrictSvgSanitizerOptions
): SanitizeSvgStrictDetailedResult {
  return sanitizeSvgStrictCore(svg, options);
}
