/**
 * CSS 값(style 속성, 일부 presentation 속성, `<style>` 본문)에 적용되는
 * strict sanitizer 정책 어댑터.
 *
 * 판정 규칙(대상 속성 목록, url() 허용 판정, 외부 URL 리터럴, image-set 패턴)은
 * 위협 정책 모듈(`utils/svg-threat-policy.internal`)이 소유한다. 이 모듈은
 * 외부 리소스 로딩과 위험 CSS 구문(`@import`, `expression()`, `-moz-binding`,
 * `image-set()` 등)을 보수적으로 제거하는 문자열 메커니즘을 담당한다.
 * CSS escape(예: `u\72l(...)`)도 디코드해 같은 정책으로 판정한다.
 */

import {
  CSS_URL_PRESENTATION_ATTRIBUTES,
  createCssImageSetFunctionPattern,
  hasExternalCssUrlLiteral,
  isAllowedCssUrl,
} from '../utils/svg-threat-policy.internal';

export { CSS_URL_PRESENTATION_ATTRIBUTES };

/**
 * CSS escape를 정책 비교용 문자열로 복원한다.
 *
 * 브라우저 CSS 파서는 `u\72l(...)` 같은 escape를 `url(...)`로 해석할 수 있으므로,
 * 위험 함수 판정 전에 최소한의 CSS escape 디코딩을 수행한다.
 *
 * @param css CSS 문자열
 * @returns 정책 비교용으로 CSS escape가 복원된 문자열
 */
function decodeCssEscapesForPolicy(css: string): string {
  return css.replace(/\\([0-9a-f]{1,6}\s?|.)/gi, (_match, escaped: string) => {
    const hex = escaped.trim();
    if (/^[0-9a-f]{1,6}$/i.test(hex)) {
      try {
        return String.fromCodePoint(Number.parseInt(hex, 16));
      } catch {
        return '';
      }
    }

    return escaped;
  });
}

/**
 * 속성값에 CSS URL 정책을 적용해야 하는지 판정한다.
 *
 * @param attribute 검사 대상 속성
 * @returns CSS 정제 대상 속성이면 true
 */
export function shouldSanitizeCssAttribute(attribute: Attr): boolean {
  const name = attribute.name.toLowerCase();
  const localName = attribute.localName.toLowerCase();

  return (
    name === 'style' || CSS_URL_PRESENTATION_ATTRIBUTES.has(name) || CSS_URL_PRESENTATION_ATTRIBUTES.has(localName)
  );
}

/**
 * style 속성 또는 `<style>` 본문에서 외부 참조와 위험 CSS 구문을 제거한다.
 *
 * CSS 파서는 환경별 차이가 있어 여기서는 strict sanitizer의 필수 차단 항목만
 * 보수적인 문자열 정책으로 제거한다. `url(#id)` 같은 내부 참조만 보존하고,
 * `image-set("https://...")`처럼 외부 URL 문자열을 직접 받는 CSS 함수는
 * 속성/본문 단위로 제거한다.
 *
 * @param css CSS 문자열
 * @returns 위험 참조가 제거된 CSS 문자열
 */
export function sanitizeCssValue(css: string): string {
  const decodedForPolicy = decodeCssEscapesForPolicy(css);
  const hasDecodedDangerousCss =
    decodedForPolicy !== css &&
    (/@import\b/i.test(decodedForPolicy) ||
      /expression\s*\(/i.test(decodedForPolicy) ||
      /-moz-binding\s*:/i.test(decodedForPolicy) ||
      /url\s*\(/i.test(decodedForPolicy) ||
      /(?:-webkit-)?image-set\s*\(/i.test(decodedForPolicy) ||
      hasExternalCssUrlLiteral(decodedForPolicy));

  if (hasDecodedDangerousCss) {
    return '';
  }

  const sanitizedCss = css
    .replace(/@import\b[^;]*(?:;|$)/gi, '')
    .replace(createCssImageSetFunctionPattern(), '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/-moz-binding\s*:[^;]*(?:;|$)/gi, '')
    .replace(/url\s*\(\s*("([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi, (match, _raw, doubleQuoted, singleQuoted, unquoted) => {
      const urlValue = doubleQuoted ?? singleQuoted ?? unquoted ?? '';
      return isAllowedCssUrl(urlValue, 'strict') ? match : 'none';
    });

  return hasExternalCssUrlLiteral(sanitizedCss) ? '' : sanitizedCss;
}
