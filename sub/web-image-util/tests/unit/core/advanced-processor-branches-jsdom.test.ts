/**
 * AdvancedImageProcessor.createThumbnail / previewProcessing 미커버 분기와
 * processImage 단계 스킵 분기(빈 필터·빈 워터마크)를 검증한다.
 *
 * PLAN 20260514-07 행동 테스트가 닿지 못한 분기만 대상으로 한다.
 * 이미 커버된 format 선택 3분기·resize/filters/watermark 미전달 경로는 제외한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdvancedImageProcessor, AutoHighResProcessor, filterManager, ImagePurpose } from '../../../src/advanced-index';

/** width · height를 제어하는 이미지 픽스처 */
function createMockImage(width = 100, height = 100): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  return img;
}

/** drawImage 소스로 사용할 수 있는 Canvas 기반 픽스처 */
function createDrawableSource(width = 100, height = 100): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas as unknown as HTMLImageElement;
}

/** processImage 스텁 반환값 — blob 유무 선택 가능 */
function makeProcessResult(opts: { withBlob?: boolean } = {}) {
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
function makeValidationResult(
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

// ==========================================================================
// createThumbnail 분기
// ==========================================================================
describe('AdvancedImageProcessor.createThumbnail 분기', () => {
  let processImageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // processImage를 스텁해 실제 렌더링 없이 즉시 결과 반환
    processImageSpy = vi
      .spyOn(AdvancedImageProcessor, 'processImage')
      .mockResolvedValue(makeProcessResult({ withBlob: true }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // 소스·캔버스 위임 단정 — 핵심 계약
  // -----------------------------------------------------------------------
  describe('소스·캔버스 위임 단정', () => {
    it('processImage에 전달한 source와 반환된 canvas가 동일 참조이다', async () => {
      const img = createMockImage();
      const stubResult = makeProcessResult({ withBlob: true });
      processImageSpy.mockResolvedValue(stubResult as any);

      const result = await AdvancedImageProcessor.createThumbnail(img, 100);

      // source 인자가 그대로 processImage에 전달됐는지 확인
      expect(processImageSpy.mock.calls[0]?.[0]).toBe(img);
      // 반환 canvas가 processImage 결과의 canvas와 동일 참조인지 확인
      expect(result.canvas).toBe(stubResult.canvas);
    });
  });

  // -----------------------------------------------------------------------
  // size 타입 분기
  // -----------------------------------------------------------------------
  describe('size 인자 타입 분기', () => {
    it('size가 number이면 width · height 모두 같은 값으로 resize에 매핑된다', async () => {
      const img = createMockImage();
      await AdvancedImageProcessor.createThumbnail(img, 200);

      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.resize?.width).toBe(200);
      expect(opts?.resize?.height).toBe(200);
    });

    it('size가 객체이면 width · height가 그대로 resize에 매핑된다', async () => {
      const img = createMockImage();
      await AdvancedImageProcessor.createThumbnail(img, { width: 320, height: 180 });

      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.resize?.width).toBe(320);
      expect(opts?.resize?.height).toBe(180);
    });
  });

  // -----------------------------------------------------------------------
  // quality → priority 매핑 분기
  // -----------------------------------------------------------------------
  describe('quality → priority 매핑 분기', () => {
    it("quality: 'fast' 는 priority: 'speed' 로 매핑된다", async () => {
      const img = createMockImage();
      await AdvancedImageProcessor.createThumbnail(img, 100, { quality: 'fast' });

      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.resize?.priority).toBe('speed');
    });

    it("quality: 'high' 는 priority: 'quality' 로 매핑된다", async () => {
      const img = createMockImage();
      await AdvancedImageProcessor.createThumbnail(img, 100, { quality: 'high' });

      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.resize?.priority).toBe('quality');
    });

    it("quality: 'balanced' 는 priority: 'balanced' 로 매핑된다", async () => {
      const img = createMockImage();
      await AdvancedImageProcessor.createThumbnail(img, 100, { quality: 'balanced' });

      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.resize?.priority).toBe('balanced');
    });

    it('quality 미전달 시 기본값 balanced가 사용된다', async () => {
      const img = createMockImage();
      await AdvancedImageProcessor.createThumbnail(img, 100);

      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.resize?.priority).toBe('balanced');
    });
  });

  // -----------------------------------------------------------------------
  // watermark 분기
  // -----------------------------------------------------------------------
  describe('watermark 옵션 분기', () => {
    it('watermark 문자열 전달 시 watermark.text에 text·position·style·size가 모두 설정된다', async () => {
      const img = createMockImage();
      await AdvancedImageProcessor.createThumbnail(img, 100, { watermark: '© Test' });

      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.watermark?.text).toMatchObject({
        text: '© Test',
        position: 'bottom-right',
        style: 'subtle',
        size: 'small',
      });
    });

    it('watermark 미전달 시 watermark 옵션이 undefined로 전달된다', async () => {
      const img = createMockImage();
      await AdvancedImageProcessor.createThumbnail(img, 100);

      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.watermark).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // format 분기
  // -----------------------------------------------------------------------
  describe('format 옵션 분기', () => {
    it('format 지정 시 해당 format이 processImage에 그대로 전달된다', async () => {
      const img = createMockImage();
      await AdvancedImageProcessor.createThumbnail(img, 100, { format: 'webp' });

      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.format).toBe('webp');
    });

    it('format 미전달 시 THUMBNAIL 목적의 SmartFormatOptions 객체가 기본값으로 전달된다', async () => {
      const img = createMockImage();
      await AdvancedImageProcessor.createThumbnail(img, 100);

      const opts = processImageSpy.mock.calls[0]?.[1];
      // purpose: THUMBNAIL, maxSizeKB: 50 가 기본 포맷 힌트
      expect(opts?.format).toMatchObject({ purpose: ImagePurpose.THUMBNAIL, maxSizeKB: 50 });
    });
  });

  // -----------------------------------------------------------------------
  // Blob 반환 분기
  // -----------------------------------------------------------------------
  describe('Blob 반환 분기', () => {
    it('processImage가 blob을 반환하면 해당 blob이 그대로 반환된다', async () => {
      const existingBlob = new Blob(['img'], { type: 'image/jpeg' });
      const stub = { ...makeProcessResult({ withBlob: false }), blob: existingBlob };
      processImageSpy.mockResolvedValue(stub as any);

      const img = createMockImage();
      const result = await AdvancedImageProcessor.createThumbnail(img, 100);

      expect(result.blob).toBe(existingBlob);
    });

    it('processImage가 blob을 반환하지 않으면 JPEG 폴백 blob이 생성된다', async () => {
      // blob 없는 결과 → createThumbnail이 canvas.toBlob으로 JPEG를 직접 생성
      processImageSpy.mockResolvedValue(makeProcessResult({ withBlob: false }) as any);

      const img = createMockImage();
      const result = await AdvancedImageProcessor.createThumbnail(img, 100);

      expect(result.blob).toBeDefined();
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob!.type).toBe('image/jpeg');
    });

    it('canvas.toBlob 콜백이 null을 받으면 "Blob creation failed" 에러로 reject된다', async () => {
      // blob 없는 결과 → createThumbnail이 canvas.toBlob 경로에 진입
      processImageSpy.mockResolvedValue(makeProcessResult({ withBlob: false }) as any);
      // toBlob 콜백을 null로 강제 호출해 reject 분기 유도
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
        callback(null);
      });

      const img = createMockImage();
      await expect(AdvancedImageProcessor.createThumbnail(img, 100)).rejects.toThrow('Blob creation failed');
    });

    it('반환값은 canvas · blob만으로 구성된다 (AdvancedProcessingResult 전체 반환 회귀 방지)', async () => {
      const img = createMockImage();
      const result = await AdvancedImageProcessor.createThumbnail(img, 100);

      expect(result).toHaveProperty('canvas');
      expect(result).toHaveProperty('blob');
      expect(result).not.toHaveProperty('processing');
      expect(result).not.toHaveProperty('stats');
      expect(result).not.toHaveProperty('messages');
    });
  });
});

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

