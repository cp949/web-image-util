/**
 * 그라디언트 중복 제거·병합 모듈.
 *
 * `linearGradient`/`radialGradient`를 DOM 파싱으로 수집한 뒤 정지점/속성 해시가
 * 같은 정의를 하나만 남긴다. 사라진 ID를 참조하는 presentation/fragment 속성은
 * 살아남은 ID로 갱신한다.
 * DOMParser가 없거나 파싱이 실패하면 원본을 그대로 반환한다.
 */

import { productionLog } from '../debug.internal';
import { parseAndClassifySvg } from '../svg-document.internal';
import { rewriteReferencedIds } from './collect-referenced-ids.internal';

/** 그라디언트의 형태/속성/정지점을 합쳐 동일성 키를 만든다. */
function hashGradient(gradient: Element): string {
  const type = gradient.tagName;

  const stops = Array.from(gradient.querySelectorAll('stop'))
    .map((stop) => {
      const offset = stop.getAttribute('offset') || '0';
      const color = stop.getAttribute('stop-color') || '#000000';
      const opacity = stop.getAttribute('stop-opacity') || '1';
      return `${offset}:${color}:${opacity}`;
    })
    .join(',');

  // 그라디언트 방향/크기 등의 속성.
  const attrs = ['x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'fx', 'fy']
    .map((attr) => gradient.getAttribute(attr) || '')
    .filter((val) => val !== '')
    .join(',');

  return `${type}:${attrs}:${stops}`;
}

/**
 * 그라디언트 중복을 제거하고 참조를 살아남은 ID로 병합한다.
 *
 * @param svgString 원본 SVG 문자열
 * @returns 그라디언트가 병합된 SVG 문자열(파서 미지원·파싱 실패 시 원본)
 */
export function optimizeGradients(svgString: string): string {
  try {
    // 파싱 실패 시 원본 유지. Node 환경 등 파서 미가용은 경고 후 건너뛴다.
    const parsed = parseAndClassifySvg(svgString);
    if (!parsed.ok) {
      if (parsed.reason === 'domparser-unavailable') {
        productionLog.warn('DOMParser is not available in this environment. Skipping gradient optimization.');
      }
      return svgString;
    }
    const doc = parsed.doc;

    const gradients = doc.querySelectorAll('linearGradient, radialGradient');
    if (gradients.length === 0) {
      return svgString;
    }

    const gradientMap = new Map<string, Element>();
    const replacementMap = new Map<string, string>();

    // 동일 해시를 가진 그라디언트는 처음 발견된 것만 남기고 제거한다.
    for (const gradient of Array.from(gradients)) {
      const hash = hashGradient(gradient);
      const currentId = gradient.getAttribute('id');

      if (!currentId) continue;

      if (!gradientMap.has(hash)) {
        gradientMap.set(hash, gradient);
        continue;
      }

      const originalGradient = gradientMap.get(hash)!;
      const originalId = originalGradient.getAttribute('id');

      if (originalId) {
        replacementMap.set(currentId, originalId);
        gradient.remove();
      }
    }

    // 병합된 그라디언트가 없으면 참조를 재작성할 것도 없다. 직렬화를 건너뛰어
    // 마크업 정규화(자기닫힘 태그 등)로 인한 허위 diff를 방지한다.
    if (replacementMap.size === 0) {
      return svgString;
    }

    rewriteReferencedIds(doc, replacementMap);

    return new XMLSerializer().serializeToString(doc);
  } catch (error) {
    productionLog.warn('Gradient optimization failed:', error);
    return svgString;
  }
}
