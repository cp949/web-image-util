/**
 * URI/href 참조에 대한 strict sanitizer 정책 어댑터.
 *
 * 판정 규칙은 위협 정책 모듈(`utils/svg-threat-policy.internal`)이 소유한다.
 * 이 모듈은 strict 엔진의 콜백 형태(`NestedSanitize` — 옵션 전파 포함)를
 * 정책 모듈의 콜백 형태로 맞추는 어댑터만 담당한다.
 *
 * nested SVG 재귀 정제는 core(`sanitizeSvgStrictCore`)를 호출해야 하지만, 이
 * 모듈이 core를 직접 import 하면 순환 의존이 생긴다. 따라서 core가 자기
 * 자신을 `nestedSanitize` 콜백으로 주입한다(types.ts의 `NestedSanitize`).
 */

import { isAllowedUri, sanitizeUriValue } from '../utils/svg-threat-policy.internal';
import type { NestedSanitize, StrictSvgSanitizerOptions } from './types';

/**
 * URI 속성에서 허용할 수 있는 내부 참조인지 판정한다.
 *
 * strict sanitizer는 외부 로딩과 canvas taint를 줄이기 위해 `#id` 형태의
 * 문서 내부 프래그먼트 참조만 보존한다.
 *
 * @param value URI 속성값
 * @returns 내부 프래그먼트 참조이면 true
 */
export function isSafeInternalReference(value: string): boolean {
  return isAllowedUri(value, 'strict');
}

/**
 * strict sanitizer의 href/xlink:href/src 값에 보존 정책을 적용한다.
 *
 * - 안전한 raster `data:image/*`는 원본 그대로 보존
 * - `data:image/svg+xml`은 nested SVG를 strict sanitizer로 재귀 정제한 뒤
 *   `data:image/svg+xml;base64,...`로 재인코딩 (`MAX_NESTED_SVG_DEPTH` 깊이 제한)
 * - 그 외에는 내부 프래그먼트(`#id`)만 허용하고 나머지는 제거 의도(null) 반환
 *
 * @param value 원본 속성값
 * @param options 부모 sanitizer 옵션 (nested 호출에 그대로 전파)
 * @param depth 현재 재귀 깊이
 * @param nestedSanitize core가 주입하는 재귀 정제 함수
 * @returns 새 속성값 또는 null(속성 제거)
 */
export function sanitizeStrictUriValue(
  value: string,
  options: StrictSvgSanitizerOptions | undefined,
  depth: number,
  nestedSanitize: NestedSanitize
): string | null {
  return sanitizeUriValue(value, 'strict', depth, (nestedSvg, nestedDepth) => {
    return nestedSanitize(nestedSvg, options, nestedDepth).svg;
  });
}
