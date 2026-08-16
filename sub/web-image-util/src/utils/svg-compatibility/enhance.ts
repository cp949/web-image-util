/**
 * SVG 브라우저 호환성 보강 진입점이다.
 *
 * @description DOM 파싱 → 네임스페이스/문법/aspect ratio/viewBox 보강 → 직렬화 흐름을
 * 한 곳에서 조립한다. 이미지 처리 파이프라인용 facade(`enhanceSvgForBrowser`)와,
 * 같은 파싱 결과에서 유효 크기까지 함께 얻는 파이프라인 전용 facade
 * (`enhanceSvgForBrowserWithDimensions`)도 함께 둔다.
 */

import { parseAndClassifySvg } from '../svg-document.internal';
import { parseViewBoxValues } from '../svg-length.internal';
import { extractSvgDimensions, readPositiveLength } from '../svg-dimensions';
import type { SvgDimensions } from '../svg-dimensions';
import { addPAR, addRequiredNamespaces, modernizeSvgSyntax } from './attributes.internal';
import { toMsg } from './message.internal';
import {
  DEFAULT_OPTIONS,
  SVG_RENDERING_OPTIONS,
  type SvgCompatibilityOptions,
  type SvgCompatibilityReport,
} from './options';
import { applyViewBoxPolicy } from './viewbox-policy.internal';

/** enhanceBrowserCompatibilityCore()의 반환 형태다. */
interface EnhanceCoreResult {
  enhancedSvg: string;
  report: SvgCompatibilityReport;
  /**
   * fixDimensions가 켜져 있고 파싱이 성공했을 때만 채워진다.
   * 공개 API(enhanceBrowserCompatibility)는 이 필드를 감추고,
   * 파이프라인 전용 facade(enhanceSvgForBrowserWithDimensions)는 그대로 소비한다.
   */
  dimensions: SvgDimensions | null;
}

/**
 * enhanceBrowserCompatibility()/enhanceSvgForBrowser()/enhanceSvgForBrowserWithDimensions()가
 * 공유하는 실제 구현이다.
 *
 * @description 파싱, 네임스페이스/문법/PAR 보강, viewBox 정책 적용, 직렬화를 한 번 수행하면서
 * 같은 파싱 결과에서 유효 크기(dimensions)까지 함께 계산한다. dimensions 계산은
 * applyViewBoxPolicy()가 이미 만든 값을 재사용하므로 추가 parse나 BBox 스캔이 없다 —
 * 계산 자체를 새로 만들지 않고, 이미 하던 계산의 결과를 밖으로 꺼내 재사용할 뿐이다.
 */
function enhanceBrowserCompatibilityCore(svgString: string, options: SvgCompatibilityOptions = {}): EnhanceCoreResult {
  // 모드에 맞춘 기본값을 먼저 결정한다.
  const mode = options.mode ?? DEFAULT_OPTIONS.mode;
  const smartDefaults = {
    ...DEFAULT_OPTIONS,
    // preserve-framing 모드는 defaultSize로 0×0이 이미 방지되므로 false가 합리적이다.
    // 단 사용자가 명시한 값이 있으면 그것을 우선한다.
    ensureNonZeroViewport:
      options.ensureNonZeroViewport !== undefined ? options.ensureNonZeroViewport : mode !== 'preserve-framing',
  };

  const opts = { ...smartDefaults, ...options };
  const now =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? () => performance.now()
      : () => Date.now();
  const t0 = now();

  const report: SvgCompatibilityReport = {
    addedNamespaces: [],
    fixedDimensions: false,
    modernizedSyntax: 0,
    warnings: [],
    infos: [],
    processingTimeMs: 0,
  };

  // SVG XML 파싱 단계: 실패하면 원본을 그대로 돌려준다.
  // 파싱·parsererror 감지·루트 판정은 svg-document leaf가 담당한다.
  const parsed = parseAndClassifySvg(svgString);
  if (!parsed.ok) {
    report.warnings.push(
      parsed.reason === 'domparser-unavailable'
        ? 'DOMParser is not available. Returning original SVG.'
        : 'XML parse error detected. Returning original SVG.'
    );
    return { ...finalize(svgString, report, now(), t0), dimensions: null };
  }

  const doc = parsed.doc;
  const root = parsed.svgElement;
  if (parsed.root !== 'svg' || !root) {
    report.warnings.push('Root element is not <svg>. Returning original SVG.');
    return { ...finalize(svgString, report, now(), t0), dimensions: null };
  }

  // 호환성 보강이 width/height/viewBox를 바꾸기 전에 원본 크기 단서를 스냅샷으로 남긴다.
  // addRequiredNamespaces/modernizeSvgSyntax/addPAR는 이 속성들을 건드리지 않으므로
  // 이 시점의 값이 extractSvgDimensions()가 원본 문자열을 독립적으로 파싱했을 때 읽는 값과 같다.
  const originalWidth = readPositiveLength(root.getAttribute('width'));
  const originalHeight = readPositiveLength(root.getAttribute('height'));
  const originalViewBox = parseViewBoxValues(root.getAttribute('viewBox')) ?? undefined;

  try {
    // 1) 네임스페이스 보강
    if (opts.addNamespaces) addRequiredNamespaces(root, report);

    // 2) 레거시 참조 문법 현대화
    if (opts.modernizeSyntax) modernizeSvgSyntax(root, report);

    // 3) preserveAspectRatio 기본값 주입
    if (opts.addPreserveAspectRatio) addPAR(root);

    // 4) viewBox / width / height 정책 적용. 반환값(새로 계산된 viewBox)을 dimensions
    // 산출에 재사용해, extractSvgDimensions()가 같은 문자열에 별도로 수행할
    // parse + BBox 스캔을 없앤다.
    let dimensions: SvgDimensions | null = null;
    if (opts.fixDimensions) {
      const resolvedBox = applyViewBoxPolicy(root, opts, report, svgString);
      if (originalViewBox) {
        // extractSvgDimensions()의 "viewBox 있음" 분기와 동일한 규칙이다.
        dimensions = {
          width: originalWidth || originalViewBox.width,
          height: originalHeight || originalViewBox.height,
          viewBox: originalViewBox,
          hasExplicitSize: Boolean(originalWidth && originalHeight),
        };
      } else if (resolvedBox) {
        // extractSvgDimensions()의 "viewBox 없음" 분기와 동일한 규칙이다.
        // resolvedBox는 applyViewBoxPolicy()가 실제로 DOM에 적용한(0/음수 보정까지 끝난) 값이다.
        dimensions = {
          width: resolvedBox.width,
          height: resolvedBox.height,
          hasExplicitSize: Boolean(originalWidth && originalHeight),
        };
      }
      // resolvedBox가 null인 경우(viewBox 속성은 있지만 값이 깨져 hasVB 분기로 빠진 경우 등)는
      // extractSvgDimensions()와 판정 기준이 갈리는 드문 경계다 — dimensions를 null로 남겨
      // 호출부(enhanceSvgForBrowserWithDimensions)가 extractSvgDimensions()로 폴백하게 한다.
    }

    const enhancedSvg = new XMLSerializer().serializeToString(doc);
    return { ...finalize(enhancedSvg, report, now(), t0), dimensions };
  } catch (e) {
    report.warnings.push(`Processing error: ${toMsg(e)}. Returned original SVG.`);
    return { ...finalize(svgString, report, now(), t0), dimensions: null };
  }
}

