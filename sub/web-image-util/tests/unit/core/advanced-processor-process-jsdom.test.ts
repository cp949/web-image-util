/**
 * AdvancedImageProcessor.processImage 옵션-결과 매핑 행동 테스트
 *
 * AutoHighResProcessor.smartResize / SmartFormatSelector.selectOptimalFormat /
 * SimpleWatermark.addText 를 vi.spyOn 으로 격리해
 * 파이프라인 단계별 메타데이터 계약을 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SimpleImageWatermarkOptions } from '../../../src/composition/simple-watermark';
import { SimpleWatermark } from '../../../src/composition/simple-watermark';
import { AdvancedImageProcessor } from '../../../src/core/advanced-processor';
import { AutoHighResProcessor } from '../../../src/core/auto-high-res';
import type { SmartFormatOptions } from '../../../src/core/smart-format';
import { ImagePurpose, SmartFormatSelector } from '../../../src/core/smart-format';

// width / height 를 제어하는 이미지 픽스처 (resize 경로에서 사용)
function createMockImage(width: number, height: number): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  return img;
}

// drawImage 소스로 사용 가능한 Canvas 기반 픽스처 (no-resize 경로에서 사용)
function createDrawableSource(width: number, height: number): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas as unknown as HTMLImageElement;
}

// AutoHighResProcessor.smartResize 스텁 반환값
function makeResizeResult(canvasW = 200, canvasH = 150, userMessage?: string) {
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  return {
    canvas,
    optimizations: {
      strategy: 'direct',
      memoryOptimized: false,
      tileProcessing: false,
      estimatedTimeSaved: 0,
    },
    stats: {
      originalSize: { width: 800, height: 600 },
      finalSize: { width: canvasW, height: canvasH },
      processingTime: 0.01,
      memoryPeakUsage: 5,
      qualityLevel: 'balanced' as const,
    },
    ...(userMessage !== undefined ? { userMessage } : {}),
  };
}

// SmartFormatSelector.selectOptimalFormat 스텁 반환값
// jpeg 로 고정 — 누락·오필드·인자순서 뒤바뀜 시 jsdom 기본값(image/png)과 달라져 blob.type 단정이 유효해진다
function makeFormatResult() {
  return {
    format: 'jpeg',
    mimeType: 'image/jpeg',
    quality: 0.9,
    reason: '테스트용 포맷 선택',
    alternatives: [],
    estimatedSavings: 0.1,
  };
}

describe('AdvancedImageProcessor.processImage 옵션-결과 매핑', () => {
  let smartResizeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // AutoHighResProcessor.smartResize 격리
    smartResizeSpy = vi.spyOn(AutoHighResProcessor, 'smartResize').mockResolvedValue(makeResizeResult() as any);

    // jsdom 미구현 전역 보강
    globalThis.ImageData = class MockImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;

      constructor(data: Uint8ClampedArray, width: number, height: number) {
        this.data = data;
        this.width = width;
        this.height = height;
      }
    } as typeof ImageData;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // resize 옵션만 지정
  // --------------------------------------------------------------------------
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

      // width=300, height=200 순서가 뒤바뀌면 회귀 감지
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
      // makeResizeResult 에서 memoryPeakUsage: 5 로 고정
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
      // advanced-processor.ts:120-122 의 truthy 분기를 커버한다
      const stubResult = makeResizeResult(300, 200, '고해상도 이미지로 인해 품질이 낮아졌습니다.');
      smartResizeSpy.mockResolvedValue(stubResult as any);

      const img = createMockImage(800, 600);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 300, height: 200 },
      });

      expect(result.messages).toContain('고해상도 이미지로 인해 품질이 낮아졌습니다.');
    });

    it('resizingResult.userMessage 가 없으면 해당 문자열이 messages 에 없다', async () => {
      // userMessage 미설정 시 messages 에 삽입되지 않는 경계를 잠근다
      const stubResult = makeResizeResult(300, 200); // userMessage 없음
      smartResizeSpy.mockResolvedValue(stubResult as any);

      const img = createMockImage(800, 600);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 300, height: 200 },
      });

      expect(result.messages.some((m) => m.includes('품질이 낮아졌습니다'))).toBe(false);
    });

    it('resize.priority 가 smartResize 4번째 인자로 전달된다', async () => {
      // options.resize.priority 전파가 깨지면(필드명 오타 등) 감지한다
      const stubResult = makeResizeResult(300, 200);
      smartResizeSpy.mockResolvedValue(stubResult as any);

      const img = createMockImage(800, 600);
      await AdvancedImageProcessor.processImage(img, {
        resize: { width: 300, height: 200, priority: 'quality' },
      });

      expect(smartResizeSpy).toHaveBeenCalledWith(img, 300, 200, expect.objectContaining({ priority: 'quality' }));
    });
  });

  // --------------------------------------------------------------------------
  // resize 옵션 없음
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // watermark.text 옵션
  // --------------------------------------------------------------------------
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
      // 1번째 인자가 출력 캔버스 참조와 동일해야 워터마크가 실제로 결과에 반영된다
      // resize 경로에서 result.canvas 는 smartResize 스텁 canvas 이므로 참조 동일성 단정 가능
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

  // --------------------------------------------------------------------------
  // watermark.image 옵션
  // --------------------------------------------------------------------------
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
      // 1번째 인자가 출력 캔버스 참조와 동일해야 워터마크가 실제로 결과에 반영된다
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

  // --------------------------------------------------------------------------
  // format 'auto' 옵션
  // --------------------------------------------------------------------------
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
      // toBlob 에 mimeType 인자가 누락·오필드·순서 뒤바뀜 시 jsdom 기본값(image/png)이 되어 실패한다
      expect(result.blob!.type).toBe('image/jpeg');
    });

    it('processing.formatOptimization 필드가 mock 고정값으로 채워진다', async () => {
      // mock 이 'jpeg'/0.9/0.1 을 반환하므로 toBeDefined() 가 아닌 구체 값으로 잠근다
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
      // 소스: messages.push(`Format optimization: ${format.toUpperCase()} (${reason})`)
      vi.spyOn(SmartFormatSelector, 'selectOptimalFormat').mockResolvedValue(makeFormatResult() as any);

      const img = createMockImage(200, 150);
      const result = await AdvancedImageProcessor.processImage(img, {
        resize: { width: 200, height: 150 },
        format: 'auto',
      });

      expect(result.messages.some((m) => m.startsWith('Format optimization:'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // format SmartFormatOptions 객체 옵션 (3번째 분기)
  // --------------------------------------------------------------------------
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
      // toBlob 에 mimeType 인자가 누락·오필드·순서 뒤바뀜 시 jsdom 기본값(image/png)이 되어 실패한다
      expect(result.blob!.type).toBe('image/jpeg');
      expect(result.messages.some((m) => m.startsWith('Format optimization:'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // format 실패 시 graceful degradation
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // format 'jpeg' 명시 옵션
  // --------------------------------------------------------------------------
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
      // mimeType = `image/${format}` 조립이 회귀하면 blob.type 으로 감지
      expect(result.blob!.type).toBe('image/jpeg');
    });
  });

  // --------------------------------------------------------------------------
  // onProgress 콜백 시퀀스
  // --------------------------------------------------------------------------
  describe('onProgress 콜백 시퀀스', () => {
    it('resize + watermark + format 조합에서 stage 가 올바른 순서로 호출된다', async () => {
      vi.spyOn(SimpleWatermark, 'addText').mockImplementation((canvas) => canvas);

      const stages: string[] = [];
      const onProgress = (stage: string) => stages.push(stage);

      const img = createMockImage(200, 150);
      await AdvancedImageProcessor.processImage(img, {
        resize: { width: 200, height: 150 },
        watermark: { text: { text: '워터마크' } },
        format: 'jpeg',
        onProgress,
      });

      expect(stages).toEqual(['resizing', 'filtering', 'watermarking', 'optimizing', 'finalizing']);
    });

    it('resize 없을 때는 filtering 부터 시작해 finalizing 으로 끝난다', async () => {
      const stages: string[] = [];
      const onProgress = (stage: string) => stages.push(stage);

      const source = createDrawableSource(200, 150);
      await AdvancedImageProcessor.processImage(source, { onProgress });

      expect(stages).toEqual(['filtering', 'watermarking', 'optimizing', 'finalizing']);
    });
  });
});
