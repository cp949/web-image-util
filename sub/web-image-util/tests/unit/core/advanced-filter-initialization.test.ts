/**
 * advanced 엔트리의 필터 초기화 계약을 검증하는 테스트다.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdvancedImageProcessor,
  createAdvancedThumbnail,
  initializeFilterSystem,
  optimizeForSocial,
} from '../../../src/advanced-index';
import { FilterPluginManager } from '../../../src/filters/plugin-system';

describe('AdvancedImageProcessor 필터 초기화 계약', () => {
  beforeEach(() => {
    FilterPluginManager.resetForTesting();

    // 테스트 환경에서도 필터 적용 경로가 ImageData를 사용할 수 있게 목을 맞춘다.
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

  it('createAdvancedThumbnail은 등록되지 않은 필터를 사전에 거부한다', async () => {
    const image = document.createElement('img');
    image.width = 32;
    image.height = 32;
    Object.defineProperty(image, 'naturalWidth', { value: 32, configurable: true });
    Object.defineProperty(image, 'naturalHeight', { value: 32, configurable: true });
    let thrownError: unknown;

    try {
      await createAdvancedThumbnail(image, 32, {
        filters: [{ name: '__missing_thumbnail_filter__', params: { value: 10 } }],
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toMatchObject({ code: 'PROCESSING_FAILED' });
  });

  it('optimizeForSocial은 등록되지 않은 필터를 사전에 거부한다', async () => {
    const image = document.createElement('img');
    image.width = 32;
    image.height = 32;
    Object.defineProperty(image, 'naturalWidth', { value: 32, configurable: true });
    Object.defineProperty(image, 'naturalHeight', { value: 32, configurable: true });
    let thrownError: unknown;

    try {
      await optimizeForSocial(image, 'instagram', {
        filters: [{ name: '__missing_social_filter__', params: { value: 10 } }],
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toMatchObject({ code: 'PROCESSING_FAILED' });
  });
});
