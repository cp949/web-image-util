/**
 * 테스트 환경에서도 같은 경로를 타도록 이미지 요소를 만든다.
 */
export function createImageElement(size?: { width: number; height: number }): HTMLImageElement {
  const img = document.createElement('img') as HTMLImageElement;

  if (size) {
    img.width = size.width;
    img.height = size.height;
  }

  return img;
}
