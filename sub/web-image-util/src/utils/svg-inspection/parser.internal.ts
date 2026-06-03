/**
 * SVG 파싱 경계.
 *
 * DOMParser 가용성 확인, `image/svg+xml` 파싱, parsererror 감지, 루트 요소
 * 판정을 캡슐화한다. dimension 읽기·finding 수집은 이 모듈의 책임이 아니며,
 * 루트가 'svg'일 때 documentElement(`svgElement`)를 함께 넘겨 호출부가
 * 후속 분석을 하게 한다.
 *
 * 이 모듈은 public export가 아니다(`package.json` exports 비대상).
 */

import type { InspectParseResult, ParseSvgFailure, ParseSvgSuccess } from './types.internal';

/** DOMParser로 SVG 문자열을 파싱한다. parsererror 감지까지 수행한다. */
function parseSvgWithDomParser(svgString: string): ParseSvgFailure | ParseSvgSuccess {
  if (typeof DOMParser === 'undefined') {
    return {
      ok: false,
      message: 'DOMParser is not available in this environment.',
      locationAvailable: false,
      doc: null,
    };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const parseError = doc.querySelector('parsererror');

  if (parseError !== null) {
    const textContent = parseError.textContent ?? '';
    const locationAvailable = /line\s*\d+/i.test(textContent) || /Line:\s*\d+/.test(textContent);
    return {
      ok: false,
      message: 'XML parser reported an error while parsing the input as image/svg+xml.',
      locationAvailable,
      doc: null,
    };
  }

  return { ok: true, message: null, locationAvailable: false, doc };
}

/**
 * SVG 문자열을 파싱하고 루트 판정까지 수행한다.
 *
 * - 파싱 실패: root='unknown', svgElement=null
 * - documentElement 부재: root='none', svgElement=null
 * - 루트가 svg: root='svg', svgElement=documentElement
 * - 그 외 루트: root='other', svgElement=null
 */
export function parseAndClassifySvg(svgString: string): InspectParseResult {
  const parseResult = parseSvgWithDomParser(svgString);

  if (!parseResult.ok) {
    return { ...parseResult, root: 'unknown', svgElement: null };
  }

  const docEl = parseResult.doc.documentElement;
  if (docEl == null) {
    return { ...parseResult, root: 'none', svgElement: null };
  }

  const tagLower = docEl.tagName.toLowerCase();
  if (tagLower === 'svg') {
    return { ...parseResult, root: 'svg', svgElement: docEl };
  }

  return { ...parseResult, root: 'other', svgElement: null };
}