// ==========================================================================
// processImage 단계 스킵 분기 — 기존 테스트 미커버 경로만
// ==========================================================================
describe('processImage 단계 스킵 분기', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('filters.filters가 빈 배열이면 필터 블록을 건너뛴다 (applyFilterChain 미호출)', async () => {
    // options.filters는 존재하지만 filters.length === 0 → 필터 블록을 건너뜀
    // filtersApplied === 0 단독으로는 실행/스킵을 구분 못 하므로 spy로 직접 검증
    const applyChainSpy = vi.spyOn(filterManager, 'applyFilterChain');

    const source = createDrawableSource(100, 100);
    const result = await AdvancedImageProcessor.processImage(source, {
      filters: { filters: [] },
    });

    expect(result.processing.filtersApplied).toBe(0);
    expect(applyChainSpy).not.toHaveBeenCalled();
  });

  it('watermark 객체가 있지만 text · image 모두 없으면 watermarkApplied가 false이다', async () => {
    // options.watermark는 truthy지만 text·image 둘 다 없어 watermarkApplied가 설정되지 않음
    const source = createDrawableSource(100, 100);
    const result = await AdvancedImageProcessor.processImage(source, {
      watermark: {},
    });

    expect(result.processing.watermarkApplied).toBe(false);
  });

  it('watermark 객체가 있지만 text · image 모두 없으면 "Watermark applied." 메시지가 없다', async () => {
    const source = createDrawableSource(100, 100);
    const result = await AdvancedImageProcessor.processImage(source, {
      watermark: {},
    });

    expect(result.messages).not.toContain('Watermark applied.');
  });
});
