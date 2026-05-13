/**
 * 이미지 로딩 경로 회귀 안전장치 중 toElement 흐름이 실제 Image 로드를 수행하는 케이스만 happy-dom에 남긴다.
 *
 * toElement는 production이 내부에서 Blob → createObjectURL → Image.src 경로를 거치고
 * jsdom + canvas 패키지는 이 경로를 IMAGE_LOAD_FAILED로 거부하므로 happy-dom에서만 검증한다.
 * 파일 시스템 정적 분석 케이스는 `image-loading-regression-jsdom.test.ts`로 분리했다.
 */

import { describe, expect, it, vi } from 'vitest';

import { processImage } from '../../../src/processor';
import { isImageElement } from '../../../src/types/guards';
import { createTestImageBlob } from '../../utils/image-helper';

describe('image loading regression safeguards (toElement 실행 경로)', () => {
  it('should create output elements without using the global Image constructor', async () => {
    const input = await createTestImageBlob(64, 64, 'red');
    const originalImage = globalThis.Image;
    let constructorCalls = 0;
    const forbiddenImageConstructor = vi.fn(
      class ForbiddenImage {
        constructor() {
          constructorCalls += 1;
          throw new Error('Unexpected global Image constructor usage');
        }
      }
    );

    // happy-dom에서도 document.createElement('img') 경로만 타는지 확인한다.
    globalThis.Image = forbiddenImageConstructor as unknown as typeof Image;

    try {
      const element = await (processImage(input).resize({ fit: 'cover', width: 32, height: 32 }) as any).toElement();

      expect(element.width).toBeGreaterThan(0);
      expect(constructorCalls).toBe(0);
    } finally {
      globalThis.Image = originalImage;
    }
  });

  it('should return an element that is recognized as an HTMLImageElement in the Node test environment', async () => {
    const input = await createTestImageBlob(64, 64, 'red');
    const element = await (processImage(input).resize({ fit: 'cover', width: 32, height: 32 }) as any).toElement();

    expect(element instanceof HTMLImageElement).toBe(true);
    expect(isImageElement(element)).toBe(true);
  });

  it('should accept a toElement() result as an image source for a follow-up processing pass', async () => {
    const input = await createTestImageBlob(64, 64, 'red');
    const element = await (processImage(input).resize({ fit: 'cover', width: 32, height: 32 }) as any).toElement();
    const roundTrip = await (processImage(element).resize({ fit: 'contain', width: 16, height: 16 }) as any).toBlob();

    expect(roundTrip.blob).toBeInstanceOf(Blob);
    expect(roundTrip.blob.size).toBeGreaterThan(0);
    expect(roundTrip.width).toBe(16);
    expect(roundTrip.height).toBe(16);
  });
});
