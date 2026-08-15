/**
 * SVG 루트 요소의 viewBox와 width/height 정책을 적용한다.
 *
 * @description fixDimensions 단계의 핵심 분기를 담당한다.
 * 옵션 모드(preserve-framing/fit-content)와 ensureNonZeroViewport 조합에 따라
 * 기존 속성 보존 → 휴리스틱/라이브 BBox 계산 → defaultSize 폴백 순서로 동작한다.
 */

import { hasWhitespaceBeforeSvgLengthUnit, parseSvgLength, parseViewBoxValues } from '../svg-length.internal';
import { computeBBox } from './bbox/compute.internal';
import { padBBox } from './bbox/heuristic.internal';
import { extractSizeHints, getStyleLength, sanitizeNum } from './dimensions.internal';
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
      const vb = parseViewBoxValues(root.getAttribute('viewBox'));
      // viewBox 자체가 비정상(파싱 실패, 0 또는 음수)이어도 안전한 기본 크기로 보정한다.
      const W = vb && vb.width > 0 ? vb.width : opts.defaultSize.width;
      const H = vb && vb.height > 0 ? vb.height : opts.defaultSize.height;
      root.setAttribute('width', String(W));
      root.setAttribute('height', String(H));
      report.infos?.push('Injected width/height from existing viewBox (coerced to non-zero).');
    }
    report.infos?.push('viewBox exists; preserved.');
    report.fixedDimensions = true;
    return;
  }

  const box = resolveEffectiveViewBox(root, opts, report, svgString);

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

  setVB(box.minX, box.minY, box.width, box.height);
}

/**
 * `viewBox`가 없는 SVG의 유효 크기(Case A/B/C 결정 트리)를 계산한다.
 *
 * @description `applyViewBoxPolicy()`가 DOM에 실제로 적용하는 것과 동일한 값을
 * 순수 함수로 산출한다. DOM을 수정하지 않으므로 렌더링 없이 "실제로 어떤 크기로
 * 그려질지"만 조회하고 싶은 호출부(`extractSvgDimensions()` 등)에서 재사용할 수 있다.
 *
 * @param root 대상 SVG 루트 요소(이미 `viewBox`가 없는 것으로 확인된 상태)
 * @param opts 모든 필드가 채워진 호환성 옵션
 * @param report 처리 메시지를 누적할 리포트. 생략하면 내부에서 버려지는 리포트로 대체한다.
 * @param svgString 원본 SVG 문자열(문자열 휴리스틱 폴백에 필요)
 * @returns 적용될 viewBox 값 `{minX, minY, width, height}` (패딩 반영, 0/음수 미보정)
 */
export function resolveEffectiveViewBox(
  root: Element,
  opts: Required<SvgCompatibilityOptions>,
  report?: SvgCompatibilityReport,
  svgString?: string
): { minX: number; minY: number; width: number; height: number } {
  const r = report ?? createThrowawayReport();

  // width/height 단서를 attribute와 style 양쪽에서 모두 수집한다.
  const { wAttr, hAttr } = extractSizeHints(root);
  const { value: wVal, unit: wUnit } = parseSvgLength(wAttr);
  const { value: hVal, unit: hUnit } = parseSvgLength(hAttr);
  const wIsPxLike = wVal != null && (!wUnit || wUnit === 'px') && !hasWhitespaceBeforeSvgLengthUnit(wAttr);
  const hIsPxLike = hVal != null && (!hUnit || hUnit === 'px') && !hasWhitespaceBeforeSvgLengthUnit(hAttr);

  // Case A) width/height가 둘 다 숫자(또는 px)로 주어진 경우
  if (wIsPxLike && hIsPxLike) {
    if (opts.mode === 'preserve-framing') {
      return { minX: 0, minY: 0, width: wVal!, height: hVal! };
    }
    // fit-content: 실제 콘텐츠 BBox에 맞춘다. 측정 실패 시 width/height 사이즈를 그대로 사용한다.
    const bbox = computeBBox(root, opts, r, svgString) ?? { minX: 0, minY: 0, width: wVal!, height: hVal! };
    return padBBox(bbox, opts.paddingPercent);
  }

  // Case B) 한쪽만 있거나 px 외 단위 → defaultSize 폴백 사실을 기록한다.
  if ((wAttr || hAttr) && (!wIsPxLike || !hIsPxLike)) {
    r.warnings.push('Non-px or partial size detected. Falling back to defaultSize for viewBox.');
  }

  // Case C) 단서가 전혀 없는 경우, 모드와 ensureNonZeroViewport에 따라 콘텐츠 기반 산출을 시도한다.
  if (opts.mode === 'fit-content' || opts.ensureNonZeroViewport) {
    const bbox = computeBBox(root, opts, r, svgString);
    if (bbox && bbox.width > 0 && bbox.height > 0) {
      return padBBox(bbox, opts.paddingPercent);
    }
    // 디버깅을 위해 BBox 산출 결과를 그대로 기록한다.
    r.warnings.push(
      `Content bbox unavailable (${bbox ? `${bbox.width}x${bbox.height}` : 'null'}). Falling back to defaultSize.`
    );
  }

  // 최종 폴백: preserve-framing + defaultSize
  return { minX: 0, minY: 0, width: opts.defaultSize.width, height: opts.defaultSize.height };
}

/** report를 넘기지 않은 호출부를 위한, 버려지는 빈 리포트를 만든다. */
function createThrowawayReport(): SvgCompatibilityReport {
  return {
    addedNamespaces: [],
    fixedDimensions: false,
    modernizedSyntax: 0,
    warnings: [],
    infos: [],
    processingTimeMs: 0,
  };
}
