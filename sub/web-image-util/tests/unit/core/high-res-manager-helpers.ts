/**
 * HighResolutionManager 테스트 공용 픽스처
 *
 * 분리된 high-res-manager-*-jsdom.test.ts 파일에서 공유한다.
 */

import { ProcessingStrategy } from '../../../src/base/high-res-detector';

// width / height 를 Object.defineProperty 로 제어하는 mock 이미지
// drawImage 소스로 사용하지 않는 경우(analyzeImage, validateProcessingCapability 등)에 사용
export function createMockImage(width: number, height: number): HTMLImageElement {
  const img = new Image();
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
  return img;
}

// drawImage 소스로 사용 가능한 canvas 기반 이미지 픽스처
// jsdom+canvas 환경에서 HTMLImageElement.drawImage 는 src 없이 실패하므로
// Canvas 를 소스로 사용한다
export function createDrawableImage(width: number, height: number): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas as unknown as HTMLImageElement;
}

// ProcessingResult 기본 스텁 반환값
export function makeProcessingResult(overrides: Partial<{ canvas: HTMLCanvasElement }> = {}) {
  const canvas = overrides.canvas ?? document.createElement('canvas');
  return {
    canvas,
    analysis: {} as any,
    strategy: ProcessingStrategy.DIRECT,
    processingTime: 0.1,
    memoryPeakUsageMB: 0,
    quality: 'balanced' as const,
  };
}
