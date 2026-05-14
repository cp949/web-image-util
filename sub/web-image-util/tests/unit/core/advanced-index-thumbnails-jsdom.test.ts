/**
 * createAdvancedThumbnail 옵션-결과 매핑 + JPEG fallback 행동 테스트
 *
 * AdvancedImageProcessor.processImage 를 vi.spyOn 으로 stub 해
 * 플랫폼 옵션 전달 계약과 blob 누락 시 JPEG fallback 경로를 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdvancedThumbnail } from '../../../src/advanced-index';
import { AdvancedImageProcessor } from '../../../src/core/advanced-processor';

// width / height 제어가 가능한 이미지 픽스처
function createMockImage(width = 100, height = 100): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  return img;
}

// processImage 스텁 반환값 — blob 이 있는 경우
function makeStubResult(withBlob = true) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const blob = withBlob ? new Blob(['stub'], { type: 'image/webp' }) : undefined;
  return {
    canvas,
    blob,
    processing: { filtersApplied: 0, watermarkApplied: false },
    stats: { totalProcessingTime: 1, memoryPeakUsage: 0 },
    messages: [],
  };
}

describe('createAdvancedThumbnail 옵션-결과 매핑', () => {
  let processImageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    processImageSpy = vi.spyOn(AdvancedImageProcessor, 'processImage').mockResolvedValue(makeStubResult() as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // resize 옵션 매핑
  // --------------------------------------------------------------------------
  describe('size 숫자 → resize 옵션', () => {
    it('size=64 → resize.width 와 resize.height 가 각각 64 이다', async () => {
      const img = createMockImage();
      await createAdvancedThumbnail(img, 64);

      const passedOptions = (processImageSpy.mock.calls[0] as any)[1];
      expect(passedOptions.resize.width).toBe(64);
      expect(passedOptions.resize.height).toBe(64);
    });

    it('quality 미지정 → resize.priority 가 "balanced" 이다', async () => {
      const img = createMockImage();
      await createAdvancedThumbnail(img, 64);

      const passedOptions = (processImageSpy.mock.calls[0] as any)[1];
      expect(passedOptions.resize.priority).toBe('balanced');
    });

    it('quality: "high" → resize.priority 가 "quality" 이다', async () => {
      const img = createMockImage();
      await createAdvancedThumbnail(img, 64, { quality: 'high' });

      const passedOptions = (processImageSpy.mock.calls[0] as any)[1];
      expect(passedOptions.resize.priority).toBe('quality');
    });

    it('quality: "fast" → resize.priority 가 "speed" 이다', async () => {
      const img = createMockImage();
      await createAdvancedThumbnail(img, 64, { quality: 'fast' });

      const passedOptions = (processImageSpy.mock.calls[0] as any)[1];
      expect(passedOptions.resize.priority).toBe('speed');
    });

    it('quality: "balanced" → resize.priority 가 "balanced" 이다', async () => {
      const img = createMockImage();
      await createAdvancedThumbnail(img, 64, { quality: 'balanced' });

      const passedOptions = (processImageSpy.mock.calls[0] as any)[1];
      expect(passedOptions.resize.priority).toBe('balanced');
    });
  });

  // --------------------------------------------------------------------------
  // format 기본값 및 명시
  // --------------------------------------------------------------------------
  describe('format 옵션', () => {
    it('format 미지정 → format 이 "auto" 이다', async () => {
      const img = createMockImage();
      await createAdvancedThumbnail(img, 64);

      const passedOptions = (processImageSpy.mock.calls[0] as any)[1];
      expect(passedOptions.format).toBe('auto');
    });

    it('format: "webp" 명시 → format 이 "webp" 이다', async () => {
      const img = createMockImage();
      await createAdvancedThumbnail(img, 64, { format: 'webp' });

      const passedOptions = (processImageSpy.mock.calls[0] as any)[1];
      expect(passedOptions.format).toBe('webp');
    });

    it('format: "jpeg" 명시 → format 이 "jpeg" 이다', async () => {
      const img = createMockImage();
      await createAdvancedThumbnail(img, 64, { format: 'jpeg' });

      const passedOptions = (processImageSpy.mock.calls[0] as any)[1];
      expect(passedOptions.format).toBe('jpeg');
    });
  });

  // --------------------------------------------------------------------------
  // watermark 옵션
  // --------------------------------------------------------------------------
  describe('watermark 문자열 → watermark.text 매핑', () => {
    it('watermark: "© 2024" → text, position, style, size 필드가 올바르게 전달된다', async () => {
      const img = createMockImage();
      await createAdvancedThumbnail(img, 64, { watermark: '© 2024' });

      const passedOptions = (processImageSpy.mock.calls[0] as any)[1];
      expect(passedOptions.watermark.text).toEqual({
        text: '© 2024',
        position: 'bottom-right',
        style: 'subtle',
        size: 'small',
      });
    });

    it('watermark 미지정 → watermark 필드가 undefined 이다', async () => {
      const img = createMockImage();
      await createAdvancedThumbnail(img, 64);

      const passedOptions = (processImageSpy.mock.calls[0] as any)[1];
      expect(passedOptions.watermark).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // 반환값 형태
  // --------------------------------------------------------------------------
  describe('반환값', () => {
    it('processImage 가 정확히 1회 호출된다', async () => {
      const img = createMockImage();
      await createAdvancedThumbnail(img, 64);

      expect(processImageSpy).toHaveBeenCalledOnce();
    });

    it('processImage 의 첫 번째 인자가 입력 이미지와 동일 참조이다', async () => {
      const img = createMockImage();
      await createAdvancedThumbnail(img, 64);

      expect(processImageSpy.mock.calls[0][0]).toBe(img);
    });

    it('canvas, blob, stats 세 필드가 모두 존재한다', async () => {
      const stubResult = makeStubResult();
      processImageSpy.mockResolvedValue(stubResult as any);

      const img = createMockImage();
      const result = await createAdvancedThumbnail(img, 64);

      expect(result.canvas).toBeDefined();
      expect(result.blob).toBe(stubResult.blob);
      expect(result.stats).toBe(stubResult.stats);
    });

    it('result.canvas 는 스텁 canvas 와 동일 참조이다', async () => {
      const stubResult = makeStubResult();
      processImageSpy.mockResolvedValue(stubResult as any);

      const img = createMockImage();
      const result = await createAdvancedThumbnail(img, 64);

      expect(result.canvas).toBe(stubResult.canvas);
    });
  });

  // --------------------------------------------------------------------------
  // JPEG fallback — processImage 가 blob: undefined 반환 시
  // --------------------------------------------------------------------------
  describe('JPEG fallback', () => {
    it('processImage 가 blob: undefined 반환 시 결과 blob 이 image/jpeg 이다', async () => {
      processImageSpy.mockResolvedValue(makeStubResult(false) as any);

      const img = createMockImage();
      const result = await createAdvancedThumbnail(img, 64);

      expect(result.blob).toBeDefined();
      expect(result.blob.type).toBe('image/jpeg');
    });

    it('JPEG fallback blob size 가 0 보다 크다', async () => {
      processImageSpy.mockResolvedValue(makeStubResult(false) as any);

      const img = createMockImage();
      const result = await createAdvancedThumbnail(img, 64);

      expect(result.blob.size).toBeGreaterThan(0);
    });
  });
});
