/**
 * 그라디언트 중복 제거·병합 모듈.
 *
 * `linearGradient`/`radialGradient`를 DOM 파싱으로 수집한 뒤 정지점/속성 해시가
 * 같은 정의를 하나만 남기고, 사라진 ID를 참조하는 fill/stroke를 살아남은 ID로 갱신한다.
 * DOMParser가 없거나 파싱이 실패하면 원본을 그대로 반환한다.
 */

import { productionLog } from '../debug';

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

/** 중복 그라디언트가 제거된 뒤, 사라진 ID를 참조하는 fill/stroke를 살아남은 ID로 교체한다. */
function rewriteGradientReferences(doc: Document, replacementMap: Map<string, string>): void {
  for (const [oldId, newId] of replacementMap) {
    const elements = doc.querySelectorAll(`[fill="url(#${oldId})"], [stroke="url(#${oldId})"]`);
    for (const element of Array.from(elements)) {
      if (element.getAttribute('fill') === `url(#${oldId})`) {
        element.setAttribute('fill', `url(#${newId})`);
      }
      if (element.getAttribute('stroke') === `url(#${oldId})`) {
        element.setAttribute('stroke', `url(#${newId})`);
      }
    }
  }
}

/**
 * 그라디언트 중복을 제거하고 참조를 살아남은 ID로 병합한다.
 *
 * @param svgString 원본 SVG 문자열
 * @returns 그라디언트가 병합된 SVG 문자열(파서 미지원·파싱 실패 시 원본)
 */
export function optimizeGradients(svgString: string): string {
  try {
    // Node 환경 등 DOMParser 미지원 시 건너뛴다.
    if (typeof DOMParser === 'undefined') {
      productionLog.warn('DOMParser is not available in this environment. Skipping gradient optimization.');
      return svgString;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');

    // 파싱 실패 시 원본 유지.
    const errorNode = doc.querySelector('parsererror');
    if (errorNode) {
      return svgString;
    }

    const gradients = doc.querySelectorAll('linearGradient, radialGradient');
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

    rewriteGradientReferences(doc, replacementMap);

    return new XMLSerializer().serializeToString(doc);
  } catch (error) {
    productionLog.warn('Gradient optimization failed:', error);
    return svgString;
  }
}
