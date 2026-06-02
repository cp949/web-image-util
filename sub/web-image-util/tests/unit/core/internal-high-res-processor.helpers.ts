/**
 * InternalHighResProcessor 테스트 공용 픽스처.
 */

/**
 * width · height만 제어하는 이미지 픽스처.
 * 실제 디코딩 없이 분기 결정에 필요한 치수만 노출한다.
 */
export function createMockImage(width: number, height: number): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
  return img;
}

/**
 * drawImage 소스로 실제 동작하는 Canvas 기반 픽스처.
 * DIRECT 전략 테스트에서 ctx.drawImage 가 실패하지 않도록 Canvas를 사용한다.
 */
export function createDrawableCanvas(width: number, height: number): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas as unknown as HTMLImageElement;
}

/** 스파이가 반환할 가짜 Canvas */
export function makeFakeCanvas(w = 100, h = 100): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * isMemoryLow() 가 true 를 반환하도록 performance.memory 를 주입한다.
 * usedJSHeapSize / jsHeapSizeLimit = 0.9 > 0.8 조건을 만족시킨다.
 */
export function applyLowMemoryState(): PropertyDescriptor | undefined {
  const original = Object.getOwnPropertyDescriptor(performance, 'memory');
  Object.defineProperty(performance, 'memory', {
    value: {
      usedJSHeapSize: 900_000_000,
      jsHeapSizeLimit: 1_000_000_000,
      totalJSHeapSize: 1_000_000_000,
    },
    configurable: true,
    writable: true,
  });
  return original;
}

export function removeLowMemoryState(original: PropertyDescriptor | undefined): void {
  if (original !== undefined) {
    Object.defineProperty(performance, 'memory', original);
    return;
  }

  // 처음에 없던 속성이면 완전히 삭제해 'memory' in performance 가 false 가 되게 한다.
  delete (performance as any).memory;
}
