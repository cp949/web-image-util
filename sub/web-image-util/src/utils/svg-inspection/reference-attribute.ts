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
 * 폴백한다. DOM 보안 신호 수집과 embedded image stage 수집이 동일 규칙으로 공유한다.
 */
export function readReferenceAttribute(element: Element, attrName: string): string | null {
  if (attrName.toLowerCase() === 'xlink:href') {
    const ns = element.getAttributeNS(XLINK_NAMESPACE, 'href');
    if (ns !== null) return ns;
  }
  return element.getAttribute(attrName);
}
