import type { SvgIdPrefixDeoptReason } from './types.internal';

/**
 * SVG 문자열을 DOMParser로 파싱한다.
 * DOMParser/XMLSerializer 미가용, parsererror, root가 svg가 아닌 경우 failure를 반환한다.
 */
export function parseSvgDocument(svgString: string): Document | { failure: SvgIdPrefixDeoptReason } {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return { failure: 'domparser-unavailable' };
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
      return { failure: 'parse-failed' };
    }
    if (!doc.documentElement || doc.documentElement.tagName.toLowerCase() !== 'svg') {
      return { failure: 'parse-failed' };
    }
    return doc;
  } catch {
    return { failure: 'parse-failed' };
  }
}

/**
 * doc에 style deopt 사유가 있는지 검사한다.
 * `<style>` 요소 존재 → 'style-tag-present', style 속성 존재 → 'style-attribute-present'.
 * 두 사유 모두 가능하다.
 */
export function detectStyleDeoptReasons(doc: Document): SvgIdPrefixDeoptReason[] {
  const reasons: SvgIdPrefixDeoptReason[] = [];
  if (doc.getElementsByTagName('style').length > 0) {
    reasons.push('style-tag-present');
  }
  const allElements = doc.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    if (allElements[i].getAttribute('style') !== null) {
      reasons.push('style-attribute-present');
      break;
    }
  }
  return reasons;
}

/**
 * doc을 XMLSerializer로 직렬화한다. 예외 발생 시 null 반환(fail-safe D13).
 */
export function serializeSvgDocument(doc: Document): string | null {
  try {
    return new XMLSerializer().serializeToString(doc);
  } catch {
    return null;
  }
}
