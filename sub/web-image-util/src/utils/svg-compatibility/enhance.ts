/**
 * SVG 브라우저 호환성 보강 진입점이다.
 *
 * @description DOM 파싱 → 네임스페이스/문법/aspect ratio/viewBox 보강 → 직렬화 흐름을
 * 한 곳에서 조립한다. 이미지 처리 파이프라인용 facade(`enhanceSvgForBrowser`)도 함께 둔다.
 */

import { addPAR, addRequiredNamespaces, modernizeSvgSyntax } from './attributes';
import { toMsg } from './internal';
import { DEFAULT_OPTIONS, type SvgCompatibilityOptions, type SvgCompatibilityReport } from './options';
import { applyViewBoxPolicy } from './viewbox-policy';

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
  let doc: Document;
  try {
    if (typeof DOMParser === 'undefined') {
      report.warnings.push('DOMParser is not available. Returning original SVG.');
      return finalize(svgString, report, now(), t0);
    }
    doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      report.warnings.push('XML parse error detected. Returning original SVG.');
      return finalize(svgString, report, now(), t0);
    }
  } catch (e) {
    report.warnings.push(`DOMParser failed: ${toMsg(e)}. Returning original SVG.`);
    return finalize(svgString, report, now(), t0);
  }

  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg') {
    report.warnings.push('Root element is not <svg>. Returning original SVG.');
    return finalize(svgString, report, now(), t0);
  }

  try {
    // 1) 네임스페이스 보강
    if (opts.addNamespaces) addRequiredNamespaces(root, report);

    // 2) 레거시 참조 문법 현대화
    if (opts.modernizeSyntax) modernizeSvgSyntax(root, report);

    // 3) preserveAspectRatio 기본값 주입
    if (opts.addPreserveAspectRatio) addPAR(root);

    // 4) viewBox / width / height 정책 적용
    if (opts.fixDimensions) {
      applyViewBoxPolicy(root, opts, report, svgString);
    }

    const enhancedSvg = new XMLSerializer().serializeToString(doc);
    return finalize(enhancedSvg, report, now(), t0);
  } catch (e) {
    report.warnings.push(`Processing error: ${toMsg(e)}. Returned original SVG.`);
    return finalize(svgString, report, now(), t0);
  }
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
  const { enhancedSvg } = enhanceBrowserCompatibility(svgString, {
    // === 핵심 호환성 보강 ===
    addNamespaces: true, // 브라우저 파서를 위한 필수 네임스페이스
    fixDimensions: true, // Canvas drawImage가 요구하는 명시 크기 확보
    modernizeSyntax: true, // xlink → href 현대화
    addPreserveAspectRatio: true, // 종횡비 유지 명시

    // === 크기 산정 전략 ===
    mode: 'fit-content', // 콘텐츠에 정확히 맞춘 viewBox(리사이저에 적합)
    ensureNonZeroViewport: true, // 0×0 렌더링 방지
    paddingPercent: 0, // 추가 여백 없이 정확한 크기 사용

    // === 성능/안정성 옵션 ===
    preferResponsive: false, // Canvas는 고정 크기가 더 예측 가능하다
    enableLiveBBox: false, // 테스트 환경에서 getBBox() 타임아웃 방지
    enableHeuristicBBox: true, // Node 환경에서도 동작하는 폴백 활성화
  });
  return enhancedSvg;
}
