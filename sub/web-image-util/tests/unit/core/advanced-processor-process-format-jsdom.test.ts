/**
 * AdvancedImageProcessor.processImage 포맷 최적화 옵션 매핑 테스트
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdvancedImageProcessor } from '../../../src/core/advanced-processor';
import { SmartFormatSelector } from '../../../src/core/smart-format';
import { ImagePurpose, type SmartFormatOptions } from '../../../src/core/smart-format-helpers.internal';
import { createMockImage } from './advanced-processor-branches.helpers';
import { installImageDataMock, makeFormatResult, mockSmartResize } from './advanced-processor-process.helpers';

describe('AdvancedImageProcessor.processImage format 옵션', () => {
  beforeEach(() => {
    mockSmartResize();
    installImageDataMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('format "auto" 옵션', () => {
    it('SmartFormatSelector.selectOptimalFormat 이 { purpose: ImagePurpose.WEB } 를 받아 1회 호출된다', async () => {
      const formatSpy = vi
        .spyOn(SmartFormatSelector, 'selectOptimalFormat')
        .mockResolvedValue(makeFormatResult() as any);

      const img = createMockImage(200, 150);
      await AdvancedImageProcessor.processImage(img, {
        resize: { width: 200, height: 150 },
        format: 'auto',
      });

      expect(formatSpy).toHaveBeenCalledOnce();
      expect(formatSpy).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), { purpose: ImagePurpose.WEB });
    });

    it('result.blob 이 존재하고 blob.type 이 mock mimeType 과 일치한다', async () => {
      vi.spyOn(SmartFormatSelector, 'selectOptimalFormat').mockResolvedValue(makeFormatResult() as any);

      const img = createMockImage(200, 150);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 200, height: 150 },
        format: 'auto',
      });

      expect(result.blob).toBeDefined();
      expect(result.blob!.type).toBe('image/jpeg');
    });

    it('processing.formatOptimization 필드가 mock 고정값으로 채워진다', async () => {
      vi.spyOn(SmartFormatSelector, 'selectOptimalFormat').mockResolvedValue(makeFormatResult() as any);

      const img = createMockImage(200, 150);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 200, height: 150 },
        format: 'auto',
      });

      expect(result.processing.formatOptimization?.finalFormat).toBe('jpeg');
      expect(result.processing.formatOptimization?.quality).toBe(0.9);
      expect(result.processing.formatOptimization?.estimatedSavings).toBe(0.1);
    });

    it('stats.finalFileSize 는 result.blob.size 와 일치한다', async () => {
      vi.spyOn(SmartFormatSelector, 'selectOptimalFormat').mockResolvedValue(makeFormatResult() as any);

      const img = createMockImage(200, 150);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 200, height: 150 },
        format: 'auto',
      });

      expect(result.blob).toBeDefined();
      expect(result.stats.finalFileSize).toBe(result.blob!.size);
    });

    it('messages 에 "Format optimization:" 으로 시작하는 항목이 포함된다', async () => {
      vi.spyOn(SmartFormatSelector, 'selectOptimalFormat').mockResolvedValue(makeFormatResult() as any);

      const img = createMockImage(200, 150);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 200, height: 150 },
        format: 'auto',
      });

      expect(result.messages.some((m) => m.startsWith('Format optimization:'))).toBe(true);
    });
  });

  describe('format SmartFormatOptions 객체 옵션', () => {
    it('SmartFormatSelector.selectOptimalFormat 이 전달한 options 객체 그대로 받는다', async () => {
      const formatSpy = vi
        .spyOn(SmartFormatSelector, 'selectOptimalFormat')
        .mockResolvedValue(makeFormatResult() as any);

      const customOptions: SmartFormatOptions = { purpose: ImagePurpose.WEB, maxSizeKB: 100 };
      const img = createMockImage(200, 150);
      await AdvancedImageProcessor.processImage(img, {
        resize: { width: 200, height: 150 },
        format: customOptions,
      });

      expect(formatSpy).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), customOptions);
    });

    it('formatOptimization 이 채워지고 messages 에 Format optimization 이 포함된다', async () => {
      vi.spyOn(SmartFormatSelector, 'selectOptimalFormat').mockResolvedValue(makeFormatResult() as any);

      const img = createMockImage(200, 150);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 200, height: 150 },
        format: { purpose: ImagePurpose.WEB, maxSizeKB: 100 } as SmartFormatOptions,
      });

      expect(result.processing.formatOptimization?.finalFormat).toBe('jpeg');
      expect(result.blob).toBeDefined();
      expect(result.blob!.type).toBe('image/jpeg');
      expect(result.messages.some((m) => m.startsWith('Format optimization:'))).toBe(true);
    });
  });

  describe('format 실패 시 graceful degradation', () => {
    it('selectOptimalFormat 거부 시 blob 은 undefined, formatOptimization 은 undefined, messages 에 실패 메시지가 포함된다', async () => {
      vi.spyOn(SmartFormatSelector, 'selectOptimalFormat').mockRejectedValue(new Error('format error'));

      const img = createMockImage(200, 150);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 200, height: 150 },
        format: 'auto',
      });

      expect(result.blob).toBeUndefined();
      expect(result.processing.formatOptimization).toBeUndefined();
      expect(result.messages).toContain('Format optimization failed.');
    });
  });

  describe('format "jpeg" 명시 옵션', () => {
    it('result.blob 이 존재하고 finalFormat 이 "jpeg" 이며 quality 가 0.8 이다', async () => {
      const img = createMockImage(200, 150);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 200, height: 150 },
        format: 'jpeg',
      });

      expect(result.blob).toBeDefined();
      expect(result.processing.formatOptimization?.finalFormat).toBe('jpeg');
      expect(result.processing.formatOptimization?.quality).toBe(0.8);
      expect(result.blob!.type).toBe('image/jpeg');
    });
  });
});
