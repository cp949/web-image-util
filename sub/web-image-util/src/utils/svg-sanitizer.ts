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
 * - `href`, `xlink:href`, `src` 속성 중 외부 URL을 가리키는 것
 *   (http://, https://, //..., data:, javascript: — 프래그먼트 참조 `#id`는 보존)
 * - `style` 속성 또는 `<style>` 본문 안의 외부 `url(...)` 참조
 */

import { replaceCssUrlValues } from './svg-policy-utils.internal';
import { isAllowedCssUrl, sanitizeUriValue } from './svg-threat-policy.internal';

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
 * CSS 텍스트(style 속성값 또는 `<style>` 블록 본문)에서 외부 `url()` 참조를 제거한다.
 *
 * 판정은 위협 정책 모듈의 `isAllowedCssUrl(..., 'lightweight')`가 담당한다.
 * 대체값: `url(#invalid)` — 내부 참조 형식이지만 실제로 존재하지 않아 렌더링에 영향을 주지 않는다.
 *
 * @param css 처리할 CSS 텍스트
 * @returns 외부 url() 참조가 제거된 CSS 텍스트
 */
function stripExternalCssUrls(css: string): string {
  return replaceCssUrlValues(css, (value, match) =>
    isAllowedCssUrl(value.trim(), 'lightweight') ? match : 'url(#invalid)'
  );
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
 * 4. `href`, `xlink:href`, `src` 속성 중 외부 URL 값 제거
 * 5. `style` 속성 및 `<style>` 블록 내 외부 `url()` 참조 제거
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
      // 5. style 속성 내 외부 url() 참조를 제거한다
      .replace(/\s+style\s*=\s*"([^"]*)"/gi, (_attrMatch, cssValue: string) => {
        const cleanedCss = stripExternalCssUrls(cssValue);
        return ` style="${cleanedCss}"`;
      })
      .replace(/\s+style\s*=\s*'([^']*)'/gi, (_attrMatch, cssValue: string) => {
        const cleanedCss = stripExternalCssUrls(cssValue);
        return ` style='${cleanedCss}'`;
      })
      .replace(/\s+style\s*=\s*(?!["'])([^\s>]+)/gi, (_attrMatch, cssValue: string) => {
        const cleanedCss = stripExternalCssUrls(cssValue);
        return ` style="${cleanedCss}"`;
      });

    return `<${tagName}${cleaned}${selfClosing}>`;
  });

  // 6. <style> 블록 본문 내 외부 url() 참조를 제거한다
  result = result.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi,
    (_match, open: string, body: string, close: string) => {
      return `${open}${stripExternalCssUrls(body)}${close}`;
    }
  );

  return result;
}

/**
 * @deprecated 새 코드에서는 `sanitizeSvgForRendering()`을 사용하세요.
 * 이 함수는 보안 sanitizer가 아니라 SVG 렌더링 파이프라인 보호용 경량 guard입니다.
 */
export const sanitizeSvg = sanitizeSvgForRendering;
