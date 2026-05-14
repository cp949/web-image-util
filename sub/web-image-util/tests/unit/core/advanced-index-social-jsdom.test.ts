/**
 * optimizeForSocial 4-플랫폼 크기 매핑 + 공통 옵션 + JPEG fallback 행동 테스트
 *
 * AdvancedImageProcessor.processImage 를 vi.spyOn 으로 stub 해
 * 플랫폼별 resize 크기 계약, priority/format 기본값, watermark 매핑,
 * blob 누락 시 JPEG fallback 경로를 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { optimizeForSocial } from '../../../src/advanced-index';
import { AdvancedImageProcessor } from '../../../src/core/advanced-processor';

// width / height 제어가 가능한 이미지 픽스처
function createMockImage(width = 200, height = 200): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  return img;
}

// processImage 스텁 반환값
function makeStubResult(withBlob = true) {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  const blob = withBlob ? new Blob(['stub'], { type: 'image/webp' }) : undefined;
  return {
    canvas,
    blob,
    processing: { filtersApplied: 0, watermarkApplied: false },
    stats: { totalProcessingTime: 1, memoryPeakUsage: 0 },
    messages: [],
  };
}

describe('optimizeForSocial 플랫폼 크기 매핑', () => {
  let processImageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    processImageSpy = vi.spyOn(AdvancedImageProcessor, 'processImage').mockResolvedValue(makeStubResult() as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // 4-플랫폼 크기 매핑
  // --------------------------------------------------------------------------
  describe('플랫폼별 resize 크기', () => {
    it('instagram → resize.width 1080, resize.height 1080', async () => {
      const img = createMockImage();
      await optimizeForSocial(img, 'instagram');

      const passedOptions = (processImageSpy.mock.calls[0] as any)[1];
      expect(passedOptions.resize.width).toBe(1080);
      expect(passedOptions.resize.height).toBe(1080);
    });

    it('twitter → resize.width 1200, resize.height 675', async () => {
      const img = createMockImage();
      await optimizeForSocial(img, 'twitter');

      const passedOptions = (processImageSpy.mock.calls[0] as any)[1];
      expect(passedOptions.resize.width).toBe(1200);
      expect(passedOptions.resize.height).toBe(675);
    });

    it('facebook → resize.width 1200, resize.height 630', async () => {
      const img = createMockImage();
      await optimizeForSocial(img, 'facebook');

      const passedOptions = (processImageSpy.mock.calls[0] as any)[1];
      expect(passedOptions.resize.width).toBe(1200);
      expect(passedOptions.resize.height).toBe(630);
    });

    it('linkedin → resize.width 1200, resize.height 627', async () => {
      const img = createMockImage();
      await optimizeForSocial(img, 'linkedin');

      const passedOptions = (processImageSpy.mock.calls[0] as any)[1];
      expect(passedOptions.resize.width).toBe(1200);
      expect(passedOptions.resize.height).toBe(627);
    });
  });

  // --------------------------------------------------------------------------
  // 공통 기본값
  // --------------------------------------------------------------------------
  describe('공통 기본 옵션', () => {
    it('resize.priority 가 "balanced" 이다', async () => {
      const img = createMockImage();
      await optimizeForSocial(img, 'instagram');

      const passedOptions = (processImageSpy.mock.calls[0] as any)[1];
      expect(passedOptions.resize.priority).toBe('balanced');
    });

    it('format 이 "auto" 이다', async () => {
      const img = createMockImage();
      await optimizeForSocial(img, 'twitter');

      const passedOptions = (processImageSpy.mock.calls[0] as any)[1];
      expect(passedOptions.format).toBe('auto');
    });
  });

  // --------------------------------------------------------------------------
  // watermark 옵션
  // --------------------------------------------------------------------------
  describe('watermark 문자열 → watermark.text 매핑', () => {
    it('watermark: "logo" → text, position, style, size 필드가 올바르게 전달된다', async () => {
      const img = createMockImage();
      await optimizeForSocial(img, 'facebook', { watermark: 'logo' });

      const passedOptions = (processImageSpy.mock.calls[0] as any)[1];
      expect(passedOptions.watermark.text).toEqual({
        text: 'logo',
        position: 'bottom-right',
        style: 'white-shadow',
        size: 'medium',
      });
    });

    it('watermark 미지정 → watermark 필드가 undefined 이다', async () => {
      const img = createMockImage();
      await optimizeForSocial(img, 'linkedin');

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
      await optimizeForSocial(img, 'instagram');

      expect(processImageSpy).toHaveBeenCalledOnce();
    });

    it('processImage 의 첫 번째 인자가 입력 이미지와 동일 참조이다', async () => {
      const img = createMockImage();
      await optimizeForSocial(img, 'instagram');

      expect(processImageSpy.mock.calls[0][0]).toBe(img);
    });

    it('canvas, blob 두 필드가 모두 존재한다', async () => {
      const stubResult = makeStubResult();
      processImageSpy.mockResolvedValue(stubResult as any);

      const img = createMockImage();
      const result = await optimizeForSocial(img, 'instagram');

      expect(result.canvas).toBeDefined();
      expect(result.blob).toBe(stubResult.blob);
    });

    it('result.canvas 는 스텁 canvas 와 동일 참조이다', async () => {
      const stubResult = makeStubResult();
      processImageSpy.mockResolvedValue(stubResult as any);

      const img = createMockImage();
      const result = await optimizeForSocial(img, 'twitter');

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
      const result = await optimizeForSocial(img, 'instagram');

      expect(result.blob).toBeDefined();
      expect(result.blob.type).toBe('image/jpeg');
    });

    it('JPEG fallback blob size 가 0 보다 크다', async () => {
      processImageSpy.mockResolvedValue(makeStubResult(false) as any);

      const img = createMockImage();
      const result = await optimizeForSocial(img, 'facebook');

      expect(result.blob.size).toBeGreaterThan(0);
    });
  });
});
