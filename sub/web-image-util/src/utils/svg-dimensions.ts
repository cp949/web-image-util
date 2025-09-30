/**
 * SVG 크기 정보 추출 및 설정 유틸리티
 * SVG 렌더링 품질 향상을 위한 크기 정보 처리
 */

// SVG 크기 정보를 담는 인터페이스
export interface SvgDimensions {
  width: number;
  height: number;
  viewBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  hasExplicitSize: boolean; // width, height 속성이 명시적으로 설정되어 있는지 여부
}

// SVG 크기 설정 옵션
export interface SvgEnhanceOptions {
  targetWidth?: number;
  targetHeight?: number;
  preserveAspectRatio?: boolean;
}

/**
 * SVG 문자열에서 크기 정보를 추출하는 함수
 * @param svgString - 분석할 SVG 문자열
 * @returns SVG 크기 정보
 * @throws Error - 유효하지 않은 SVG인 경우
 */
export function extractSvgDimensions(svgString: string): SvgDimensions {
  // DOM 파서 사용 (strict mode 준수)
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgElement = doc.querySelector('svg');

  if (!svgElement) {
    throw new Error('Invalid SVG: No <svg> element found');
  }

  // width, height 속성 추출
  const width = extractNumericValue(svgElement.getAttribute('width'));
  const height = extractNumericValue(svgElement.getAttribute('height'));

  // viewBox 파싱
  const viewBox = parseViewBox(svgElement.getAttribute('viewBox'));

  return {
    width: width || viewBox?.width || 100, // 기본값 100
    height: height || viewBox?.height || 100,
    viewBox,
    hasExplicitSize: Boolean(width && height)
  };
}

/**
 * 문자열에서 숫자 값을 추출하는 헬퍼 함수
 * px, pt, em 등 단위를 제거하고 숫자만 추출
 * @param value - 파싱할 문자열 값
 * @returns 추출된 숫자 값 또는 undefined
 */
function extractNumericValue(value: string | null): number | undefined {
  if (!value) return undefined;

  // px, pt, em 등 단위 제거하고 숫자만 추출
  const numericMatch = value.match(/^(\d+(?:\.\d+)?)/);
  return numericMatch ? parseFloat(numericMatch[1]) : undefined;
}

/**
 * viewBox 문자열을 파싱하는 헬퍼 함수
 * @param viewBoxStr - viewBox 속성 값
 * @returns 파싱된 viewBox 정보 또는 undefined
 */
function parseViewBox(viewBoxStr: string | null): SvgDimensions['viewBox'] {
  if (!viewBoxStr) return undefined;

  const values = viewBoxStr.split(/\s+/).map(Number);
  if (values.length !== 4 || values.some(isNaN)) return undefined;

  return {
    x: values[0],
    y: values[1],
    width: values[2],
    height: values[3]
  };
}

/**
 * SVG 문자열의 크기를 설정하는 함수
 * @param svgString - 수정할 SVG 문자열
 * @param width - 설정할 너비
 * @param height - 설정할 높이
 * @param options - 추가 옵션
 * @returns 크기가 설정된 SVG 문자열
 * @throws Error - 유효하지 않은 SVG인 경우
 */
export function setSvgDimensions(
  svgString: string,
  width: number,
  height: number,
  options: SvgEnhanceOptions = {}
): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgElement = doc.querySelector('svg');

  if (!svgElement) {
    throw new Error('Invalid SVG: No <svg> element found');
  }

  // 기존 크기 정보 백업
  const originalDimensions = extractSvgDimensions(svgString);

  // 🔧 FIX: aspect ratio 보존 - viewBox는 원본 크기 유지, width/height만 스케일링

  // 새로운 크기 설정 (고해상도용)
  svgElement.setAttribute('width', width.toString());
  svgElement.setAttribute('height', height.toString());

  // viewBox는 원본 논리 크기 유지 - aspect ratio 보존의 핵심
  if (originalDimensions.viewBox) {
    // 기존 viewBox 유지 (스케일링하지 않음)
    const { x, y, width: vbWidth, height: vbHeight } = originalDimensions.viewBox;
    svgElement.setAttribute('viewBox', `${x} ${y} ${vbWidth} ${vbHeight}`);
  } else if (originalDimensions.hasExplicitSize) {
    // viewBox가 없다면 원본 논리 크기로 생성
    svgElement.setAttribute('viewBox', `0 0 ${originalDimensions.width} ${originalDimensions.height}`);
  }

  // preserveAspectRatio 설정
  if (options.preserveAspectRatio !== false) {
    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }

  return new XMLSerializer().serializeToString(doc);
}