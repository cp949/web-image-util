import { describe, expect, it } from 'vitest';
import { HighResolutionProcessor } from '../../../src/core/high-res-processor';
import { createDrawableImage } from './high-res-processor.helpers';

describe('HighResolutionProcessor.resize', () => {
  describe('기본 동작', () => {
    it('반환 canvas 크기는 targetWidth×targetHeight 다', async () => {
      const img = createDrawableImage(1000, 1000);
      const result = await HighResolutionProcessor.resize(img, 400, 300);

      expect(result.canvas.width).toBe(400);
      expect(result.canvas.height).toBe(300);
    });

    it('priority 를 생략하면 결과의 priority 는 balanced 다', async () => {
      const img = createDrawableImage(1000, 1000);
      const result = await HighResolutionProcessor.resize(img, 400, 300);

      expect(result.priority).toBe('balanced');
    });

    it('결과에 analysis 가 소스 이미지 크기를 반영해 포함된다', async () => {
      const img = createDrawableImage(1000, 1000);
      const result = await HighResolutionProcessor.resize(img, 400, 300);

      expect(result.analysis.width).toBe(1000);
      expect(result.analysis.height).toBe(1000);
    });
  });
});
