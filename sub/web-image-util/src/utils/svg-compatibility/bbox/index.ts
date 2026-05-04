/**
 * BBox 계산 진입점이다.
 *
 * @description 옵션에 따라 라이브 getBBox → 휴리스틱 → 문자열 휴리스틱 순서로 폴백한다.
 */

import { toMsg } from '../internal';
import type { SvgCompatibilityOptions, SvgCompatibilityReport } from '../options';
import { heuristicBBox, heuristicBBoxFromString } from './heuristic';
import { isBrowser, liveGetBBox } from './live';

/**
 * 옵션에 따라 가장 정확한 BBox 계산 전략을 선택한다.
 *
 * @description 시도 순서는 라이브 getBBox → DOM 휴리스틱 → 문자열 휴리스틱이며,
 * 첫 단계가 성공하면 즉시 반환한다. 실패한 단계는 리포트에 경고/정보로 남긴다.
 *
 * @param root 측정 대상 SVG 루트 요소
 * @param opts 모든 필드가 채워진 호환성 옵션
 * @param report 처리 메시지를 누적할 리포트
 * @param svgString 원본 SVG 문자열(문자열 휴리스틱 폴백에 필요)
 * @returns 측정에 성공하면 BBox, 모든 폴백이 실패하면 null
 */
export function computeBBox(
  root: Element,
  opts: Required<SvgCompatibilityOptions>,
  report: SvgCompatibilityReport,
  svgString?: string
): { minX: number; minY: number; width: number; height: number } | null {
  // 1) 브라우저에서만 사용 가능한 라이브 getBBox 우선 시도
  if (opts.enableLiveBBox && isBrowser() && typeof (window as any).SVGSVGElement !== 'undefined') {
    try {
      const result = liveGetBBox(root as unknown as SVGSVGElement);
      if (result) {
        report.infos?.push('BBox computed via live getBBox.');
        return result;
      }
      report.warnings.push('Live getBBox returned empty.');
    } catch (e) {
      report.warnings.push(`Live getBBox failed: ${toMsg(e)}`);
    }
  }

  // 2) DOM 휴리스틱(rect/circle 등 단순 도형 기반)
  if (opts.enableHeuristicBBox) {
    const hb = heuristicBBox(root);
    if (hb) {
      report.infos?.push('BBox computed via heuristic scan.');
      return hb;
    }
    // 2.1) DOM 파싱이 불완전한 환경을 위한 문자열 정규식 폴백
    if (svgString) {
      const stringHb = heuristicBBoxFromString(svgString);
      if (stringHb) {
        report.infos?.push('BBox computed via string-based heuristic.');
        return stringHb;
      }
    }
  }

  // 3) 측정 불가
  return null;
}
