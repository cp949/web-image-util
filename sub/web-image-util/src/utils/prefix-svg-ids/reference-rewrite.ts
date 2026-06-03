/** xlink namespace URI. xlink:href attribute 처리에 사용한다. */
export const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';

/** fragment reference를 담을 수 있는 attribute 이름 집합(소문자 기준). */
export const REF_ATTR_NAMES = new Set<string>(['href', 'xlink:href', 'src']);

/**
 * element에서 reference attribute 값을 읽는다.
 * xlink:href는 getAttributeNS를 우선 시도하고, 없으면 getAttribute로 폴백한다.
 */
export function readReferenceAttribute(element: Element, attrName: string, lowered: string): string | null {
  if (lowered === 'xlink:href') {
    const nsVal = element.getAttributeNS(XLINK_NAMESPACE, 'href');
    if (nsVal !== null) return nsVal;
    return element.getAttribute(attrName);
  }
  return element.getAttribute(attrName);
}

/**
 * element의 reference attribute를 새 값으로 쓴다.
 * xlink:href는 setAttributeNS를 사용해 namespace를 보존한다.
 */
export function writeReferenceAttribute(element: Element, attrName: string, lowered: string, newValue: string): void {
  if (lowered === 'xlink:href') {
    element.setAttributeNS(XLINK_NAMESPACE, attrName, newValue);
  } else {
    element.setAttribute(attrName, newValue);
  }
}

/** classifyFragmentReference 반환 — internal은 token까지 함께 노출해 호출부 trim 중복을 제거한다. */
export type ClassifiedReference = { kind: 'internal'; token: string } | { kind: 'external' } | { kind: 'non-fragment' };

/**
 * attribute 값이 내부 fragment 참조인지, 외부 fragment 참조인지, 비fragment인지 분류한다.
 * - `#token` (token 비어있지 않음) → 'internal' + token(trim된 값)
 * - `prefix#frag` (# 앞에 비어있지 않은 prefix) → 'external'
 * - 그 외 → 'non-fragment'
 */
export function classifyFragmentReference(value: string): ClassifiedReference {
  const trimmed = value.trim();
  if (trimmed.startsWith('#')) {
    if (trimmed.length > 1) return { kind: 'internal', token: trimmed.slice(1) };
    return { kind: 'non-fragment' };
  }
  if (trimmed.indexOf('#') > 0) return { kind: 'external' };
  return { kind: 'non-fragment' };
}

/**
 * doc 내 모든 요소의 href/xlink:href/src attribute에서 fragment 참조를 찾아 rewrite한다.
 * idSet은 rewrite 전 doc의 원본 id 집합으로 dangling 판정 기준이다.
 */
export function rewriteFragmentReferences(
  doc: Document,
  rewrites: Map<string, string>,
  idSet: Set<string>
): { rewrittenCount: number; danglingCount: number; externalCount: number } {
  let rewrittenCount = 0;
  let danglingCount = 0;
  let externalCount = 0;

  const all = doc.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    for (const attrName of el.getAttributeNames()) {
      const lowered = attrName.toLowerCase();
      if (!REF_ATTR_NAMES.has(lowered)) continue;

      const value = readReferenceAttribute(el, attrName, lowered);
      if (value === null) continue;

      const classification = classifyFragmentReference(value);
      if (classification.kind === 'non-fragment') continue;
      if (classification.kind === 'external') {
        externalCount += 1;
        continue;
      }

      // internal
      const token = classification.token;
      if (!idSet.has(token)) {
        danglingCount += 1;
        continue;
      }
      const newId = rewrites.get(token);
      if (newId !== undefined) {
        writeReferenceAttribute(el, attrName, lowered, `#${newId}`);
        rewrittenCount += 1;
      }
      // idSet에 있지만 rewrites에 없으면(idempotent 등) 아무것도 하지 않음
    }
  }

  return { rewrittenCount, danglingCount, externalCount };
}
