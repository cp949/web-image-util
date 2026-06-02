/**
 * auto-high-res convenience 함수의 위임 결과와 반환 형태를 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HighResolutionManager } from '../../../src/base/high-res-manager';
import { AutoHighResProcessor, smartResize, smartResizeWithProgress } from '../../../src/core/auto-high-res';
import {
  createDrawableImage,
  createMockImage,
  makeAutoProcessingResult,
  makeProcessingResult,
} from './auto-high-res.helpers';

describe('auto-high-res convenience 함수', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('smartResizeWithProgress', () => {
    beforeEach(() => {
      vi.spyOn(HighResolutionManager, 'smartResize').mockResolvedValue(makeProcessingResult());
    });

    it('AutoProcessingResult 전체(canvas, optimizations, stats)를 반환한다', async () => {
      const img = createDrawableImage(1000, 1000);
      const result = await smartResizeWithProgress(img, 400, 300, vi.fn());

      expect(result).toHaveProperty('canvas');
      expect(result).toHaveProperty('optimizations');
      expect(result).toHaveProperty('stats');
    });

    it('progress callback 이 진행도와 함께 호출된다', async () => {
      const onProgress = vi.fn();
      const img = createDrawableImage(1000, 1000);
      await smartResizeWithProgress(img, 400, 300, onProgress);

      expect(onProgress).toHaveBeenCalledWith(10, expect.any(String));
      expect(onProgress).toHaveBeenCalledWith(100, expect.any(String));
    });
  });

  describe('smartResize', () => {
    it('AutoProcessingResult.canvas 만 반환한다 (HTMLCanvasElement)', async () => {
      const mockCanvas = document.createElement('canvas');
      vi.spyOn(AutoHighResProcessor, 'smartResize').mockResolvedValue(makeAutoProcessingResult(mockCanvas));
      const img = createMockImage(1000, 1000);
      const result = await smartResize(img, 400, 300);

      expect(result).toBe(mockCanvas);
      expect(result).toBeInstanceOf(HTMLCanvasElement);
    });
  });
});
