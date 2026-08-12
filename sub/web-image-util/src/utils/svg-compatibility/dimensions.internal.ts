/**
 * SVG 루트 요소에서 width/height 정보를 읽고 정제하는 보조 함수들이다.
 */

/**
 * SVG 루트의 width/height 단서를 attribute와 style에서 모두 모은다.
 *
 * @param root 검사 대상 SVG 루트 요소
 * @returns attribute가 우선이며, 없으면 style에서 추출한 값
 */
export function extractSizeHints(root: Element): { wAttr?: string; hAttr?: string } {
  const wAttr = root.getAttribute('width') ?? getStyleLength(root, 'width') ?? undefined;
  const hAttr = root.getAttribute('height') ?? getStyleLength(root, 'height') ?? undefined;
  return { wAttr, hAttr };
}

/**
 * 인라인 style 속성에서 특정 길이 프로퍼티 값만 잘라낸다.
 *
 * @param el 검사 대상 요소
 * @param prop 추출할 프로퍼티 이름(`width` | `height`)
 * @returns 매칭된 길이 문자열, 없으면 null
 */
export function getStyleLength(el: Element, prop: 'width' | 'height'): string | null {
  const style = el.getAttribute('style');
  if (!style) return null;
  const m = style.match(new RegExp(`${prop}\\s*:\\s*([^;]+)`, 'i'));
  return m?.[1]?.trim() ?? null;
}

/**
 * SVG 속성에 직렬화될 숫자를 안전한 형태로 정규화한다.
 *
 * @description 지수 표기(`1e-7` 등)를 피하고자 소수점 6자리 fixed로 자른다.
 * 유한값이 아니면 0으로 보정한다.
 *
 * @param n 원본 숫자
 * @returns 6자리 정밀도로 정리한 유한 숫자 또는 0
 */
export function sanitizeNum(n: number) {
  return Number.isFinite(n) ? parseFloat(n.toFixed(6)) : 0;
}
