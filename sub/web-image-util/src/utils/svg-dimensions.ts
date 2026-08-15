/**
 * SVG size information extraction and setting utilities
 * Size information processing for improved SVG rendering quality
 */

import { DEFAULT_OPTIONS } from './svg-compatibility/options';
import { resolveEffectiveViewBox } from './svg-compatibility/viewbox-policy.internal';
import { parseAndClassifySvg } from './svg-document.internal';
import { parseSvgLength, parseViewBoxValues } from './svg-length.internal';

// 렌더 경로(enhanceSvgForBrowser)가 실제로 쓰는 fit-content 정책과 동일하게 맞춘다.
// viewBox가 없는 SVG는 이 옵션으로 유효 크기를 계산해야 렌더 결과와 divergence가 없다.
const EFFECTIVE_SIZE_OPTS = { ...DEFAULT_OPTIONS, mode: 'fit-content' as const };

// Interface for holding SVG size information
export interface SvgDimensions {
  width: number;
  height: number;
  viewBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  hasExplicitSize: boolean; // whether width, height attributes are explicitly set
}

/**
 * Function to extract size information from SVG string
 * @param svgString - SVG string to analyze
 * @returns SVG size information
 * @throws Error - when SVG is invalid
 */
export function extractSvgDimensions(svgString: string): SvgDimensions {
  // 파싱과 parsererror 감지는 svg-document leaf가 담당한다.
  // 루트가 svg가 아니어도 문서 안의 첫 <svg> 요소에서 치수를 읽는 기존 동작을 유지한다.
  const parsed = parseAndClassifySvg(svgString);
  const svgElement = parsed.ok ? parsed.doc.querySelector('svg') : null;

  if (!svgElement) {
    throw new Error('Invalid SVG: No <svg> element found');
  }

  // Extract width, height attributes
  const width = readPositiveLength(svgElement.getAttribute('width'));
  const height = readPositiveLength(svgElement.getAttribute('height'));

  // Parse viewBox
  const viewBox = parseViewBoxValues(svgElement.getAttribute('viewBox')) ?? undefined;

  if (viewBox) {
    return {
      width: width || viewBox.width,
      height: height || viewBox.height,
      viewBox,
      hasExplicitSize: Boolean(width && height),
    };
  }

  // viewBox가 없으면 렌더 경로(enhanceSvgForBrowser → applyViewBoxPolicy)와 동일한
  // fit-content 정책으로 유효 크기를 산출한다. 명시된 width/height보다 콘텐츠 BBox를
  // 우선하는 것까지 포함해 렌더 결과와 크기 조회 결과의 divergence를 없앤다.
  const effective = resolveEffectiveViewBox(svgElement, EFFECTIVE_SIZE_OPTS, undefined, svgString);

  return {
    width: effective.width,
    height: effective.height,
    hasExplicitSize: Boolean(width && height),
  };
}

/**
 * width/height 속성에서 양수 크기 단서만 읽는다.
 *
 * @description 파싱은 svg-length leaf가 담당하고, 여기서는 이 함수의 정책만 적용한다.
 * 단위(px, %, em 등)는 무시하고 숫자만 크기로 쓴다. 0 이하는 크기 단서로 보지 않고
 * undefined를 돌려 viewBox 또는 기본값 폴백에 맡긴다.
 *
 * @param value 파싱할 속성 문자열
 * @returns 양수 크기 값, 없으면 undefined
 */
function readPositiveLength(value: string | null): number | undefined {
  const { value: parsed } = parseSvgLength(value);
  return parsed !== null && parsed > 0 ? parsed : undefined;
}
