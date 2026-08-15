/**
 * SVG 참조 속성 판정 — 라이브러리 전체의 단일 소유자.
 *
 * `href`/`xlink:href`/`src` attribute가 다른 요소·외부 자원에 대한 참조를 담는지
 * 판정한다. lowered 이름과 namespace 분리 후의 localName 양쪽을 검사해 임의
 * prefix로 선언된 xlink:href(예: `xmlns:foo` + `foo:href`)도 잡는다.
 *
 * "그 참조가 위협인가"를 다루는 참조 판정(uri ref verdict, svg-threat-policy.internal.ts)
 * 보다 한 단계 앞선 구조적 사실이며, 판정 자체와는 무관하다.
 *
 * 이 모듈은 public export가 아니다(`package.json` exports 비대상).
 */

/** xlink namespace URI. happy-dom과 브라우저 모두에서 동일하다. */
export const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';

/**
 * `href` / `xlink:href` / `src` 참조 속성 여부를 판정한다.
 *
 * lowered attribute 이름과 namespace 분리 후의 localName 양쪽으로 검사해
 * `xlink:href`처럼 prefix가 붙은 경우와 namespace 처리된 경우를 모두 잡는다.
 */
export function isReferenceAttribute(element: Element, attrName: string): boolean {
  const lowered = attrName.toLowerCase();
  const localName = element.getAttributeNode(attrName)?.localName.toLowerCase() ?? lowered;
  return (
    lowered === 'href' || lowered === 'xlink:href' || lowered === 'src' || localName === 'href' || localName === 'src'
  );
}

/**
 * `href` / `xlink:href` / `src` 속성값을 namespace 우선으로 읽는다.
 *
 * `xlink:href`는 `getAttributeNS`로 먼저 조회하고, namespace 조회가 비면 일반 `getAttribute`로
 * 폴백한다.
 */
export function readReferenceAttribute(element: Element, attrName: string): string | null {
  if (attrName.toLowerCase() === 'xlink:href') {
    const ns = element.getAttributeNS(XLINK_NAMESPACE, 'href');
    if (ns !== null) return ns;
  }
  return element.getAttribute(attrName);
}
