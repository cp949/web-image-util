/**
 * SVG 루트 요소의 viewBox와 width/height 정책을 적용한다.
 *
 * @description fixDimensions 단계의 핵심 분기를 담당한다.
 * 옵션 모드(preserve-framing/fit-content)와 ensureNonZeroViewport 조합에 따라
 * 기존 속성 보존 → 휴리스틱/라이브 BBox 계산 → defaultSize 폴백 순서로 동작한다.
 */

import { computeBBox } from './bbox';
import { padBBox } from './bbox/heuristic';
import { extractSizeHints, getStyleLength, parseCssLength, sanitizeNum } from './dimensions';
import type { SvgCompatibilityOptions, SvgCompatibilityReport } from './options';

/**
 * SVG 루트에 viewBox와 width/height 정책을 적용한다.
 *
 * @description 기존 viewBox가 있으면 그대로 보존하고, 없으면 width/height 단서나
 * 콘텐츠 BBox를 활용해 새로 만든다. 끝까지 단서가 없으면 defaultSize로 폴백한다.
 *
 * @param root 보정 대상 SVG 루트 요소
 * @param opts 모든 필드가 채워진 호환성 옵션
 * @param report 처리 메시지를 누적할 리포트
 * @param svgString 원본 SVG 문자열(문자열 휴리스틱 폴백에 필요)
 */
export function applyViewBoxPolicy(
  root: Element,
  opts: Required<SvgCompatibilityOptions>,
  report: SvgCompatibilityReport,
  svgString: string
) {
  const hasVB = root.hasAttribute('viewBox');
  const hasW = root.hasAttribute('width') || !!getStyleLength(root, 'width');
  const hasH = root.hasAttribute('height') || !!getStyleLength(root, 'height');

  // 기존 viewBox는 사용자 의도이므로 덮어쓰지 않는다.
  if (hasVB) {
    // 0×0 방지: 크기 단서가 전혀 없고 ensureNonZeroViewport=true면 viewBox W/H를 width/height로 주입한다.
    if (opts.ensureNonZeroViewport && !hasW && !hasH) {
      const vb = root.getAttribute('viewBox')!;
      const [, , rawW, rawH] = vb.split(/[\s,]+/).map(Number);
      // viewBox 자체가 비정상(0 또는 음수)이어도 안전한 기본 크기로 보정한다.
      const W = rawW > 0 ? rawW : opts.defaultSize.width;
      const H = rawH > 0 ? rawH : opts.defaultSize.height;
      root.setAttribute('width', String(W));
      root.setAttribute('height', String(H));
      report.infos?.push('Injected width/height from existing viewBox (coerced to non-zero).');
    }
    report.infos?.push('viewBox exists; preserved.');
    report.fixedDimensions = true;
    return;
  }

  // width/height 단서를 attribute와 style 양쪽에서 모두 수집한다.
  const { wAttr, hAttr } = extractSizeHints(root);
  const { value: wVal, unit: wUnit } = parseCssLength(wAttr);
  const { value: hVal, unit: hUnit } = parseCssLength(hAttr);
  const wIsPxLike = wVal != null && (!wUnit || wUnit === 'px');
  const hIsPxLike = hVal != null && (!hUnit || hUnit === 'px');

  // viewBox와 보조 width/height를 함께 안전하게 주입하는 헬퍼다.
  const setVB = (minX: number, minY: number, rawW: number, rawH: number) => {
    // 0 또는 음수는 defaultSize로 보정한다.
    const W = rawW > 0 ? rawW : opts.defaultSize.width;
    const H = rawH > 0 ? rawH : opts.defaultSize.height;

    root.setAttribute('viewBox', `${sanitizeNum(minX)} ${sanitizeNum(minY)} ${sanitizeNum(W)} ${sanitizeNum(H)}`);

    const hasAttrW = root.hasAttribute('width');
    const hasAttrH = root.hasAttribute('height');
    const styleW = getStyleLength(root, 'width');
    const styleH = getStyleLength(root, 'height');
    const noAnySize = !hasAttrW && !hasAttrH && !styleW && !styleH;

    if (!opts.preferResponsive) {
      if (!hasAttrW) root.setAttribute('width', String(W));
      if (!hasAttrH) root.setAttribute('height', String(H));
    } else if (opts.ensureNonZeroViewport && noAnySize) {
      // 반응형을 선호하더라도 0×0 렌더를 막기 위해 최소 크기를 주입한다.
      root.setAttribute('width', String(W));
      root.setAttribute('height', String(H));
      report.infos?.push('Injected width/height from viewBox (coerced to non-zero).');
    }
    report.fixedDimensions = true;
  };

  // Case A) width/height가 둘 다 숫자(또는 px)로 주어진 경우
  if (wIsPxLike && hIsPxLike) {
    if (opts.mode === 'preserve-framing') {
      setVB(0, 0, wVal!, hVal!); // 0 보정은 setVB 내부에서 수행한다.
      return;
    } else {
      // fit-content: 실제 콘텐츠 BBox에 맞춘다. 측정 실패 시 width/height 사이즈를 그대로 사용한다.
      const bbox = computeBBox(root, opts, report, svgString) ?? { minX: 0, minY: 0, width: wVal!, height: hVal! };
      const padded = padBBox(bbox, opts.paddingPercent);
      setVB(padded.minX, padded.minY, padded.width, padded.height);
      return;
    }
  }

  // Case B) 한쪽만 있거나 px 외 단위 → defaultSize 폴백 사실을 기록한다.
  if ((wAttr || hAttr) && (!wIsPxLike || !hIsPxLike)) {
    report.warnings.push('Non-px or partial size detected. Falling back to defaultSize for viewBox.');
  }

  // Case C) 단서가 전혀 없는 경우, 모드와 ensureNonZeroViewport에 따라 콘텐츠 기반 산출을 시도한다.
  if (opts.mode === 'fit-content' || opts.ensureNonZeroViewport) {
    const bbox = computeBBox(root, opts, report, svgString);
    if (bbox && bbox.width > 0 && bbox.height > 0) {
      const padded = padBBox(bbox, opts.paddingPercent);
      setVB(padded.minX, padded.minY, padded.width, padded.height);
      return;
    }
    // 디버깅을 위해 BBox 산출 결과를 그대로 기록한다.
    report.warnings.push(
      `Content bbox unavailable (${bbox ? `${bbox.width}x${bbox.height}` : 'null'}). Falling back to defaultSize.`
    );
  }

  // 최종 폴백: preserve-framing + defaultSize
  setVB(0, 0, opts.defaultSize.width, opts.defaultSize.height);
}