/**
 * SVG 문자열을 Canvas 렌더링과 크로스브라우저 호환에 맞게 보강한다.
 *
 * @description 누락된 네임스페이스 추가, xlink:href → href 현대화,
 * preserveAspectRatio 기본값 주입, viewBox·width/height 정책 적용을 한 번에 수행한다.
 * 모든 단계는 비파괴적이며, 파싱 실패나 처리 오류 시에는 원본 SVG를 그대로 반환한다.
 *
 * @param svgString 원본 SVG 문자열(인라인, 파일 본문 등 형식 무관)
 * @param options 호환성 처리 옵션. 모드별 기본값은 함수 내부에서 자동 적용된다.
 * @returns 보강된 SVG 문자열과 처리 결과 리포트
 */
export function enhanceBrowserCompatibility(
  svgString: string,
  options: SvgCompatibilityOptions = {}
): { enhancedSvg: string; report: SvgCompatibilityReport } {
  const { enhancedSvg, report } = enhanceBrowserCompatibilityCore(svgString, options);
  return { enhancedSvg, report };
}

/** 처리 시간을 기록하고 결과 객체를 만들어 반환한다. */
function finalize(svg: string, report: SvgCompatibilityReport, t1: number, t0: number) {
  report.processingTimeMs = Math.max(0, t1 - t0);
  return { enhancedSvg: svg, report };
}

/* ========================================================================== */
/* 이미지 리사이저용 단순 facade API                                            */
/* ========================================================================== */

/**
 * 이미지 처리 파이프라인용 호환성 보강 프리셋이다.
 *
 * @description Canvas 2D 렌더링에 적합한 옵션을 미리 적용한
 * `enhanceBrowserCompatibility` 래퍼다. processImage()의 SVG → 래스터 변환 단계 직전에
 * 호출해 0×0 렌더, 누락된 네임스페이스, 레거시 참조 문법을 한 번에 정리한다.
 *
 * @param svgString 원본 SVG 문자열
 * @returns Canvas 렌더링 직전에 사용할 보강된 SVG 문자열
 */
export function enhanceSvgForBrowser(svgString: string): string {
  const { enhancedSvg } = enhanceBrowserCompatibilityCore(svgString, SVG_RENDERING_OPTIONS);
  return enhancedSvg;
}

/**
 * 렌더 파이프라인 전용: 보강된 SVG와 유효 크기를 같은 파싱 결과에서 함께 계산한다.
 *
 * @description convertSvgToElement()가 enhanceSvgForBrowser()와 extractSvgDimensions()를
 * 같은 문자열에 나란히 호출해 parse와(viewBox 없는 SVG의 경우) BBox 스캔이 두 번씩 일어나던
 * 것을 없앤다. 반환값은 두 함수를 따로 호출했을 때와 항상 같아야 한다 — 이 함수가 직접
 * dimensions를 못 구한 경우(파싱 실패, 루트가 <svg>가 아님, viewBox 속성은 있지만 값이
 * 깨진 경우 등 드문 경로)에만 extractSvgDimensions()로 폴백해 정확성을 지킨다.
 *
 * 공개 표면(`svg-compatibility/index.ts`)에는 노출하지 않는다 — loader.internal.ts 전용이다.
 *
 * @param svgString 원본 SVG 문자열
 * @returns 보강된 SVG 문자열과, extractSvgDimensions()와 동일한 규칙으로 계산한 유효 크기
 */
export function enhanceSvgForBrowserWithDimensions(svgString: string): {
  enhancedSvg: string;
  dimensions: SvgDimensions;
} {
  const { enhancedSvg, dimensions } = enhanceBrowserCompatibilityCore(svgString, SVG_RENDERING_OPTIONS);
  return { enhancedSvg, dimensions: dimensions ?? extractSvgDimensions(svgString) };
}
