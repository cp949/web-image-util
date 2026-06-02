/**
 * AdvancedImageProcessor.processImage 테스트에서 공유하는 스텁과 jsdom 보강을 제공한다.
 */

import { vi } from 'vitest';
import { AutoHighResProcessor } from '../../../src/core/auto-high-res';

/** AutoHighResProcessor.smartResize 스텁 반환값 */
export function makeResizeResult(canvasW = 200, canvasH = 150, userMessage?: string) {
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  return {
    canvas,
    optimizations: {
      strategy: 'direct',
      memoryOptimized: false,
      tileProcessing: false,
      estimatedTimeSaved: 0,
    },
    stats: {
      originalSize: { width: 800, height: 600 },
      finalSize: { width: canvasW, height: canvasH },
      processingTime: 0.01,
      memoryPeakUsage: 5,
      qualityLevel: 'balanced' as const,
    },
    ...(userMessage !== undefined ? { userMessage } : {}),
  };
}

/**
 * SmartFormatSelector.selectOptimalFormat 스텁 반환값.
 * jpeg 고정값으로 jsdom 기본값(image/png)과 구분한다.
 */
export function makeFormatResult() {
  return {
    format: 'jpeg',
    mimeType: 'image/jpeg',
    quality: 0.9,
    reason: '테스트용 포맷 선택',
    alternatives: [],
    estimatedSavings: 0.1,
  };
}

/** jsdom 미구현 ImageData 전역을 보강한다. */
export function installImageDataMock() {
  globalThis.ImageData = class MockImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;

    constructor(data: Uint8ClampedArray, width: number, height: number) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  } as typeof ImageData;
}

/** resize 경로 테스트용 smartResize 기본 스텁을 설치한다. */
export function mockSmartResize(result = makeResizeResult()) {
  return vi.spyOn(AutoHighResProcessor, 'smartResize').mockResolvedValue(result as any);
}
