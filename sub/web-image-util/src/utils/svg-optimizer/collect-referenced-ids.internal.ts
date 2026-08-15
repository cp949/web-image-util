/**
 * SVG 문서에서 "이 id가 참조되는가"를 판정하는 단일 모듈.
 *
 * 두 가지 참조 형태를 모두 본다.
 * - CSS `url(#id)` 스타일: `fill`/`stroke`/`filter`/`clip-path`/`mask`/`marker-start`/
 *   `marker-mid`/`marker-end` 같은 presentation 속성 값이 `url(#id)`인 경우.
 * - fragment 속성 스타일: `href`/`xlink:href`/`src` 값이 `#id`(내부 참조)인 경우 —
 *   공유 leaf(`svg-reference-attribute.internal.ts`)의 판정을 재사용해 네임스페이스까지 인지한다.
 *
 * `<style>` 태그·`style` 속성 내부 CSS의 `url(#id)`는 비범위다(`prefix-svg-ids`와 동일 정책).
 */

import { classifyFragmentReference, rewriteFragmentReferences } from '../prefix-svg-ids/reference-rewrite.internal';
import { isReferenceAttribute, readReferenceAttribute } from '../svg-reference-attribute.internal';

/** url(#id) 형태로 참조될 수 있는 presentation 속성 목록. */
const URL_REFERENCE_ATTRIBUTES = [
  'fill',
  'stroke',
  'filter',
  'clip-path',
  'mask',
  'marker-start',
  'marker-mid',
  'marker-end',
] as const;

/** 따옴표와 닫는 괄호를 보존하면서 presentation 속성의 첫 `url(#id)`를 분해한다. */
const URL_REFERENCE_PATTERN = /^(\s*url\(\s*)(['"]?)#([^'")\s]+)\2(\s*\))/;

/**
 * 속성 값이 `url(#id)` 형태(따옴표·fallback 색상 포함)이면 id를 반환한다.
 * 그 외 값이면 null을 반환한다.
 */
function extractUrlReferenceId(value: string): string | null {
  const match = URL_REFERENCE_PATTERN.exec(value.trim());
  return match ? match[3] : null;
}

/**
 * 문서 전체에서 실제로 참조되는 id 집합을 반환한다.
 *
 * @param doc 파싱된 SVG 문서
 * @returns 참조되는 id의 집합. 정의 여부와 무관하므로 dangling 참조의 id도 포함된다.
 */
export function collectReferencedIds(doc: Document): Set<string> {
  const referenced = new Set<string>();
  const all = doc.getElementsByTagName('*');

  for (let i = 0; i < all.length; i++) {
    const el = all[i];

    // url(#id) 형태(presentation 속성).
    for (const attr of URL_REFERENCE_ATTRIBUTES) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      const id = extractUrlReferenceId(value);
      if (id) referenced.add(id);
    }

    // href/xlink:href/src 형태(fragment 속성) — prefix-svg-ids 판정을 재사용한다.
    for (const attrName of el.getAttributeNames()) {
      if (!isReferenceAttribute(el, attrName)) continue;
      const value = readReferenceAttribute(el, attrName);
      if (value === null) continue;
      const classification = classifyFragmentReference(value);
      if (classification.kind === 'internal') {
        referenced.add(classification.token);
      }
    }
  }

  return referenced;
}

/**
 * 문서 전체의 내부 id 참조를 replacement map에 따라 다시 쓴다.
 *
 * presentation 속성은 기존 따옴표와 fallback 값을 보존한다. `href`/`xlink:href`/`src`는
 * `prefix-svg-ids`의 네임스페이스 인지 재작성 로직을 재사용한다.
 */
export function rewriteReferencedIds(doc: Document, replacements: Map<string, string>): void {
  const all = doc.getElementsByTagName('*');

  for (let i = 0; i < all.length; i++) {
    const el = all[i];

    for (const attr of URL_REFERENCE_ATTRIBUTES) {
      const value = el.getAttribute(attr);
      if (value === null) continue;

      const match = URL_REFERENCE_PATTERN.exec(value);
      if (match === null) continue;

      const replacement = replacements.get(match[3]);
      if (replacement === undefined) continue;

      el.setAttribute(
        attr,
        value.replace(
          URL_REFERENCE_PATTERN,
          (_matched, prefix, quote, _id, suffix) => `${prefix}${quote}#${replacement}${quote}${suffix}`
        )
      );
    }
  }

  rewriteFragmentReferences(doc, replacements, new Set(replacements.keys()));
}
