/**
 * AdvancedImageProcessor 분기 테스트에서 공유하는 DOM fixture와 스텁 결과를 제공한다.
 */

/** width · height를 제어하는 이미지 픽스처 */
export function createMockImage(width = 100, height = 100): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  return img;
}

/** drawImage 소스로 사용할 수 있는 Canvas 기반 픽스처 */
export function createDrawableSource(width = 100, height = 100): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas as unknown as HTMLImageElement;
}

/** processImage 스텁 반환값 — blob 유무 선택 가능 */
export function makeProcessResult(opts: { withBlob?: boolean } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  return {
    canvas,
    blob: opts.withBlob ? new Blob([], { type: 'image/jpeg' }) : undefined,
    processing: { filtersApplied: 0, watermarkApplied: false },
    stats: { totalProcessingTime: 0, memoryPeakUsage: 0 },
    messages: [],
  };
}

/** validateProcessing 스텁 반환값 */
export function makeValidationResult(
  overrides: {
    canProcess?: boolean;
    warnings?: string[];
    recommendations?: string[];
    estimatedTime?: number;
    estimatedMemory?: number;
    suggestedStrategy?: string;
  } = {}
) {
  return {
    canProcess: true,
    warnings: [],
    recommendations: [],
    estimatedTime: 2,
    estimatedMemory: 100,
    suggestedStrategy: 'direct',
    ...overrides,
  };
}
