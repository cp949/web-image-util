import type { AutoProcessingResult } from '../../../src/core/auto-high-res';

/**
 * img.width / img.height 를 제어하는 테스트 이미지 헬퍼.
 */
export function createMockImage(width: number, height: number): HTMLImageElement {
  const img = new Image();
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  return img;
}

/**
 * drawImage 소스로 사용 가능한 Canvas 기반 이미지 헬퍼.
 *
 * jsdom+canvas 환경에서 HTMLImageElement.drawImage 는 src 없이 실패하므로
 * node-canvas 가 drawImage 소스로 수락하는 Canvas 를 사용한다.
 */
export function createDrawableImage(width: number, height: number): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas as unknown as HTMLImageElement;
}

/**
 * HighResolutionManager.validateProcessingCapability 의 기본 반환값을 만든다.
 */
export function makeValidation(
  overrides: Partial<{ canProcess: boolean; warnings: string[]; estimatedTime: number }> = {}
) {
  return {
    canProcess: true,
    analysis: {} as any,
    recommendedStrategy: 'direct' as any,
    warnings: [],
    estimatedTime: 0,
    ...overrides,
  };
}

/**
 * HighResolutionManager.smartResize 의 기본 반환값을 만든다.
 */
export function makeProcessingResult(overrides: Partial<{ canvas: HTMLCanvasElement }> = {}) {
  return {
    canvas: document.createElement('canvas'),
    analysis: {} as any,
    strategy: 'direct' as any,
    processingTime: 0,
    memoryPeakUsageMB: 0,
    quality: 'balanced' as const,
    ...overrides,
  };
}

/**
 * AutoProcessingResult 기본값을 만든다.
 */
export function makeAutoProcessingResult(canvas?: HTMLCanvasElement): AutoProcessingResult {
  return {
    canvas: canvas ?? document.createElement('canvas'),
    optimizations: {
      strategy: 'test',
      memoryOptimized: false,
      tileProcessing: false,
      estimatedTimeSaved: 0,
    },
    stats: {
      originalSize: { width: 100, height: 100 },
      finalSize: { width: 50, height: 50 },
      processingTime: 0,
      memoryPeakUsage: 0,
      qualityLevel: 'balanced',
    },
  };
}
