/**
 * 휴리스틱 기반 BBox 계산과 패딩 보조 함수다.
 *
 * @description DOM 조회·정규식 파싱만으로 근사 BBox를 만든다.
 * 전체 SVG 렌더링 없이 동작하므로 SSR/Node 환경에서도 안전하다.
 */

import { hasWhitespaceBeforeSvgLengthUnit, parseSvgLength } from '../../svg-length.internal';

/**
 * 도형의 좌표·크기 속성을 user unit 숫자로 읽는다.
 *
 * @description 단위 없음(user unit)과 `px`만 좌표계 숫자와 1:1 대응한다.
 * `%`/`em`/`vw`는 뷰포트나 폰트를 기준으로 삼는데, 이 휴리스틱은 뷰포트 크기가
 * 아직 정해지지 않은 시점(viewBox 산출 직전)에 호출되므로 환산 기준이 없다.
 * 그런 값은 NaN으로 돌려주고, 호출부의 유한값·양수 가드가 해당 도형을 BBox에서 제외한다.
 *
 * @param raw 속성 원문(`"80"`, `"80px"`, `"80%"` 등)
 * @returns user unit 숫자, 환산 기준이 없거나 문법이 잘못됐으면 NaN
 */
function toUserUnitNumber(raw: string): number {
  const { value, unit } = parseSvgLength(raw);
  if (value === null) return Number.NaN;
  if (unit !== null && unit !== 'px') return Number.NaN;
  // "80 px"처럼 숫자와 단위 사이에 공백이 있으면 SVG 문법상 무효다.
  if (hasWhitespaceBeforeSvgLengthUnit(raw)) return Number.NaN;
  return value;
}

/**
 * `points` 목록의 좌표 토큰 하나를 숫자로 읽는다.
 *
 * @description `points`는 `<length>`가 아니라 `<number>` 목록이라 단위 접미사가 허용되지 않는다.
 *
 * @param token 공백·콤마로 분리된 좌표 토큰
 * @returns 좌표 숫자, 단위가 붙었거나 숫자가 아니면 NaN
 */
function toPointNumber(token: string): number {
  const { value, unit } = parseSvgLength(token);
  if (value === null || unit !== null) return Number.NaN;
  return value;
}

/**
 * SVG 마크업 문자열에서 정규식만으로 근사 BBox를 추출한다.
 *
 * @description DOM 파싱이 실패하거나 사용할 수 없는 환경에서 마지막 폴백으로 쓴다.
 * `<circle>`과 `<rect>`만 인식하며, 중첩이나 transform은 무시한다.
 * 좌표·크기가 `%`/`em`처럼 환산 기준이 필요한 단위면 그 도형은 계산에서 제외한다.
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
    const cx = toUserUnitNumber(circleMatch[1]);
    const cy = toUserUnitNumber(circleMatch[2]);
    const r = toUserUnitNumber(circleMatch[3]);
    if (r > 0) push(cx - r, cy - r, cx + r, cy + r);
    circleMatch = circleRegex.exec(svgString);
  }

  // <rect> 좌표 추출
  const rectRegex =
    /<rect[^>]*x=["']?([^"'\s]+)["']?[^>]*y=["']?([^"'\s]+)["']?[^>]*width=["']?([^"'\s]+)["']?[^>]*height=["']?([^"'\s]+)["']?[^>]*\/?>/gi;
  let rectMatch = rectRegex.exec(svgString);
  while (rectMatch !== null) {
    const x = toUserUnitNumber(rectMatch[1]);
    const y = toUserUnitNumber(rectMatch[2]);
    const w = toUserUnitNumber(rectMatch[3]);
    const h = toUserUnitNumber(rectMatch[4]);
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
 * 좌표·크기가 `%`/`em`처럼 환산 기준이 필요한 단위인 도형도 제외한다
 * (뷰포트 크기가 정해지기 전에 호출되므로 환산할 기준이 없다).
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
    const x = toUserUnitNumber(el.getAttribute('x') || '0');
    const y = toUserUnitNumber(el.getAttribute('y') || '0');
    const w = toUserUnitNumber(el.getAttribute('width') || '0');
    const h = toUserUnitNumber(el.getAttribute('height') || '0');
    if (w > 0 && h > 0) push(x, y, x + w, y + h);
  });

  // circle
  root.querySelectorAll('circle').forEach((el) => {
    const cx = toUserUnitNumber(el.getAttribute('cx') || '0');
    const cy = toUserUnitNumber(el.getAttribute('cy') || '0');
    const r = toUserUnitNumber(el.getAttribute('r') || '0');
    if (r > 0) push(cx - r, cy - r, cx + r, cy + r);
  });

  // ellipse
  root.querySelectorAll('ellipse').forEach((el) => {
    const cx = toUserUnitNumber(el.getAttribute('cx') || '0');
    const cy = toUserUnitNumber(el.getAttribute('cy') || '0');
    const rx = toUserUnitNumber(el.getAttribute('rx') || '0');
    const ry = toUserUnitNumber(el.getAttribute('ry') || '0');
    if (rx > 0 && ry > 0) push(cx - rx, cy - ry, cx + rx, cy + ry);
  });

  // line
  root.querySelectorAll('line').forEach((el) => {
    const x1 = toUserUnitNumber(el.getAttribute('x1') || '0');
    const y1 = toUserUnitNumber(el.getAttribute('y1') || '0');
    const x2 = toUserUnitNumber(el.getAttribute('x2') || '0');
    const y2 = toUserUnitNumber(el.getAttribute('y2') || '0');
    push(x1, y1, x2, y2);
  });

  // polyline / polygon (`points` 문자열은 "x1,y1 x2,y2" 또는 공백 구분 모두 허용한다.)
  const scanPoints = (el: Element) => {
    const pts = (el.getAttribute('points') || '').trim();
    if (!pts) return;
    const numbers = pts
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(toPointNumber);
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
