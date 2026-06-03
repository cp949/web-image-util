import type { SVGDimensions } from './svg-processor';

const SVG_MIME_TYPE = 'image/svg+xml';

/**
 * SVG 문자열을 파싱해 Document 객체로 반환한다.
 *
 * 브라우저/jsdom 환경에서 DOMParser.parseFromString(image/svg+xml)은 잘못된 입력에도
 * 예외를 던지지 않고 parsererror 요소를 포함한 Document를 반환한다(환경 가정). 따라서 이
 * 함수는 사실상 항상 Document를 반환하며, try/catch는 DOMParser 자체가 정의되지 않은
 * 환경에서 발생하는 ReferenceError에 대한 방어다.
 * 파싱 오류 여부는 hasParserError()로 확인한다.
 */
export function parseSvgDocument(svgString: string): Document | null {
  try {
    return new DOMParser().parseFromString(svgString, SVG_MIME_TYPE);
  } catch {
    return null;
  }
}

/** Document에서 SVG 루트 요소를 반환한다. 없으면 null을 반환한다. */
export function getSvgRoot(doc: Document): SVGElement | null {
  return doc.querySelector('svg');
}

/** Document에 parsererror 요소가 있으면 true를 반환한다. */
export function hasParserError(doc: Document): boolean {
  return doc.querySelector('parsererror') !== null;
}

/** Document를 XML 문자열로 직렬화해 반환한다. */
export function serializeSvgDocument(doc: Document): string {
  return new XMLSerializer().serializeToString(doc);
}

/** SVG 콘텐츠를 지정한 크기의 SVG 래퍼로 감싸 반환한다. */
export function wrapSvgContent(svgString: string, width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${svgString}</svg>`;
}

/** SVG 요소에서 크기 정보를 추출한다. width/height 속성, viewBox, style 순으로 시도하며 모두 없으면 null을 반환한다. */
export function readSvgDimensions(svgElement: SVGElement): SVGDimensions | null {
  const widthAttr = svgElement.getAttribute('width');
  const heightAttr = svgElement.getAttribute('height');

  if (widthAttr && heightAttr) {
    const width = parseNumericSvgValue(widthAttr);
    const height = parseNumericSvgValue(heightAttr);

    if (width > 0 && height > 0) {
      return { width, height };
    }
  }

  const viewBox = svgElement.getAttribute('viewBox');
  if (viewBox) {
    const values = viewBox.trim().split(/\s+/).map(Number);
    if (values.length === 4 && values[2] > 0 && values[3] > 0) {
      return {
        width: values[2],
        height: values[3],
      };
    }
  }

  const style = svgElement.getAttribute('style');
  if (style) {
    const widthMatch = style.match(/width\s*:\s*([^;]+)/);
    const heightMatch = style.match(/height\s*:\s*([^;]+)/);

    if (widthMatch && heightMatch) {
      const width = parseNumericSvgValue(widthMatch[1].trim());
      const height = parseNumericSvgValue(heightMatch[1].trim());

      if (width > 0 && height > 0) {
        return { width, height };
      }
    }
  }

  return null;
}

/** SVG 요소에 width, height, viewBox 속성이 없을 때만 지정한 값을 설정한다. */
export function applyMissingDimensions(svgElement: SVGElement, width: number, height: number): void {
  if (!svgElement.getAttribute('width')) {
    svgElement.setAttribute('width', String(width));
  }
  if (!svgElement.getAttribute('height')) {
    svgElement.setAttribute('height', String(height));
  }
  if (!svgElement.getAttribute('viewBox')) {
    svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
}

/** CSS 크기 값 문자열을 픽셀 단위 숫자로 변환한다. 변환할 수 없으면 0을 반환한다. */
export function parseNumericSvgValue(value: string): number {
  if (!value) return 0;

  const numOnly = parseFloat(value);
  if (!Number.isNaN(numOnly) && Number.isFinite(numOnly)) {
    return numOnly;
  }

  const pxMatch = value.match(/^([0-9.]+)px$/i);
  if (pxMatch) {
    const num = parseFloat(pxMatch[1]);
    return !Number.isNaN(num) && Number.isFinite(num) ? num : 0;
  }

  const percentMatch = value.match(/^([0-9.]+)%$/i);
  if (percentMatch) {
    return 0;
  }

  return 0;
}
