/**
 * SVG 경량 방어층(lightweight safety guard) 모듈
 *
 * @description
 * `processImage()` 내부에서 사용하는 경량 방어층이다. 이미지 로딩/Canvas 변환
 * 파이프라인을 보호하기 위해 SVG 문자열에서 명백히 위험한 패턴을 제거한다.
 * 브라우저와 jsdom 테스트 환경 양쪽에서 동작하도록 정규식 기반으로 구현한다.
 *
 * 이 모듈은 DOMPurify 같은 전용 strict sanitizer를 대체하지 않는다.
 * 신뢰할 수 없는 SVG를 다루는 경우 호출처에서 `@cp949/web-image-util/svg-sanitizer`의
 * `sanitizeSvgStrict()`를 먼저 호출하거나 자체 sanitizer로 사전 정제한다.
 *
 * **제거 대상:**
 * - `<script>` 요소 (자가 닫힘 포함)
 * - `<foreignObject>` 요소 (중첩 콘텐츠 포함)
 * - `on*` 이벤트 핸들러 속성 (onload, onclick 등)
 * - `href`, `xlink:href`, `src` 속성 중 문서 내부 프래그먼트(`#id`)와
 *   안전한 `data:image/*`가 아닌 모든 참조 (상대 경로·미지 스킴 포함)
 * - `style`·presentation 속성과 `<style>` 본문의 외부 `url(...)` 참조,
 *   `@import`/`expression()`/`image-set()`/`-moz-binding` 구문
 *
 * 판정 규칙은 위협 정책 모듈(`svg-threat-policy.internal`)이 소유하며 strict
 * sanitizer와 같은 정책을 공유한다 — 이 모듈은 정규식 기반 집행 메커니즘이다.
 */

import { decodeHtmlEntities } from './svg-policy-utils.internal';
import { CSS_URL_PRESENTATION_ATTRIBUTES, sanitizeCssValue, sanitizeUriValue } from './svg-threat-policy.internal';

/**
 * `href`/`xlink:href`/`src` 속성값을 lightweight 위협 정책으로 정제한다.
 *
 * 판정 규칙은 위협 정책 모듈(`svg-threat-policy.internal`)이 소유하고,
 * nested SVG 재귀 정제는 이 엔진 자신을 콜백으로 주입한다.
 *
 * @param value 원본 속성값
 * @param depth 현재 nested SVG 재귀 깊이
 * @returns 보존할 새 속성값(문자열) 또는 제거 의도(null)
 */
function sanitizeHrefValue(value: string, depth: number): string | null {
  return sanitizeUriValue(value, 'lightweight', depth, sanitizeSvgForRendering);
}

/**
 * CSS 정책 대상 속성 이름 alternation.
 *
 * `style`과 위협 정책의 presentation 속성 목록을 합친다. 긴 이름을 앞에 두어
 * `marker-end` 같은 이름이 `marker`로 부분 매치되지 않게 한다.
 */
const CSS_POLICY_ATTR_ALTERNATION = ['style', ...CSS_URL_PRESENTATION_ATTRIBUTES]
  .sort((a, b) => b.length - a.length)
  .join('|');

const CSS_ATTR_DOUBLE_QUOTE_PATTERN = new RegExp(`\\s+(${CSS_POLICY_ATTR_ALTERNATION})\\s*=\\s*"([^"]*)"`, 'gi');
const CSS_ATTR_SINGLE_QUOTE_PATTERN = new RegExp(`\\s+(${CSS_POLICY_ATTR_ALTERNATION})\\s*=\\s*'([^']*)'`, 'gi');
const CSS_ATTR_UNQUOTED_PATTERN = new RegExp(`\\s+(${CSS_POLICY_ATTR_ALTERNATION})\\s*=\\s*(?!["'])([^\\s>]+)`, 'gi');

/**
 * raw 텍스트 매체용 CSS 정제 — HTML 엔티티 가드를 씌운 위협 정책 정제.
 *
 * strict 엔진은 DOM이 엔티티를 디코드한 값을 정책에 넘기지만, 이 엔진은 파싱 전
 * 원문을 다루므로 엔티티로 숨긴 위협(`u&#x72;l(...)` 등)을 직접 가드해야 한다.
 * 엔티티 디코드로 위험 구문이 드러나면 값 전체를 폐기한다(fail-closed).
 *
 * @param css 원문 CSS 텍스트
 * @returns 위협 정책으로 정제된 CSS 텍스트
 */
function sanitizeRawCssText(css: string): string {
  const entityDecoded = decodeHtmlEntities(css);
  if (entityDecoded !== css && sanitizeCssValue(entityDecoded) !== entityDecoded) {
    return '';
  }
  return sanitizeCssValue(css);
}

/**
 * CSS 정책 대상 속성값을 위협 정책으로 정제해 속성 표현으로 되돌린다.
 *
 * 정제 결과가 비면 속성 제거 의도로 빈 문자열을 반환한다 (strict 엔진과 동일한 규칙).
 *
 * @param attrName 원본 속성 이름
 * @param cssValue 원본 CSS 값
 * @param quote 원본 인용부호 (무인용 입력은 큰따옴표로 재인용)
 * @returns 보존할 속성 문자열 또는 빈 문자열(속성 제거)
 */
function sanitizeCssAttribute(attrName: string, cssValue: string, quote: '"' | "'"): string {
  const sanitized = sanitizeRawCssText(cssValue).trim();
  return sanitized ? ` ${attrName}=${quote}${sanitized}${quote}` : '';
}

/**
 * 따옴표 안의 `>` 문자를 태그 종료로 오인하지 않도록 SVG 시작 태그를 순회하는 패턴이다.
 */
