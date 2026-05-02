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

/**
 * strict SVG sanitizer 옵션
 */
export interface StrictSvgSanitizerOptions {
  /** 최대 SVG 입력 바이트 크기. 기본값: 10_485_760 (10MB) */
  maxBytes?: number;
  /** 최대 노드 개수. 기본값: 10_000 */
  maxNodeCount?: number;
  /** <metadata>와 작성 도구 네임스페이스 제거 여부. 기본값: false */
  removeMetadata?: boolean;
}

/**
 * sanitizeSvgStrictDetailed() 반환 타입
 */
export interface SanitizeSvgStrictDetailedResult {
  /** 정제된 SVG 문자열 */
  svg: string;
  /** 정제 과정에서 발생한 경고 목록 */
  warnings: string[];
}

/**
 * DOMPurify 기반 strict SVG sanitizer.
 *
 * 신뢰할 수 없는 SVG에서 XSS 벡터, 위험 태그, 위험 속성, 외부 리소스 참조를
 * 제거한 안전한 SVG 문자열을 반환한다.
 *
 * @param svg 입력 SVG 문자열
 * @param options sanitizer 옵션
 * @returns 정제된 SVG 문자열
 */
export function sanitizeSvgStrict(_svg: string, _options?: StrictSvgSanitizerOptions): string {
  // TASK-02에서 DOMPurify 기반 구현 예정
  throw new Error('sanitizeSvgStrict: 미구현 — TASK-02에서 구현됩니다');
}

/**
 * DOMPurify 기반 strict SVG sanitizer (상세 결과 반환).
 *
 * sanitizeSvgStrict()와 동일하게 정제를 수행하되, 정제된 SVG와 함께
 * 정제 과정에서 발생한 경고 목록을 반환한다.
 *
 * @param svg 입력 SVG 문자열
 * @param options sanitizer 옵션
 * @returns 정제된 SVG와 경고 목록을 담은 객체
 */
export function sanitizeSvgStrictDetailed(
  _svg: string,
  _options?: StrictSvgSanitizerOptions
): SanitizeSvgStrictDetailedResult {
  // TASK-02에서 DOMPurify 기반 구현 예정
  throw new Error('sanitizeSvgStrictDetailed: 미구현 — TASK-02에서 구현됩니다');
}
