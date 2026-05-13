/**
 * advanced 엔트리 필터 초기화 계약 중 실제 처리 경로까지 진입하는 케이스만 happy-dom에 남긴다.
 *
 * AdvancedImageProcessor.processImage(image, ...)는 내부에서 drawImage(src 없는 Image)를
 * 호출해 jsdom에서 거부되므로 happy-dom 환경에서만 통과한다. 사전 거부 단계에서 처리되는
 * createAdvancedThumbnail / optimizeForSocial 케이스는 `advanced-filter-initialization-jsdom.test.ts`로 분리했다.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdvancedImageProcessor, initializeFilterSystem } from '../../../src/advanced-index';
import { FilterPluginManager } from '../../../src/filters/plugin-system';

describe('AdvancedImageProcessor 필터 초기화 계약 (실제 처리 경로)', () => {
  beforeEach(() => {
    FilterPluginManager.resetForTesting();

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

  it('명시적 초기화 없이 advanced 필터를 사용하면 PROCESSING_FAILED 오류를 던진다', async () => {
    const image = document.createElement('img');
    image.width = 32;
    image.height = 32;
    Object.defineProperty(image, 'naturalWidth', { value: 32, configurable: true });
    Object.defineProperty(image, 'naturalHeight', { value: 32, configurable: true });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      // 초기화 없이 사용하면 필터가 등록되지 않아 ImageProcessError를 던진다
      await expect(
        AdvancedImageProcessor.processImage(image, {
          filters: {
            filters: [{ name: 'brightness', params: { value: 10 } }],
          },
        })
      ).rejects.toMatchObject({ code: 'PROCESSING_FAILED' });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('명시적 초기화 후에는 advanced 필터가 정상 적용된다', async () => {
    initializeFilterSystem();

    const image = document.createElement('img');
    image.width = 32;
    image.height = 32;
    Object.defineProperty(image, 'naturalWidth', { value: 32, configurable: true });
    Object.defineProperty(image, 'naturalHeight', { value: 32, configurable: true });

    const result = await AdvancedImageProcessor.processImage(image, {
      filters: {
        filters: [{ name: 'brightness', params: { value: 10 } }],
      },
    });

    expect(result.processing.filtersApplied).toBe(1);
    expect(result.messages).toContain('Applied 1 filter(s).');
    expect(result.messages).not.toContain('Some filters failed to apply.');
  });
});
