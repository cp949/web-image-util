/**
 * batchOptimize 위임 + name 필드 전파 행동 테스트
 *
 * AdvancedImageProcessor.batchProcess 를 vi.spyOn 으로 stub 해
 * 소스 위임 계약, name 전파, options 기본값, globalOptions 전달을 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { batchOptimize } from '../../../src/advanced-index';
import { AdvancedImageProcessor } from '../../../src/core/advanced-processor';

// 더미 batchProcess 반환 원소
function makeDummyBatchResultItem() {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  return {
    canvas,
    processing: { filtersApplied: 0, watermarkApplied: false },
    stats: { totalProcessingTime: 0.01, memoryPeakUsage: 0 },
    messages: [],
  };
}

// 이미지 픽스처
function createMockImage(): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'naturalWidth', { value: 100, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: 100, configurable: true });
  return img;
}

describe('batchOptimize 위임 + name 필드 전파', () => {
  let batchProcessSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    batchProcessSpy = vi
      .spyOn(AdvancedImageProcessor, 'batchProcess')
      .mockResolvedValue([makeDummyBatchResultItem(), makeDummyBatchResultItem(), makeDummyBatchResultItem()] as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // batchProcess 위임
  // --------------------------------------------------------------------------
  describe('batchProcess 위임', () => {
    it('batchProcess 가 정확히 1회 호출된다', async () => {
      const images = [
        { image: createMockImage(), name: 'img-0' },
        { image: createMockImage(), name: 'img-1' },
        { image: createMockImage(), name: 'img-2' },
      ];
      await batchOptimize(images);

      expect(batchProcessSpy).toHaveBeenCalledOnce();
    });

    it('각 이미지의 image 참조가 batchProcess 소스 배열에 그대로 전달된다', async () => {
      const img0 = createMockImage();
      const img1 = createMockImage();
      const img2 = createMockImage();
      const images = [
        { image: img0, name: 'a' },
        { image: img1, name: 'b' },
        { image: img2, name: 'c' },
      ];

      await batchOptimize(images);

      const passedSources = (batchProcessSpy.mock.calls[0] as any)[0] as Array<{ image: HTMLImageElement }>;
      expect(passedSources[0].image).toBe(img0);
      expect(passedSources[1].image).toBe(img1);
      expect(passedSources[2].image).toBe(img2);
    });

    it('options 미지정 항목은 { format: "auto" } 기본값으로 위임된다', async () => {
      const images = [{ image: createMockImage() }];
      batchProcessSpy.mockResolvedValue([makeDummyBatchResultItem()] as any);

      await batchOptimize(images);

      const passedSources = (batchProcessSpy.mock.calls[0] as any)[0] as Array<{ options: unknown }>;
      expect(passedSources[0].options).toEqual({ format: 'auto' });
    });

    it('options 명시 항목은 그 options 가 그대로 위임된다', async () => {
      const customOptions = { format: 'webp', quality: 0.9 };
      const images = [{ image: createMockImage(), options: customOptions }];
      batchProcessSpy.mockResolvedValue([makeDummyBatchResultItem()] as any);

      await batchOptimize(images);

      const passedSources = (batchProcessSpy.mock.calls[0] as any)[0] as Array<{ options: unknown }>;
      expect(passedSources[0].options).toBe(customOptions);
    });

    it('name 필드가 batchProcess 소스 배열에 전달된다', async () => {
      const images = [
        { image: createMockImage(), name: 'first' },
        { image: createMockImage(), name: 'second' },
        { image: createMockImage(), name: 'third' },
      ];

      await batchOptimize(images);

      const passedSources = (batchProcessSpy.mock.calls[0] as any)[0] as Array<{ name?: string }>;
      expect(passedSources[0].name).toBe('first');
      expect(passedSources[1].name).toBe('second');
      expect(passedSources[2].name).toBe('third');
    });
  });

  // --------------------------------------------------------------------------
  // name 필드 결과 전파
  // --------------------------------------------------------------------------
  describe('name 필드 결과 전파', () => {
    it('결과 배열의 name 이 입력 images 의 name 과 인덱스별로 일치한다', async () => {
      const images = [
        { image: createMockImage(), name: 'alpha' },
        { image: createMockImage(), name: 'beta' },
        { image: createMockImage(), name: 'gamma' },
      ];

      const results = await batchOptimize(images);

      expect(results[0].name).toBe('alpha');
      expect(results[1].name).toBe('beta');
      expect(results[2].name).toBe('gamma');
    });

    it('name 미설정 항목의 결과 name 은 undefined 이다', async () => {
      const images = [{ image: createMockImage() }];
      batchProcessSpy.mockResolvedValue([makeDummyBatchResultItem()] as any);

      const results = await batchOptimize(images);

      expect(results[0].name).toBeUndefined();
    });

    it('결과 배열 길이가 입력 이미지 수와 동일하다', async () => {
      const images = [
        { image: createMockImage(), name: 'x' },
        { image: createMockImage(), name: 'y' },
        { image: createMockImage(), name: 'z' },
      ];

      const results = await batchOptimize(images);

      expect(results).toHaveLength(3);
    });

    it('각 결과 원소의 result 는 batchProcess 반환 원소와 인덱스별로 동일 참조이다', async () => {
      const items = [makeDummyBatchResultItem(), makeDummyBatchResultItem(), makeDummyBatchResultItem()];
      batchProcessSpy.mockResolvedValue(items as any);

      const images = [
        { image: createMockImage(), name: 'img-0' },
        { image: createMockImage(), name: 'img-1' },
        { image: createMockImage(), name: 'img-2' },
      ];

      const results = await batchOptimize(images);

      expect(results[0].result).toBe(items[0]);
      expect(results[1].result).toBe(items[1]);
      expect(results[2].result).toBe(items[2]);
    });
  });

  // --------------------------------------------------------------------------
  // globalOptions 전달 (onProgress / concurrency)
  // --------------------------------------------------------------------------
  describe('globalOptions 전달', () => {
    it('onProgress 가 batchProcess 두 번째 인자로 전달된다', async () => {
      const onProgress = vi.fn();
      const images = [{ image: createMockImage(), name: 'a' }];
      batchProcessSpy.mockResolvedValue([makeDummyBatchResultItem()] as any);

      await batchOptimize(images, { onProgress });

      const passedGlobalOptions = (batchProcessSpy.mock.calls[0] as any)[1];
      expect(passedGlobalOptions.onProgress).toBe(onProgress);
    });

    it('concurrency 가 batchProcess 두 번째 인자로 전달된다', async () => {
      const images = [{ image: createMockImage(), name: 'a' }];
      batchProcessSpy.mockResolvedValue([makeDummyBatchResultItem()] as any);

      await batchOptimize(images, { concurrency: 4 });

      const passedGlobalOptions = (batchProcessSpy.mock.calls[0] as any)[1];
      expect(passedGlobalOptions.concurrency).toBe(4);
    });
  });
});
