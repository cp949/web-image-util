/**
 * advanced 엔트리 필터 초기화 계약 중 jsdom에서 안전한 케이스만 모은다.
 *
 * 분리 기준:
 * - 등록되지 않은 필터를 사전 검증 단계에서 거부하는 케이스(createAdvancedThumbnail /
 *   optimizeForSocial): 실제 이미지 처리에 진입하지 않으므로 jsdom 가능.
 * - AdvancedImageProcessor.processImage(image, ...)가 실제 처리 경로를 따라가는 케이스는
 *   `advanced-filter-initialization.test.ts`(happy-dom)에 남겨둔다.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createAdvancedThumbnail, optimizeForSocial } from '../../../src/advanced-index';
import { FilterPluginManager } from '../../../src/filters/plugin-system';

describe('AdvancedImageProcessor 필터 초기화 계약 (jsdom-safe)', () => {
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
