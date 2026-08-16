/**
 * 미사용 `<defs>` 정의 제거 모듈.
 *
 * `<defs>` 안의 ID 목록을 수집한 뒤, 문서 전체에서 실제로 참조되는 id인지
 * `collectReferencedIds()`(fill/stroke/filter/clip-path/mask/marker-* 의 `url(#id)`,
 * href/xlink:href/src의 fragment 참조)로 판정해 참조되지 않는 정의만 제거한다.
 * 비워진 `<defs>`도 같이 제거된다. DOMParser가 없거나 파싱이 실패하면 원본을
 * 그대로 반환한다.
 */

import { productionLog } from '../debug.internal';
import { parseAndClassifySvg } from '../svg-document.internal';
import { collectReferencedIds } from './collect-referenced-ids.internal';

/** 주어진 `<defs>` 노드에서 ID를 가진 자식 ID 집합을 반환한다. */
function collectDefinedIds(defs: Element): Set<string> {
  const definedIds = new Set<string>();
  for (const element of Array.from(defs.querySelectorAll('[id]'))) {
    const id = element.getAttribute('id');
    if (id) definedIds.add(id);
  }
  return definedIds;
}

/**
 * `<defs>` 안의 미사용 정의를 제거한다.
 *
 * @param svgString 원본 SVG 문자열
 * @returns 미사용 정의가 제거된 SVG 문자열(파서 미지원·파싱 실패 시 원본)
 */
export function removeUnusedDefs(svgString: string): string {
  try {
    // 파싱 실패 시 원본 유지. 파서 미가용은 경고 후 건너뛴다.
    const parsed = parseAndClassifySvg(svgString);
    if (!parsed.ok) {
      if (parsed.reason === 'domparser-unavailable') {
        productionLog.warn('DOMParser is not available in this environment. Skipping unused definitions removal.');
      }
      return svgString;
    }
    const doc = parsed.doc;

    const defs = doc.querySelector('defs');
    if (!defs) {
      return svgString;
    }

    const definedIds = collectDefinedIds(defs);
    const usedIds = collectReferencedIds(doc);
    const unusedIds = Array.from(definedIds).filter((id) => !usedIds.has(id));

    // 제거 대상이 없고 defs에 자식이 남아있다면(=애초에 빈 defs가 아니었다면) 변경 없음.
    // defs가 이미 비어 있던 입력은 아래 "비워진 defs 제거" 경로로 계속 진행해야 한다.
    if (unusedIds.length === 0 && defs.children.length > 0) {
      return svgString;
    }

    // 사용되지 않는 정의만 제거.
    for (const id of unusedIds) {
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
