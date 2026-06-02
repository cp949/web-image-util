/**
 * AdvancedImageProcessor.processImage 워터마크 옵션 매핑 테스트
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SimpleImageWatermarkOptions } from '../../../src/composition/simple-watermark';
import { SimpleWatermark } from '../../../src/composition/simple-watermark';
import { AdvancedImageProcessor } from '../../../src/core/advanced-processor';
import { createMockImage } from './advanced-processor-branches.helpers';
import { installImageDataMock, mockSmartResize } from './advanced-processor-process.helpers';

describe('AdvancedImageProcessor.processImage watermark 옵션', () => {
  beforeEach(() => {
    mockSmartResize();
    installImageDataMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('watermark.text 옵션', () => {
    it('SimpleWatermark.addText 가 result.canvas 와 텍스트 옵션을 전달받아 정확히 1회 호출된다', async () => {
      const addTextSpy = vi.spyOn(SimpleWatermark, 'addText').mockImplementation((canvas) => canvas);

      const textOptions = { text: '테스트 워터마크' };
      const img = createMockImage(200, 150);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 200, height: 150 },
        watermark: { text: textOptions },
      });

      expect(addTextSpy).toHaveBeenCalledOnce();
      expect(addTextSpy).toHaveBeenCalledWith(result.canvas, textOptions);
    });

    it('watermarkApplied 는 true 이다', async () => {
      vi.spyOn(SimpleWatermark, 'addText').mockImplementation((canvas) => canvas);

      const img = createMockImage(200, 150);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 200, height: 150 },
        watermark: { text: { text: '테스트 워터마크' } },
      });

      expect(result.processing.watermarkApplied).toBe(true);
    });

    it('messages 에 "Watermark applied." 가 포함된다', async () => {
      vi.spyOn(SimpleWatermark, 'addText').mockImplementation((canvas) => canvas);

      const img = createMockImage(200, 150);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 200, height: 150 },
        watermark: { text: { text: '테스트 워터마크' } },
      });

      expect(result.messages).toContain('Watermark applied.');
    });
  });

  describe('watermark.image 옵션', () => {
    it('SimpleWatermark.addImage 가 result.canvas 와 이미지 옵션을 전달받아 정확히 1회 호출된다', async () => {
      const addImageSpy = vi.spyOn(SimpleWatermark, 'addImage').mockImplementation((canvas) => canvas);

      const watermarkImage = document.createElement('img');
      const imageOptions: SimpleImageWatermarkOptions = { image: watermarkImage };
      const img = createMockImage(200, 150);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 200, height: 150 },
        watermark: { image: imageOptions },
      });

      expect(addImageSpy).toHaveBeenCalledOnce();
      expect(addImageSpy).toHaveBeenCalledWith(result.canvas, imageOptions);
    });

    it('watermarkApplied 는 true 이다', async () => {
      vi.spyOn(SimpleWatermark, 'addImage').mockImplementation((canvas) => canvas);

      const watermarkImage = document.createElement('img');
      const img = createMockImage(200, 150);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 200, height: 150 },
        watermark: { image: { image: watermarkImage } },
      });

      expect(result.processing.watermarkApplied).toBe(true);
    });

    it('messages 에 "Watermark applied." 가 포함된다', async () => {
      vi.spyOn(SimpleWatermark, 'addImage').mockImplementation((canvas) => canvas);

      const watermarkImage = document.createElement('img');
      const img = createMockImage(200, 150);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 200, height: 150 },
        watermark: { image: { image: watermarkImage } },
      });

      expect(result.messages).toContain('Watermark applied.');
    });
  });
});
