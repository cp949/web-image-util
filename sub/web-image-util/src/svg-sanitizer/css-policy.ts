/**
 * CSS 값(style 속성, 일부 presentation 속성, `<style>` 본문)에 적용되는
 * strict sanitizer 정책.
 *
 * 외부 리소스 로딩과 위험 CSS 구문(`@import`, `expression()`, `-moz-binding`,
 * `image-set()` 등)을 보수적으로 제거하고, `url(#id)` 같은 문서 내부 참조만
 * 보존한다. CSS escape(예: `u\72l(...)`)도 디코드해 같은 정책으로 판정한다.
 */

import { isSafeInternalReference } from './reference-policy';

/**
 * CSS 값으로 해석되며 URL 참조를 가질 수 있는 SVG presentation 속성 목록.
 *
 * 모든 속성에 CSS 정제를 적용하면 `xmlns` 같은 네임스페이스 선언까지 외부 URL로
 * 오인할 수 있으므로, style 속성과 이 목록에 있는 속성만 CSS 정책 대상으로 삼는다.
 */
export const CSS_URL_PRESENTATION_ATTRIBUTES = new Set([
  'clip-path',
  'color-profile',
  'cursor',
  'fill',
  'filter',
  'marker',
  'marker-end',
  'marker-mid',
  'marker-start',
  'mask',
  'stroke',
]);

/**
 * CSS image-set 계열 함수 패턴.
 *
 * 상대 경로도 외부 리소스로 해석될 수 있으므로 함수 전체를 제거한다.
 */
const CSS_IMAGE_SET_FUNCTION_PATTERN = /(?:-webkit-)?image-set\s*\([^)]*\)/gi;

/**
 * CSS url() 값에서 허용할 수 있는 내부 참조인지 판정한다.
 *
 * @param value url(...) 내부 값
 * @returns 내부 프래그먼트 참조이면 true
 */
function isSafeCssUrl(value: string): boolean {
  return isSafeInternalReference(value.replace(/^['"]|['"]$/g, ''));
}

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
 * CSS 값 내부에 외부 URL 문자열이 직접 포함되어 있는지 판정한다.
 *
 * `image-set("https://...")`처럼 `url(...)`을 쓰지 않는 CSS 함수도 외부 리소스를
 * 로드할 수 있으므로, strict sanitizer는 CSS 값 안의 명시적인 외부 URL 문자열을
 * 보수적으로 제거한다.
 *
 * @param css CSS 문자열
 * @returns 외부 URL 문자열이 있으면 true
 */
function hasExternalUrlLiteral(css: string): boolean {
  return /(?:https?:|file:|data:|blob:|ftp:|\/\/)/i.test(css);
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
      hasExternalUrlLiteral(decodedForPolicy));

  if (hasDecodedDangerousCss) {
    return '';
  }

  const sanitizedCss = css
    .replace(/@import\b[^;]*(?:;|$)/gi, '')
    .replace(CSS_IMAGE_SET_FUNCTION_PATTERN, '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/-moz-binding\s*:[^;]*(?:;|$)/gi, '')
    .replace(/url\s*\(\s*("([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi, (match, _raw, doubleQuoted, singleQuoted, unquoted) => {
      const urlValue = doubleQuoted ?? singleQuoted ?? unquoted ?? '';
      return isSafeCssUrl(urlValue) ? match : 'none';
    });

  return hasExternalUrlLiteral(sanitizedCss) ? '' : sanitizedCss;
}
