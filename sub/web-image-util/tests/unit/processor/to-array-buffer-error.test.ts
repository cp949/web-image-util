/**
 * processor.toArrayBuffer() 비동기 콜백 예외 래핑 회귀 테스트다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CanvasPool } from '../../../src/base/canvas-pool';
import { processImage } from '../../../src/processor';

function createCanvasWithAsyncBlob(blob: Blob): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 10;
  canvas.height = 10;
  vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => {
    setTimeout(() => callback(blob), 0);
  });
  return canvas;
}

function createProcessorWithCanvas(canvas: HTMLCanvasElement): any {
  const processor = processImage(new Blob(['input'], { type: 'image/png' }));
  vi.spyOn(processor as any, 'executeProcessing').mockResolvedValue({ canvas });
  return processor;
}

describe('toArrayBuffer 오류 원인 보존', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('toBlob 콜백 내부 예외를 OUTPUT_FAILED로 감싸고 originalError를 보존한다', async () => {
    vi.useFakeTimers();
    const canvas = createCanvasWithAsyncBlob(new Blob(['output'], { type: 'image/png' }));
    const cause = new Error('canvas release failed');
    vi.spyOn(CanvasPool.getInstance(), 'release').mockImplementation(() => {
      throw cause;
    });

    const result = createProcessorWithCanvas(canvas).toArrayBuffer();
    const assertion = expect(result).rejects.toMatchObject({
      code: 'OUTPUT_FAILED',
      originalError: cause,
    });

    await vi.runAllTimersAsync();

    await assertion;
  });
});
