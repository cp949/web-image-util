// ── 정상 SVG ──────────────────────────────────────────────────────────────

/** xmlns 선언만 있는 최소 SVG */
export const VALID_SVG = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

/** rect 요소를 포함한 기본 SVG */
export const VALID_SVG_WITH_RECT = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';

/** 크기가 명시된 SVG */
export const VALID_SVG_WITH_DIMENSIONS =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';

// ── 공격 벡터 SVG ──────────────────────────────────────────────────────────

/** script 태그 주입 */
export const XSS_SVG_SCRIPT =
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>';

/** onload 이벤트 핸들러 + script 태그 조합 (가장 빈번하게 쓰이는 XSS 벡터) */
export const XSS_SVG_ONLOAD_WITH_SCRIPT =
  '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect width="10" height="10"/></svg>';

/** onload 이벤트 핸들러만 포함 */
export const XSS_SVG_ONLOAD =
  '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="10" height="10"/></svg>';

/** foreignObject를 통한 HTML 삽입 */
export const XSS_SVG_FOREIGN_OBJECT =
  '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="100" height="100">' +
  '<div xmlns="http://www.w3.org/1999/xhtml">XSS</div>' +
  '</foreignObject><rect width="10" height="10"/></svg>';

/** 외부 스크립트 src 참조 */
export const XSS_SVG_SCRIPT_SRC =
  '<svg xmlns="http://www.w3.org/2000/svg"><script src="evil.js"/><rect width="10" height="10"/></svg>';

// ── 사이즈 제한 테스트용 팩토리 ────────────────────────────────────────────

/** SVG_LIMIT_BYTES(10MB)를 초과하는 SVG 문자열을 생성한다 */
export function makeLargeSvg(minBytes: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg"><!-- ${'a'.repeat(minBytes)} --><rect/></svg>`;
}

/** UTF-8 바이트 수가 minBytes를 초과하는 SVG를 다국어 문자로 생성한다 */
export function makeLargeSvgMultibyte(charCount: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg"><text>${'가'.repeat(charCount)}</text></svg>`;
}
