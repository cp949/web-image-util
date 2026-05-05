/**
 * SteppedProcessor 단위 테스트
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SteppedProcessor } from '../../../src/base/stepped-processor';

// ============================================================================
// 헬퍼
// ============================================================================

function createMockImage(width = 200, height = 200): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
  return img;
}

// ============================================================================
// batchResizeWithSteps — 결과 순서 검증
// ============================================================================

describe('SteppedProcessor.batchResizeWithSteps', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('입력 이미지 순서대로 결과를 반환한다', async () => {
    // resizeWithSteps를 mock해 각 이미지마다 고유한 크기의 canvas를 반환한다
    const widths = [10, 20, 30, 40, 50, 60, 70];
    const images = widths.map((w) => createMockImage(w, w));

    vi.spyOn(SteppedProcessor, 'resizeWithSteps').mockImplementation(async (img: HTMLImageElement) => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      return canvas;
    });

    // concurrency=3으로 3개 청크가 생성된다 (3+3+1)
    const results = await SteppedProcessor.batchResizeWithSteps(images, 100, 100, {
      concurrency: 3,
    });

    expect(results).toHaveLength(7);
    // 각 결과의 width가 원본 이미지 순서와 일치해야 한다
    expect(results.map((c) => c.width)).toEqual(widths);
  });
});
