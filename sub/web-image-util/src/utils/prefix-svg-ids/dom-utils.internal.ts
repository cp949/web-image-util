import { parseAndClassifySvg } from '../svg-document.internal';
import type { SvgIdPrefixDeoptReason } from './types.internal';

/**
 * SVG 문자열을 DOMParser로 파싱한다.
 * DOMParser/XMLSerializer 미가용, parsererror, root가 svg가 아닌 경우 failure를 반환한다.
 */
export function parseSvgDocument(svgString: string): Document | { failure: SvgIdPrefixDeoptReason } {
  // 직렬화 단계(serializeSvgDocument)까지 가야 하므로 XMLSerializer 가용성은 여기서 함께 본다.
  if (typeof XMLSerializer === 'undefined') {
    return { failure: 'domparser-unavailable' };
  }
  const parsed = parseAndClassifySvg(svgString);
  if (!parsed.ok) {
    return { failure: parsed.reason === 'domparser-unavailable' ? 'domparser-unavailable' : 'parse-failed' };
  }
  if (parsed.root !== 'svg') {
    return { failure: 'parse-failed' };
  }
  return parsed.doc;
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
