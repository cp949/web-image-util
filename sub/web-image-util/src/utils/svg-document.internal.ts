/**
 * SVG DOM 파싱 경계 — 라이브러리 전체의 단일 소유자.
 *
 * DOMParser 가용성 확인, `image/svg+xml` 파싱, parsererror 감지, 루트 요소 판정을
 * 캡슐화한다. dimension 읽기·finding 수집·정책 적용은 소비자 책임이며, 루트가
 * 'svg'일 때 documentElement(`svgElement`)를 함께 넘겨 호출부가 후속 분석을 하게 한다.
 *
 * parsererror는 구현체에 따라 루트 요소로도(WebKit), 자식 노드로도(Firefox/jsdom)
 * 나타나므로 문서 전체 querySelector로 감지한다.
 *
 * 이 모듈은 public export가 아니다(`package.json` exports 비대상).
 */

/** DOMParser 파싱 실패 결과. */
export type ParseSvgFailure = {
  ok: false;
  /** 실패 계열 — 소비자가 message 문자열 매칭 없이 분기할 수 있게 한다. */
  reason: 'domparser-unavailable' | 'parse-error';
  message: string;
  locationAvailable: boolean;
  doc: null;
};

/** DOMParser 파싱 성공 결과. */
export type ParseSvgSuccess = {
  ok: true;
  message: null;
  locationAvailable: false;
  doc: Document;
};

/** 파싱 성공 후 루트 요소를 판정한 결과. */
export type ParsedSvgRoot = 'svg' | 'other' | 'none' | 'unknown';

/**
 * parseAndClassifySvg가 호출부에 넘기는 통합 결과.
 *
 * root === 'svg' 판정만으로 svgElement가 non-null로 좁혀지도록 union을 분리한다.
 */
export type SvgParseResult =
  | (ParseSvgFailure & { root: 'unknown'; svgElement: null })
  | (ParseSvgSuccess & { root: 'svg'; svgElement: Element })
  | (ParseSvgSuccess & { root: 'other' | 'none'; svgElement: null });

/** DOMParser로 SVG 문자열을 파싱한다. parsererror 감지까지 수행한다. */
function parseSvgWithDomParser(svgString: string): ParseSvgFailure | ParseSvgSuccess {
  if (typeof DOMParser === 'undefined') {
    return {
      ok: false,
      reason: 'domparser-unavailable',
      message: 'DOMParser is not available in this environment.',
      locationAvailable: false,
      doc: null,
    };
  }

  let doc: Document;
  let parseError: Element | null;
  try {
    doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
    parseError = doc.querySelector('parsererror');
  } catch {
    // 구현체가 파싱 중 예외를 던지는 경우도 parse-error로 정규화한다.
    return {
      ok: false,
      reason: 'parse-error',
      message: 'XML parser reported an error while parsing the input as image/svg+xml.',
      locationAvailable: false,
      doc: null,
    };
  }

  if (parseError !== null) {
    const textContent = parseError.textContent ?? '';
    const locationAvailable = /line\s*\d+/i.test(textContent) || /Line:\s*\d+/.test(textContent);
    return {
      ok: false,
      reason: 'parse-error',
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
export function parseAndClassifySvg(svgString: string): SvgParseResult {
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
