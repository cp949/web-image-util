/**
 * 브라우저 환경에서 실제 SVG getBBox() 호출로 BBox를 측정하는 함수다.
 */

/** 현재 런타임이 브라우저(window+document 모두 존재)인지 판정한다. */
export function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * 임시 DOM 부착으로 native getBBox()를 호출해 정확한 BBox를 얻는다.
 *
 * @description path/text/transform/stroke-width까지 정확히 반영하지만
 * document.body 접근이 필요하므로 SSR/Node 환경에서는 사용할 수 없다.
 * 화면 밖 좌표에 임시 SVG를 부착했다가 finally 블록에서 반드시 제거한다.
 *
 * @param parsedRoot 측정 대상 SVG 루트 요소(SVGSVGElement)
 * @returns 측정에 성공하면 BBox, 실패하거나 비정상이면 null
 */
export function liveGetBBox(
  parsedRoot: SVGSVGElement
): { minX: number; minY: number; width: number; height: number } | null {
  const tmpSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  tmpSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  tmpSvg.setAttribute('width', '0');
  tmpSvg.setAttribute('height', '0');
  tmpSvg.style.position = 'absolute';
  tmpSvg.style.left = '-99999px';
  tmpSvg.style.top = '-99999px';
  tmpSvg.style.opacity = '0';
  document.body.appendChild(tmpSvg);

  const imported = document.importNode(parsedRoot, true) as SVGSVGElement;
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  imported.removeAttribute('width');
  imported.removeAttribute('height');
  // viewBox가 없으면 콘텐츠 클리핑을 막기 위해 충분히 큰 임시 viewBox를 둔다.
  if (!imported.hasAttribute('viewBox')) imported.setAttribute('viewBox', '0 0 100000 100000');
  while (imported.firstChild) g.appendChild(imported.firstChild);
  tmpSvg.appendChild(g);

  try {
    const bb = (g as unknown as SVGGraphicsElement).getBBox();
    const res = { minX: bb.x, minY: bb.y, width: bb.width, height: bb.height };
    return isValidBBox(res) ? res : null;
  } finally {
    document.body.removeChild(tmpSvg);
  }
}

/**
 * BBox가 유효한지(좌표가 유한이고 폭/높이가 양수인지) 검사한다.
 *
 * @param b 검사 대상 BBox
 * @returns 유효하면 true
 */
export function isValidBBox(b: { minX: number; minY: number; width: number; height: number }) {
  return Number.isFinite(b.minX) && Number.isFinite(b.minY) && b.width > 0 && b.height > 0;
}
