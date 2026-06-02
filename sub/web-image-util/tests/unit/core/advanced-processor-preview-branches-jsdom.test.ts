/**
 * AdvancedImageProcessor.previewProcessing의 resize, filters, estimatedFileSize
 * 미커버 분기를 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdvancedImageProcessor, AutoHighResProcessor, filterManager, ImagePurpose } from '../../../src/advanced-index';
import { createMockImage, makeValidationResult } from './advanced-processor-branches.helpers';

// ==========================================================================
// previewProcessing 분기
// ==========================================================================
describe('AdvancedImageProcessor.previewProcessing 분기', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // resize 없음 — 기본값 경로
  // -----------------------------------------------------------------------
  describe('resize 옵션 없음', () => {
    it('AutoHighResProcessor.validateProcessing을 호출하지 않는다', async () => {
      const validateSpy = vi.spyOn(AutoHighResProcessor, 'validateProcessing');

      const img = createMockImage();
      await AdvancedImageProcessor.previewProcessing(img, {});

      expect(validateSpy).not.toHaveBeenCalled();
    });

    it('estimatedTime 기본값은 1이고 estimatedMemory 기본값은 50이다', async () => {
      const img = createMockImage();
      const result = await AdvancedImageProcessor.previewProcessing(img, {});

      expect(result.estimatedTime).toBe(1);
      expect(result.estimatedMemory).toBe(50);
    });

    it('경고가 없으면 canProcess가 true이다', async () => {
      const img = createMockImage();
      const result = await AdvancedImageProcessor.previewProcessing(img, {});

      expect(result.canProcess).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // resize 있음 — validateProcessing 호출 및 값 누적
  // -----------------------------------------------------------------------
  describe('resize 옵션 있음', () => {
    let validateSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      validateSpy = vi
        .spyOn(AutoHighResProcessor, 'validateProcessing')
        .mockReturnValue(makeValidationResult({ estimatedTime: 3, estimatedMemory: 120 }));
    });

    it('AutoHighResProcessor.validateProcessing이 source · width · height를 인자로 받는다', async () => {
      const img = createMockImage(800, 600);
      await AdvancedImageProcessor.previewProcessing(img, { resize: { width: 400, height: 300 } });

      expect(validateSpy).toHaveBeenCalledWith(img, 400, 300);
    });

    it('estimatedTime은 기본값 1에 validation.estimatedTime이 더해진다', async () => {
      const img = createMockImage();
      const result = await AdvancedImageProcessor.previewProcessing(img, { resize: { width: 200, height: 200 } });

      // 기본 1 + 스텁 3 = 4
      expect(result.estimatedTime).toBe(4);
    });

    it('estimatedMemory는 기본 50과 validation.estimatedMemory 중 큰 값을 사용한다', async () => {
      const img = createMockImage();
      const result = await AdvancedImageProcessor.previewProcessing(img, { resize: { width: 200, height: 200 } });

      // Math.max(50, 120) = 120
      expect(result.estimatedMemory).toBe(120);
    });

    it('validation.estimatedMemory가 50 미만이면 하한 50을 유지한다', async () => {
      // Math.max(50, 30) = 50 — 이 분기가 없으면 30이 그대로 노출되는 회귀를 잡는다
      validateSpy.mockReturnValue(makeValidationResult({ estimatedTime: 1, estimatedMemory: 30 }));

      const img = createMockImage();
      const result = await AdvancedImageProcessor.previewProcessing(img, { resize: { width: 200, height: 200 } });

      expect(result.estimatedMemory).toBe(50);
    });

    it('validation이 반환한 warnings가 결과에 포함된다', async () => {
      validateSpy.mockReturnValue(
        makeValidationResult({ warnings: ['큰 이미지입니다'], estimatedTime: 2, estimatedMemory: 80 })
      );

      const img = createMockImage();
      const result = await AdvancedImageProcessor.previewProcessing(img, { resize: { width: 200, height: 200 } });

      expect(result.warnings).toContain('큰 이미지입니다');
    });

    it('warnings가 있으면 canProcess가 false이다', async () => {
      validateSpy.mockReturnValue(
        makeValidationResult({ warnings: ['처리 불가 경고'], estimatedTime: 2, estimatedMemory: 80 })
      );

      const img = createMockImage();
      const result = await AdvancedImageProcessor.previewProcessing(img, { resize: { width: 200, height: 200 } });

      expect(result.canProcess).toBe(false);
    });

    it('validation.recommendations가 결과에 포함된다', async () => {
      validateSpy.mockReturnValue(
        makeValidationResult({
          recommendations: ['더 작은 크기로 줄이세요'],
          estimatedTime: 2,
          estimatedMemory: 80,
        })
      );

      const img = createMockImage();
      const result = await AdvancedImageProcessor.previewProcessing(img, { resize: { width: 200, height: 200 } });

      expect(result.recommendations).toContain('더 작은 크기로 줄이세요');
    });
  });

  // -----------------------------------------------------------------------
  // filters 분기
  // -----------------------------------------------------------------------
  describe('filters 옵션 분기', () => {
    it('filters 미전달 시 filterManager.validateFilterChain을 호출하지 않는다', async () => {
      const validateChainSpy = vi.spyOn(filterManager, 'validateFilterChain');

      const img = createMockImage();
      await AdvancedImageProcessor.previewProcessing(img, {});

      expect(validateChainSpy).not.toHaveBeenCalled();
    });

    it('filters 전달 시 filterManager.validateFilterChain이 해당 chain으로 호출된다', async () => {
      const validateChainSpy = vi
        .spyOn(filterManager, 'validateFilterChain')
        .mockReturnValue({ valid: true, warnings: [] });

      const chain = { filters: [] };
      const img = createMockImage();
      await AdvancedImageProcessor.previewProcessing(img, { filters: chain });

      expect(validateChainSpy).toHaveBeenCalledWith(chain);
    });

    it('filterValidation.valid가 false이지만 errors가 없으면 warnings가 비어 canProcess가 true로 유지된다', async () => {
      // errors 프로퍼티 없음 → || [] 폴백 → warnings 추가 없음 → canProcess true
      vi.spyOn(filterManager, 'validateFilterChain').mockReturnValue({
        valid: false,
        warnings: [],
      });

      const img = createMockImage();
      const result = await AdvancedImageProcessor.previewProcessing(img, { filters: { filters: [] } });

      expect(result.warnings).toHaveLength(0);
      expect(result.canProcess).toBe(true);
    });

    it('filterValidation.valid가 false이면 errors가 warnings에 추가되어 canProcess가 false이다', async () => {
      vi.spyOn(filterManager, 'validateFilterChain').mockReturnValue({
        valid: false,
        errors: ['알 수 없는 필터'],
        warnings: [],
      });

      const img = createMockImage();
      const result = await AdvancedImageProcessor.previewProcessing(img, { filters: { filters: [] } });

      expect(result.warnings).toContain('알 수 없는 필터');
      expect(result.canProcess).toBe(false);
    });

    it('filterValidation.warnings가 있으면 결과 warnings에 포함된다', async () => {
      vi.spyOn(filterManager, 'validateFilterChain').mockReturnValue({
        valid: true,
        warnings: ['성능 경고: 필터 수가 많습니다'],
      });

      const img = createMockImage();
      const result = await AdvancedImageProcessor.previewProcessing(img, { filters: { filters: [] } });

      expect(result.warnings).toContain('성능 경고: 필터 수가 많습니다');
    });

    it('필터 수에 비례해 estimatedTime이 증가한다 (필터당 0.5초)', async () => {
      vi.spyOn(filterManager, 'validateFilterChain').mockReturnValue({ valid: true });

      const chain = {
        filters: [
          { name: 'brightness', params: {} },
          { name: 'contrast', params: {} },
        ],
      };
      const img = createMockImage();
      const result = await AdvancedImageProcessor.previewProcessing(img, { filters: chain });

      // 기본 1 + 2개 × 0.5 = 2.0
      expect(result.estimatedTime).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // estimatedFileSize 계산 분기
  // -----------------------------------------------------------------------
  describe('estimatedFileSize 계산 분기', () => {
    beforeEach(() => {
      // resize가 있는 테스트에서 validateProcessing을 격리
      vi.spyOn(AutoHighResProcessor, 'validateProcessing').mockReturnValue(makeValidationResult());
    });

    it('format 또는 resize가 없으면 estimatedFileSize가 undefined이다', async () => {
      const img = createMockImage();
      const result = await AdvancedImageProcessor.previewProcessing(img, {});

      expect(result.estimatedFileSize).toBeUndefined();
    });

    it('resize 없이 format만 있으면 estimatedFileSize가 undefined이다', async () => {
      const img = createMockImage();
      const result = await AdvancedImageProcessor.previewProcessing(img, { format: 'jpeg' });

      expect(result.estimatedFileSize).toBeUndefined();
    });

    it("format: 'auto' + resize 조합이면 픽셀 × 0.5 × 0.3 기반 KB가 반환된다", async () => {
      const img = createMockImage();
      const result = await AdvancedImageProcessor.previewProcessing(img, {
        resize: { width: 1000, height: 1000 },
        format: 'auto',
      });

      const expectedKB = Math.round((1000 * 1000 * 0.5 * 0.3) / 1024);
      expect(result.estimatedFileSize).toBe(expectedKB);
    });

    it("format: 'jpeg' + resize 조합이면 formatMultiplier(0.3) 적용 KB가 반환된다", async () => {
      const img = createMockImage();
      const result = await AdvancedImageProcessor.previewProcessing(img, {
        resize: { width: 1000, height: 1000 },
        format: 'jpeg',
      });

      const expectedKB = Math.round((1000 * 1000 * 0.5 * 0.3) / 1024);
      expect(result.estimatedFileSize).toBe(expectedKB);
    });

    it("format: 'png' + resize 조합이면 formatMultiplier(1.0) 적용 KB가 반환된다", async () => {
      const img = createMockImage();
      const result = await AdvancedImageProcessor.previewProcessing(img, {
        resize: { width: 1000, height: 1000 },
        format: 'png',
      });

      const expectedKB = Math.round((1000 * 1000 * 0.5 * 1.0) / 1024);
      expect(result.estimatedFileSize).toBe(expectedKB);
    });

    it('SmartFormatOptions 객체 format + resize이면 30% 기준 KB가 반환된다', async () => {
      const img = createMockImage();
      const result = await AdvancedImageProcessor.previewProcessing(img, {
        resize: { width: 1000, height: 1000 },
        format: { purpose: ImagePurpose.THUMBNAIL },
      });

      // typeof format === 'object' → 0.3 배율
      const expectedKB = Math.round((1000 * 1000 * 0.5 * 0.3) / 1024);
      expect(result.estimatedFileSize).toBe(expectedKB);
    });

    it("format: 'webp' + resize이면 formatMultiplier(0.25) 적용 KB가 반환된다", async () => {
      const img = createMockImage();
      const result = await AdvancedImageProcessor.previewProcessing(img, {
        resize: { width: 1000, height: 1000 },
        format: 'webp',
      });

      const expectedKB = Math.round((1000 * 1000 * 0.5 * 0.25) / 1024);
      expect(result.estimatedFileSize).toBe(expectedKB);
    });

    it("format: 'avif' + resize이면 formatMultiplier(0.2) 적용 KB가 반환된다", async () => {
      const img = createMockImage();
      const result = await AdvancedImageProcessor.previewProcessing(img, {
        resize: { width: 1000, height: 1000 },
        format: 'avif',
      });

      const expectedKB = Math.round((1000 * 1000 * 0.5 * 0.2) / 1024);
      expect(result.estimatedFileSize).toBe(expectedKB);
    });

    it('맵에 없는 포맷 문자열이면 폴백 multiplier(0.5) KB가 반환된다', async () => {
      // formatMultiplier 룩업에 없는 포맷 → || 0.5 폴백 분기
      const img = createMockImage();
      const result = await AdvancedImageProcessor.previewProcessing(img, {
        resize: { width: 1000, height: 1000 },
        format: 'bmp' as any,
      });

      const expectedKB = Math.round((1000 * 1000 * 0.5 * 0.5) / 1024);
      expect(result.estimatedFileSize).toBe(expectedKB);
    });
  });
});
