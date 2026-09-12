/**
 * HighResolutionProcessor 테스트 공용 픽스처.
 */

/** img.width/height 를 제어하는 mock 이미지(드로우 불가, analyzeImage/validate 용) */
export function createMockImage(width: number, height: number): HTMLImageElement {
  const img = new Image();
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  return img;
}

/**
 * drawImage 소스로 사용 가능한 Canvas 기반 이미지 픽스처.
 * jsdom+canvas 환경에서 HTMLImageElement.drawImage 는 src 없이 실패하므로
 * node-canvas 가 drawImage 소스로 수락하는 Canvas 를 사용한다.
 */
export function createDrawableImage(width: number, height: number): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas as unknown as HTMLImageElement;
}
