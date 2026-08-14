/**
 * SVG 문서에서 "이 id가 참조되는가"를 판정하는 단일 모듈.
 *
 * 두 가지 참조 형태를 모두 본다.
 * - CSS `url(#id)` 스타일: `fill`/`stroke`/`filter`/`clip-path`/`mask`/`marker-start`/
 *   `marker-mid`/`marker-end` 같은 presentation 속성 값이 `url(#id)`인 경우.
 * - fragment 속성 스타일: `href`/`xlink:href`/`src` 값이 `#id`(내부 참조)인 경우 —
 *   `prefix-svg-ids`의 판정 로직을 그대로 재사용해 네임스페이스(`xlink:href`)까지 인지한다.
 *
 * `<style>` 태그·`style` 속성 내부 CSS의 `url(#id)`는 비범위다(`prefix-svg-ids`와 동일 정책).
 */

import {
  classifyFragmentReference,
  REF_ATTR_NAMES,
  readReferenceAttribute,
} from '../prefix-svg-ids/reference-rewrite.internal';

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

/** 속성 값이 `url(#id)` 형태(따옴표·fallback 색상 포함)이면 id를 반환하고, 아니면 null을 반환한다. */
function extractUrlReferenceId(value: string): string | null {
  const match = /^url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/.exec(value.trim());
  return match ? match[1] : null;
}

/**
 * 문서 전체에서 실제로 참조되는 id 집합을 반환한다.
 *
 * @param doc 파싱된 SVG 문서
 * @returns 참조되는 id의 집합(정의 여부와 무관 — 대상이 실존하지 않는 dangling 참조의 id도 포함된다)
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
      const lowered = attrName.toLowerCase();
      if (!REF_ATTR_NAMES.has(lowered)) continue;
      const value = readReferenceAttribute(el, attrName, lowered);
      if (value === null) continue;
      const classification = classifyFragmentReference(value);
      if (classification.kind === 'internal') {
        referenced.add(classification.token);
      }
    }
  }

  return referenced;
}
