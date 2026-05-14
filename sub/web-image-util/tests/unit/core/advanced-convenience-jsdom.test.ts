/**
 * smartResize / processWithFilters / addWatermarkAndOptimize convenience 함수
 * 옵션 매핑 및 반환 형태 행동 테스트
 *
 * AdvancedImageProcessor.processImage 를 vi.spyOn 으로 격리해
 * 각 convenience 함수가 올바른 옵션 객체로 위임하는지 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addWatermarkAndOptimize, processWithFilters, smartResize } from '../../../src/advanced-index';
import { AdvancedImageProcessor } from '../../../src/core/advanced-processor';
import type { FilterChain } from '../../../src/filters/plugin-system';

// width / height 를 제어하는 이미지 픽스처
function createMockImage(width = 100, height = 100): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  return img;
}

// AdvancedImageProcessor.processImage 스텁 반환값
function makeProcessResult() {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  const blob = new Blob([], { type: 'image/png' });
  return {
    canvas,
    blob,
    processing: {
      filtersApplied: 0,
      watermarkApplied: false,
    },
    stats: {
      totalProcessingTime: 0,
      memoryPeakUsage: 0,
    },
    messages: [],
  };
}

// 빈 FilterChain 픽스처 (필터 자체 동작은 검증 범위 밖)
const emptyChain: FilterChain = { filters: [] };

describe('convenience 함수 옵션 매핑 및 반환 형태', () => {
  let processImageSpy: ReturnType<typeof vi.spyOn>;
  let stubResult: ReturnType<typeof makeProcessResult>;

  beforeEach(() => {
    stubResult = makeProcessResult();
    processImageSpy = vi.spyOn(AdvancedImageProcessor, 'processImage').mockResolvedValue(stubResult as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // smartResize
  // --------------------------------------------------------------------------
  describe('smartResize', () => {
    it('width · height 를 resize 옵션으로 전달하고 기본 priority 는 balanced 다', async () => {
      const img = createMockImage();
      await smartResize(img, 800, 600);

      expect(processImageSpy).toHaveBeenCalledOnce();
      const src = processImageSpy.mock.calls[0]?.[0];
      const opts = processImageSpy.mock.calls[0]?.[1];
      // 소스 이미지가 첫 인자로 그대로 전달된다
      expect(src).toBe(img);
      expect(opts).toBeDefined();
      expect(opts?.resize?.width).toBe(800);
      expect(opts?.resize?.height).toBe(600);
      expect(opts?.resize?.priority).toBe('balanced');
      // format 미지정 시 undefined 로 위임된다
      expect(opts?.format).toBeUndefined();
    });

    it('quality: fast 는 priority speed 로 매핑된다', async () => {
      const img = createMockImage();
      await smartResize(img, 800, 600, { quality: 'fast' });

      expect(processImageSpy).toHaveBeenCalledOnce();
      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.resize?.priority).toBe('speed');
    });

    it('quality: high 는 priority quality 로 매핑되고 format: auto 가 전달된다', async () => {
      const img = createMockImage();
      await smartResize(img, 800, 600, { quality: 'high', format: 'auto' });

      expect(processImageSpy).toHaveBeenCalledOnce();
      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.resize?.priority).toBe('quality');
      expect(opts?.format).toBe('auto');
    });

    it('반환값은 스텁의 canvas · blob 필드로 구성된다', async () => {
      const img = createMockImage();
      const result = await smartResize(img, 800, 600);

      // 전체 AdvancedProcessingResult 를 그대로 반환하는 회귀를 막는다
      expect(result).not.toBe(stubResult);
      expect(Object.keys(result).sort()).toEqual(['blob', 'canvas']);
      expect(result.canvas).toBe(stubResult.canvas);
      expect(result.blob).toBe(stubResult.blob);
    });
  });

  // --------------------------------------------------------------------------
  // processWithFilters
  // --------------------------------------------------------------------------
  describe('processWithFilters', () => {
    it('전달한 FilterChain 이 그대로 processImage 의 filters 옵션으로 전달된다', async () => {
      const img = createMockImage();
      await processWithFilters(img, emptyChain);

      expect(processImageSpy).toHaveBeenCalledOnce();
      const src = processImageSpy.mock.calls[0]?.[0];
      const opts = processImageSpy.mock.calls[0]?.[1];
      // 소스 이미지가 첫 인자로 그대로 전달된다
      expect(src).toBe(img);
      expect(opts?.filters).toBe(emptyChain);
    });

    it('format 을 지정하지 않으면 processImage 에 format 이 undefined 로 전달된다', async () => {
      const img = createMockImage();
      await processWithFilters(img, emptyChain);

      expect(processImageSpy).toHaveBeenCalledOnce();
      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.format).toBeUndefined();
    });

    it('format: auto 를 전달하면 processImage 의 format 도 auto 다', async () => {
      const img = createMockImage();
      await processWithFilters(img, emptyChain, { format: 'auto' });

      expect(processImageSpy).toHaveBeenCalledOnce();
      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.format).toBe('auto');
    });

    it('반환값은 스텁의 canvas · blob 필드로 구성된다', async () => {
      const img = createMockImage();
      const result = await processWithFilters(img, emptyChain);

      // 전체 AdvancedProcessingResult 를 그대로 반환하는 회귀를 막는다
      expect(result).not.toBe(stubResult);
      expect(Object.keys(result).sort()).toEqual(['blob', 'canvas']);
      expect(result.canvas).toBe(stubResult.canvas);
      expect(result.blob).toBe(stubResult.blob);
    });
  });

  // --------------------------------------------------------------------------
  // addWatermarkAndOptimize
  // --------------------------------------------------------------------------
  describe('addWatermarkAndOptimize', () => {
    it('text 만 전달하면 watermark.text.text 에 매핑되고 watermark.image 는 미설정이다', async () => {
      const img = createMockImage();
      await addWatermarkAndOptimize(img, { text: 'hello' });

      expect(processImageSpy).toHaveBeenCalledOnce();
      const src = processImageSpy.mock.calls[0]?.[0];
      const opts = processImageSpy.mock.calls[0]?.[1];
      // 소스 이미지가 첫 인자로 그대로 전달된다
      expect(src).toBe(img);
      expect(opts?.watermark?.text?.text).toBe('hello');
      expect(opts?.watermark?.image).toBeUndefined();
    });

    it('logo 만 전달하면 watermark.image.image 에 매핑되고 watermark.text 는 미설정이다', async () => {
      const img = createMockImage();
      const logo = createMockImage(32, 32);
      await addWatermarkAndOptimize(img, { logo });

      expect(processImageSpy).toHaveBeenCalledOnce();
      const src = processImageSpy.mock.calls[0]?.[0];
      const opts = processImageSpy.mock.calls[0]?.[1];
      // 소스 이미지와 logo 가 뒤바뀌지 않았는지 확인
      expect(src).toBe(img);
      expect(opts?.watermark?.image?.image).toBe(logo);
      expect(opts?.watermark?.text).toBeUndefined();
    });

    it('text 와 logo 를 동시에 전달하면 두 필드 모두 채워진다', async () => {
      const img = createMockImage();
      const logo = createMockImage(32, 32);
      await addWatermarkAndOptimize(img, { text: 'x', logo });

      expect(processImageSpy).toHaveBeenCalledOnce();
      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.watermark?.text?.text).toBe('x');
      expect(opts?.watermark?.image?.image).toBe(logo);
    });

    it('text · logo 둘 다 미설정이면 watermark 는 빈 객체로 위임된다', async () => {
      const img = createMockImage();
      await addWatermarkAndOptimize(img, {});

      expect(processImageSpy).toHaveBeenCalledOnce();
      const opts = processImageSpy.mock.calls[0]?.[1];
      // undefined 가 아니라 {} 로 위임되어 processImage 에 watermark 키가 전달된다
      expect(opts?.watermark).toBeDefined();
      expect(opts?.watermark?.text).toBeUndefined();
      expect(opts?.watermark?.image).toBeUndefined();
    });

    it('반환값은 스텁의 canvas · blob 필드로 구성된다', async () => {
      const img = createMockImage();
      const result = await addWatermarkAndOptimize(img, { text: 'hello' });

      // 전체 AdvancedProcessingResult 를 그대로 반환하는 회귀를 막는다
      expect(result).not.toBe(stubResult);
      expect(Object.keys(result).sort()).toEqual(['blob', 'canvas']);
      expect(result.canvas).toBe(stubResult.canvas);
      expect(result.blob).toBe(stubResult.blob);
    });

    it('format 미지정 시 opts.format 은 undefined 로 위임된다', async () => {
      const img = createMockImage();
      await addWatermarkAndOptimize(img, { text: 'hello' });

      expect(processImageSpy).toHaveBeenCalledOnce();
      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.format).toBeUndefined();
    });

    it("format: 'auto' 전달 시 opts.format === 'auto' 로 위임된다", async () => {
      const img = createMockImage();
      await addWatermarkAndOptimize(img, { text: 'hello' }, { format: 'auto' });

      expect(processImageSpy).toHaveBeenCalledOnce();
      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.format).toBe('auto');
    });
  });
});
