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

/** XML namespace declaration URI. `xmlns:*`를 참조 속성에서 제외하는 데 사용한다. */
const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';

/**
 * `href` / `xlink:href` / `src` 참조 속성 여부를 판정한다.
 *
 * lowered attribute 이름과 namespace 분리 후의 localName 양쪽으로 검사해
 * `xlink:href`처럼 prefix가 붙은 경우와 namespace 처리된 경우를 모두 잡는다.
 */
export function isReferenceAttribute(element: Element, attrName: string): boolean {
  const lowered = attrName.toLowerCase();
  if (lowered === 'href' || lowered === 'xlink:href' || lowered === 'src') return true;
  if (!lowered.endsWith(':href') && !lowered.endsWith(':src')) return false;

  const attribute = element.getAttributeNode(attrName);
  if (attribute === null || attribute.namespaceURI === XMLNS_NAMESPACE) return false;

  const localName = attribute.localName.toLowerCase();
  return localName === 'href' || localName === 'src';
}

/**
 * `href` / `xlink:href` / `src` 속성값을 전달된 qualified name 그대로 읽는다.
 * 같은 localName을 가진 다른 namespace 속성의 값을 대신 반환하지 않는다.
 */
export function readReferenceAttribute(element: Element, attrName: string): string | null {
  return element.getAttribute(attrName);
}