const SVG_START_TAG_PATTERN = /<([a-z][a-z0-9:-]*)(\b(?:[^"'<>]|"[^"]*"|'[^']*')*)(\/?)>/gi;

/**
 * SVG 문자열에서 위험 요소와 속성을 제거하는 경량 방어층(lightweight safety guard).
 *
 * **처리 순서:**
 * 1. `<script>...</script>` 또는 `<script ... />` 제거
 * 2. `<foreignObject>...</foreignObject>` 제거 (중첩 포함)
 * 3. `on*` 이벤트 핸들러 속성 제거
 * 4. `href`, `xlink:href`, `src` 속성 중 fragment·안전 data:image 외 값 제거
 * 5. `style`·presentation 속성 및 `<style>` 블록의 CSS 값 정제
 *
 * @param svgString 입력 SVG 문자열
 * @param depth nested `data:image/svg+xml` 재귀 깊이. 외부 호출은 항상 0(기본값) 사용.
 * @returns 위험 요소가 제거된 SVG 문자열
 *
 * @remarks
 * 이 함수는 정규식 기반의 경량 방어층이며, 완전한 보안 sanitizer가 아니다.
 * `processImage()`의 SVG 로딩 파이프라인을 보호하기 위해 알려진 위협 벡터의
 * 일부를 제거할 뿐이며, 신뢰할 수 없는 SVG를 완전히 안전하게 만들어주지 않는다.
 * 신뢰할 수 없는 SVG를 다루는 경우 `@cp949/web-image-util/svg-sanitizer`의
 * DOMPurify 기반 `sanitizeSvgStrict()`를 먼저 호출하는 것을 권장한다.
 */
export function sanitizeSvgForRendering(svgString: string, depth = 0): string {
  let result = svgString;

  // 1. <script> 요소 제거 — 자가 닫힘(`<script ... />`)과 블록 형태(`<script>...</script>`) 모두 처리한다
  // 자가 닫힘 먼저 제거해야 블록 패턴의 오탐을 줄일 수 있다
  result = result.replace(/<script\b[^>]*\/>/gi, '');
  result = result.replace(/<script\b[\s\S]*?<\/script\s*>/gi, '');

  // 2. <foreignObject> 요소 제거 — 중첩 HTML 삽입 벡터를 제거한다
  // 중첩된 foreignObject를 모두 제거하기 위해 반복 적용한다
  let prev: string;
  do {
    prev = result;
    result = result.replace(/<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi, '');
  } while (result !== prev);
  // 자가 닫힘 foreignObject도 처리한다
  result = result.replace(/<foreignObject\b[^>]*\/>/gi, '');

  // 3~5. 태그 내부 속성만 대상으로 위험 속성을 제거/정제한다.
  result = result.replace(SVG_START_TAG_PATTERN, (_match, tagName: string, attrs: string, selfClosing: string) => {
    const cleaned = attrs
      // 3. on* 이벤트 핸들러 속성 제거
      .replace(/\s+on[a-z0-9:-]+\s*=\s*"[^"]*"/gi, '')
      .replace(/\s+on[a-z0-9:-]+\s*=\s*'[^']*'/gi, '')
      .replace(/\s+on[a-z0-9:-]+\s*=\s*[^\s>]+/gi, '')
      // 4. href, xlink:href, src 속성 중 외부 URL 값을 제거하고, 안전한 data:image/* 참조는 보존한다
      .replace(/\s+((?:xlink:)?href|src)\s*=\s*"([^"]*)"/gi, (_attrMatch, attrName: string, value: string) => {
        const sanitizedValue = sanitizeHrefValue(value, depth);
        return sanitizedValue === null ? '' : ` ${attrName}="${sanitizedValue}"`;
      })
      .replace(/\s+((?:xlink:)?href|src)\s*=\s*'([^']*)'/gi, (_attrMatch, attrName: string, value: string) => {
        const sanitizedValue = sanitizeHrefValue(value, depth);
        return sanitizedValue === null ? '' : ` ${attrName}='${sanitizedValue}'`;
      })
      .replace(/\s+((?:xlink:)?href|src)\s*=\s*(?!["'])([^\s>]+)/gi, (_attrMatch, attrName: string, value: string) => {
        const sanitizedValue = sanitizeHrefValue(value, depth);
        return sanitizedValue === null ? '' : ` ${attrName}="${sanitizedValue}"`;
      })
      // 5. style·presentation 속성의 CSS 값을 위협 정책으로 정제한다
      .replace(CSS_ATTR_DOUBLE_QUOTE_PATTERN, (_attrMatch, attrName: string, cssValue: string) =>
        sanitizeCssAttribute(attrName, cssValue, '"')
      )
      .replace(CSS_ATTR_SINGLE_QUOTE_PATTERN, (_attrMatch, attrName: string, cssValue: string) =>
        sanitizeCssAttribute(attrName, cssValue, "'")
      )
      .replace(CSS_ATTR_UNQUOTED_PATTERN, (_attrMatch, attrName: string, cssValue: string) =>
        sanitizeCssAttribute(attrName, cssValue, '"')
      );

    return `<${tagName}${cleaned}${selfClosing}>`;
  });

  // 6. <style> 블록 본문을 위협 정책으로 정제한다
  result = result.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi,
    (_match, open: string, body: string, close: string) => {
      return `${open}${sanitizeRawCssText(body)}${close}`;
    }
  );

  return result;
}

/**
 * @deprecated 새 코드에서는 `sanitizeSvgForRendering()`을 사용하세요.
 * 이 함수는 보안 sanitizer가 아니라 SVG 렌더링 파이프라인 보호용 경량 guard입니다.
 */
export const sanitizeSvg = sanitizeSvgForRendering;
