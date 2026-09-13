/**
 * AdvancedImageProcessor.processImage 테스트에서 공유하는 스텁과 jsdom 보강을 제공한다.
 */

import { vi } from 'vitest';
import type { HighResolutionProcessResult } from '../../../src/core/high-res-processor';
import { HighResolutionProcessor } from '../../../src/core/high-res-processor';

/** HighResolutionProcessor.resize 스텁 반환값 */
export function makeResizeResult(overrides: Partial<HighResolutionProcessResult> = {}): HighResolutionProcessResult {
  return {
    canvas: document.createElement('canvas'),
    analysis: {
      width: 100,
      height: 100,
      pixelCount: 10000,
      totalPixels: 10000,
      estimatedMemoryMB: 0.04,
      strategy: 'direct',
      maxSafeDimension: 16384,
      recommendedChunkSize: 1024,
      processingComplexity: 'low',
    } as any,
    priority: 'balanced',
    strategy: 'direct' as any,
    processingTime: 0,
    memoryPeakUsageMB: 0,
    memoryOptimized: false,
    estimatedTimeSaved: 0,
    ...overrides,
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

/** resize 경로 테스트용 resize 기본 스텁을 설치한다. */
export function mockResize(result: HighResolutionProcessResult = makeResizeResult()) {
  return vi.spyOn(HighResolutionProcessor, 'resize').mockResolvedValue(result);
}
