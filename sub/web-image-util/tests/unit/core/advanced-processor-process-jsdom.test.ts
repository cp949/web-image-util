/**
 * AdvancedImageProcessor.processImage resize 옵션-결과 매핑 행동 테스트
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdvancedImageProcessor } from '../../../src/core/advanced-processor';
import { createDrawableSource, createMockImage } from './advanced-processor-branches.helpers';
import { installImageDataMock, makeResizeResult, mockSmartResize } from './advanced-processor-process.helpers';

describe('AdvancedImageProcessor.processImage resize 옵션', () => {
  let smartResizeSpy: ReturnType<typeof mockSmartResize>;

  beforeEach(() => {
    smartResizeSpy = mockSmartResize();
    installImageDataMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resize 옵션만 지정', () => {
    it('결과 canvas 는 smartResize 스텁 canvas 와 동일 참조다', async () => {
      const stubResult = makeResizeResult(300, 200);
      smartResizeSpy.mockResolvedValue(stubResult as any);

      const img = createMockImage(800, 600);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 300, height: 200 },
      });

      expect(result.canvas).toBe(stubResult.canvas);
    });

    it('processing.resizing 은 스텁 optimizations 와 일치한다', async () => {
      const stubResult = makeResizeResult(300, 200);
      smartResizeSpy.mockResolvedValue(stubResult as any);

      const img = createMockImage(800, 600);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 300, height: 200 },
      });

      expect(result.processing.resizing).toEqual(stubResult.optimizations);
    });

    it('AutoHighResProcessor.smartResize 가 source·width·height 를 올바른 순서로 받는다', async () => {
      const stubResult = makeResizeResult(300, 200);
      smartResizeSpy.mockResolvedValue(stubResult as any);

      const img = createMockImage(800, 600);
      await AdvancedImageProcessor.processImage(img, {
        resize: { width: 300, height: 200 },
      });

      expect(smartResizeSpy).toHaveBeenCalledWith(img, 300, 200, expect.any(Object));
    });

    it('filtersApplied 는 0 이다', async () => {
      const img = createMockImage(800, 600);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 300, height: 200 },
      });

      expect(result.processing.filtersApplied).toBe(0);
    });

    it('watermarkApplied 는 false 이다', async () => {
      const img = createMockImage(800, 600);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 300, height: 200 },
      });

      expect(result.processing.watermarkApplied).toBe(false);
    });

    it('blob 은 undefined 이다', async () => {
      const img = createMockImage(800, 600);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 300, height: 200 },
      });

      expect(result.blob).toBeUndefined();
    });

    it('stats.totalProcessingTime 과 memoryPeakUsage 가 number 이고 memoryPeakUsage 는 스텁값과 일치한다', async () => {
      const stubResult = makeResizeResult(300, 200);
      smartResizeSpy.mockResolvedValue(stubResult as any);

      const img = createMockImage(800, 600);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 300, height: 200 },
      });

      expect(typeof result.stats.totalProcessingTime).toBe('number');
      expect(result.stats.memoryPeakUsage).toBe(5);
      expect(result.stats.finalFileSize).toBeUndefined();
    });

    it('resizingResult.userMessage 가 있으면 result.messages 에 포함된다', async () => {
      const stubResult = makeResizeResult(300, 200, '고해상도 이미지로 인해 품질이 낮아졌습니다.');
      smartResizeSpy.mockResolvedValue(stubResult as any);

      const img = createMockImage(800, 600);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 300, height: 200 },
      });

      expect(result.messages).toContain('고해상도 이미지로 인해 품질이 낮아졌습니다.');
    });

    it('resizingResult.userMessage 가 없으면 해당 문자열이 messages 에 없다', async () => {
      const stubResult = makeResizeResult(300, 200);
      smartResizeSpy.mockResolvedValue(stubResult as any);

      const img = createMockImage(800, 600);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 300, height: 200 },
      });

      expect(result.messages.some((m) => m.includes('품질이 낮아졌습니다'))).toBe(false);
    });

    it('resize.priority 가 smartResize 4번째 인자로 전달된다', async () => {
      const stubResult = makeResizeResult(300, 200);
      smartResizeSpy.mockResolvedValue(stubResult as any);

      const img = createMockImage(800, 600);
      await AdvancedImageProcessor.processImage(img, {
        resize: { width: 300, height: 200, priority: 'quality' },
      });

      expect(smartResizeSpy).toHaveBeenCalledWith(img, 300, 200, expect.objectContaining({ priority: 'quality' }));
    });
  });

  describe('resize 옵션 없음', () => {
    it('AutoHighResProcessor.smartResize 를 호출하지 않는다', async () => {
      const source = createDrawableSource(100, 80);
      await AdvancedImageProcessor.processImage(source, {});

      expect(smartResizeSpy).not.toHaveBeenCalled();
    });

    it('결과 canvas 크기는 소스 width × height 와 일치한다', async () => {
      const source = createDrawableSource(100, 80);
      const result = await AdvancedImageProcessor.processImage(source, {});

      expect(result.canvas.width).toBe(100);
      expect(result.canvas.height).toBe(80);
    });

    it('processing.resizing 은 undefined 이고 stats.memoryPeakUsage 는 0 이다', async () => {
      const source = createDrawableSource(100, 80);
      const result = await AdvancedImageProcessor.processImage(source, {});

      expect(result.processing.resizing).toBeUndefined();
      expect(result.stats.memoryPeakUsage).toBe(0);
    });
  });
});
