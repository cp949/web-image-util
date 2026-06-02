/**
 * SVGProcessor 테스트에서 공유하는 fixture와 이미지 로딩 제어 helper다.
 */

export const SVG_WITH_WH = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="200"></svg>';
export const SVG_WITH_WH_PX = '<svg xmlns="http://www.w3.org/2000/svg" width="100px" height="200px"></svg>';
export const SVG_WITH_VIEWBOX = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 150"></svg>';
export const SVG_WITH_STYLE = '<svg xmlns="http://www.w3.org/2000/svg" style="width:80px;height:60px"></svg>';
export const SVG_NO_DIMS = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
export const NOT_SVG = '<html><body></body></html>';
export const BROKEN_XML = '<svg<';
export const VALID_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';

/**
 * src 세터에서 onload 또는 onerror를 즉시 트리거하는 img 요소를 생성한다.
 *
 * processSVGString 내부 document.createElement('img') 호출을 스파이로 가로채
 * 이 요소를 반환하면 jsdom에서 실제 Blob URL 로딩 없이 계약을 검증할 수 있다.
 */
export function createControlledImage(result: 'load' | 'error'): HTMLImageElement {
  const img = document.createElement('img');
  let assignedSrc = '';

  Object.defineProperty(img, 'src', {
    configurable: true,
    get: () => assignedSrc,
    set: (value: string) => {
      assignedSrc = value;
      if (result === 'load') {
        img.onload?.(new Event('load'));
      } else {
        img.onerror?.(new Event('error'));
      }
    },
  });

  return img;
}
