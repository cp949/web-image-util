/**
 * 미사용 `<defs>` 정의 제거 모듈.
 *
 * `<defs>` 안의 ID 목록을 수집한 뒤, 문서 전체에서 fill/stroke/filter/clip-path/mask/
 * marker-start/marker-mid/marker-end 또는 `href="#id"` 형태로 참조되지 않는 정의만
 * 제거한다. 비워진 `<defs>`도 같이 제거된다. DOMParser가 없거나 파싱이 실패하면
 * 원본을 그대로 반환한다.
 */

import { productionLog } from '../debug';

/** ID 하나가 문서에서 참조되는지 검사할 때 사용할 속성 셀렉터 목록. */
const REFERENCE_ATTRIBUTES = [
  'fill',
  'stroke',
  'filter',
  'clip-path',
  'mask',
  'marker-start',
  'marker-mid',
  'marker-end',
] as const;

/** 주어진 `<defs>` 노드에서 ID를 가진 자식 ID 집합을 반환한다. */
function collectDefinedIds(defs: Element): Set<string> {
  const definedIds = new Set<string>();
  for (const element of Array.from(defs.querySelectorAll('[id]'))) {
    const id = element.getAttribute('id');
    if (id) definedIds.add(id);
  }
  return definedIds;
}

/** 문서 전체에서 실제로 사용되는 ID 집합을 반환한다. */
function collectUsedIds(documentRoot: Element, definedIds: Set<string>): Set<string> {
  const usedIds = new Set<string>();

  for (const id of definedIds) {
    const selectors = REFERENCE_ATTRIBUTES.map((attr) => `[${attr}="url(#${id})"]`).concat(`[href="#${id}"]`);
    const references = documentRoot.querySelectorAll(selectors.join(', '));
    if (references.length > 0) {
      usedIds.add(id);
    }
  }

  return usedIds;
}

/**
 * `<defs>` 안의 미사용 정의를 제거한다.
 *
 * @param svgString 원본 SVG 문자열
 * @returns 미사용 정의가 제거된 SVG 문자열(파서 미지원·파싱 실패 시 원본)
 */
export function removeUnusedDefs(svgString: string): string {
  try {
    if (typeof DOMParser === 'undefined') {
      productionLog.warn('DOMParser is not available in this environment. Skipping unused definitions removal.');
      return svgString;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');

    const errorNode = doc.querySelector('parsererror');
    if (errorNode) {
      return svgString;
    }

    const defs = doc.querySelector('defs');
    if (!defs) {
      return svgString;
    }

    const definedIds = collectDefinedIds(defs);
    const usedIds = collectUsedIds(doc.documentElement, definedIds);

    // 사용되지 않는 정의만 제거.
    for (const id of definedIds) {
      if (usedIds.has(id)) continue;
      const unusedElement = defs.querySelector(`[id="${id}"]`);
      if (unusedElement) {
        unusedElement.remove();
      }
    }

    // 비워진 defs는 함께 제거.
    if (defs.children.length === 0) {
      defs.remove();
    }

    return new XMLSerializer().serializeToString(doc);
  } catch (error) {
    productionLog.warn('Unused definitions removal failed:', error);
    return svgString;
  }
}
