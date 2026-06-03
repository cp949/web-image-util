/**
 * 휴리스틱 기반 BBox 계산과 패딩 보조 함수다.
 *
 * @description DOM 조회·정규식 파싱만으로 근사 BBox를 만든다.
 * 전체 SVG 렌더링 없이 동작하므로 SSR/Node 환경에서도 안전하다.
 */

/**
 * SVG 마크업 문자열에서 정규식만으로 근사 BBox를 추출한다.
 *
 * @description DOM 파싱이 실패하거나 사용할 수 없는 환경에서 마지막 폴백으로 쓴다.
 * `<circle>`과 `<rect>`만 인식하며, 중첩이나 transform은 무시한다.
 *
 * @param svgString 분석할 원본 SVG 마크업
 * @returns 인식된 도형의 BBox, 도형이 하나도 없으면 null
 */
export function heuristicBBoxFromString(
  svgString: string
): { minX: number; minY: number; width: number; height: number } | null {
  let minX = +Infinity,
    minY = +Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  const push = (x1: number, y1: number, x2: number, y2: number) => {
    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return;
    minX = Math.min(minX, x1, x2);
    minY = Math.min(minY, y1, y2);
    maxX = Math.max(maxX, x1, x2);
    maxY = Math.max(maxY, y1, y2);
  };

  // <circle> 좌표 추출
  const circleRegex =
    /<circle[^>]*cx=["']?([^"'\s]+)["']?[^>]*cy=["']?([^"'\s]+)["']?[^>]*r=["']?([^"'\s]+)["']?[^>]*\/?>/gi;
  let circleMatch = circleRegex.exec(svgString);
  while (circleMatch !== null) {
    const cx = parseFloat(circleMatch[1]);
    const cy = parseFloat(circleMatch[2]);
    const r = parseFloat(circleMatch[3]);
    if (r > 0) push(cx - r, cy - r, cx + r, cy + r);
    circleMatch = circleRegex.exec(svgString);
  }

  // <rect> 좌표 추출
  const rectRegex =
    /<rect[^>]*x=["']?([^"'\s]+)["']?[^>]*y=["']?([^"'\s]+)["']?[^>]*width=["']?([^"'\s]+)["']?[^>]*height=["']?([^"'\s]+)["']?[^>]*\/?>/gi;
  let rectMatch = rectRegex.exec(svgString);
  while (rectMatch !== null) {
    const x = parseFloat(rectMatch[1]);
    const y = parseFloat(rectMatch[2]);
    const w = parseFloat(rectMatch[3]);
    const h = parseFloat(rectMatch[4]);
    if (w > 0 && h > 0) push(x, y, x + w, y + h);
    rectMatch = rectRegex.exec(svgString);
  }

  if (minX === +Infinity || minY === +Infinity || maxX === -Infinity || maxY === -Infinity) {
    return null;
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

/**
 * 단순 SVG 도형의 속성만으로 BBox를 근사 계산한다.
 *
 * @description DOM 쿼리와 attribute 파싱만 사용하므로 layout 엔진 없이 동작한다.
 * 지원: rect, circle, ellipse, line, polyline, polygon.
 * 비지원(무시): path, text, filter/mask/marker, transform.
 * 비지원 요소를 보완하려면 paddingPercent로 안전 마진을 둘 것.
 *
 * @param root 분석 대상 SVG 루트 요소
 * @returns 측정 가능한 도형이 있으면 BBox, 없으면 null
 */
export function heuristicBBox(root: Element): { minX: number; minY: number; width: number; height: number } | null {
  let minX = +Infinity,
    minY = +Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  const push = (x1: number, y1: number, x2: number, y2: number) => {
    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return;
    minX = Math.min(minX, x1, x2);
    minY = Math.min(minY, y1, y2);
    maxX = Math.max(maxX, x1, x2);
    maxY = Math.max(maxY, y1, y2);
  };

  // rect
  root.querySelectorAll('rect').forEach((el) => {
    const x = parseFloat(el.getAttribute('x') || '0');
    const y = parseFloat(el.getAttribute('y') || '0');
    const w = parseFloat(el.getAttribute('width') || '0');
    const h = parseFloat(el.getAttribute('height') || '0');
    if (w > 0 && h > 0) push(x, y, x + w, y + h);
  });

  // circle
  root.querySelectorAll('circle').forEach((el) => {
    const cx = parseFloat(el.getAttribute('cx') || '0');
    const cy = parseFloat(el.getAttribute('cy') || '0');
    const r = parseFloat(el.getAttribute('r') || '0');
    if (r > 0) push(cx - r, cy - r, cx + r, cy + r);
  });

  // ellipse
  root.querySelectorAll('ellipse').forEach((el) => {
    const cx = parseFloat(el.getAttribute('cx') || '0');
    const cy = parseFloat(el.getAttribute('cy') || '0');
    const rx = parseFloat(el.getAttribute('rx') || '0');
    const ry = parseFloat(el.getAttribute('ry') || '0');
    if (rx > 0 && ry > 0) push(cx - rx, cy - ry, cx + rx, cy + ry);
  });

  // line
  root.querySelectorAll('line').forEach((el) => {
    const x1 = parseFloat(el.getAttribute('x1') || '0');
    const y1 = parseFloat(el.getAttribute('y1') || '0');
    const x2 = parseFloat(el.getAttribute('x2') || '0');
    const y2 = parseFloat(el.getAttribute('y2') || '0');
    push(x1, y1, x2, y2);
  });

  // polyline / polygon (`points` 문자열은 "x1,y1 x2,y2" 또는 공백 구분 모두 허용한다.)
  const scanPoints = (el: Element) => {
    const pts = (el.getAttribute('points') || '').trim();
    if (!pts) return;
    const numbers = pts
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(parseFloat);
    for (let i = 0; i < numbers.length - 1; i += 2) {
      const x = numbers[i],
        y = numbers[i + 1];
      if (Number.isFinite(x) && Number.isFinite(y)) {
        push(x, y, x, y);
      }
    }
  };
  root.querySelectorAll('polyline').forEach(scanPoints);
  root.querySelectorAll('polygon').forEach(scanPoints);

  if (minX === +Infinity || minY === +Infinity || maxX === -Infinity || maxY === -Infinity) {
    return null;
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

/**
 * BBox 사방에 비율 기반 패딩을 더한다.
 *
 * @description 0 이하 값이 들어오면 원본을 그대로 돌려준다.
 *
 * @param b 원본 BBox
 * @param pct 적용할 패딩 비율(0.05 = 5%)
 * @returns 패딩이 반영된 BBox
 */
export function padBBox(b: { minX: number; minY: number; width: number; height: number }, pct: number) {
  if (!pct || pct <= 0) return b;
  const dx = b.width * pct;
  const dy = b.height * pct;
  return { minX: b.minX - dx, minY: b.minY - dy, width: b.width + 2 * dx, height: b.height + 2 * dy };
}
