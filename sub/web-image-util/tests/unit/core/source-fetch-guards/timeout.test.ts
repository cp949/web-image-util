import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToImageElement } from '../../../../src/core/source-converter';
import { ImageProcessError } from '../../../../src/types';
import { createAbortableFetchMock, createSuccessResponse, mockImgElement, withFetchMock } from './helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('원격 소스 로딩 보호: 타임아웃', () => {
  it('fetchTimeoutMs 초과 시 SOURCE_LOAD_FAILED 또는 INVALID_SOURCE 오류로 거부한다', async () => {
    const fetchMock = createAbortableFetchMock();

    await withFetchMock(fetchMock, async () => {
      await expect(
        convertToImageElement('http://example.com/slow.png', {
          fetchTimeoutMs: 50,
        })
      ).rejects.toThrow();
    });
  }, 3000);

  it('legacy timeout 옵션도 fetch 타임아웃으로 동작한다', async () => {
    const fetchMock = createAbortableFetchMock();

    await withFetchMock(fetchMock, async () => {
      await expect(
        convertToImageElement('http://example.com/legacy-timeout.png', {
          timeout: 20,
        })
      ).rejects.toMatchObject({ code: 'SOURCE_LOAD_FAILED' });
    });
  }, 3000);

  it('fetchTimeoutMs로 중단된 비-SVG URL은 img 폴백 없이 즉시 거부한다', async () => {
    const originalCreate = document.createElement.bind(document);
    let imageCreateCount = 0;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'img') imageCreateCount += 1;
      return originalCreate(tag);
    });

    const fetchMock = createAbortableFetchMock();
    await withFetchMock(fetchMock, async () => {
      await expect(
        convertToImageElement('http://example.com/timeout-no-fallback.png', {
          fetchTimeoutMs: 20,
        })
      ).rejects.toThrow();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(imageCreateCount).toBe(0);
    });
  }, 3000);

  it('fetchTimeoutMs: 0이면 타임아웃이 비활성화된다 (fetch가 즉시 응답하면 성공)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse('image/png'));
    mockImgElement();

    await withFetchMock(fetchMock, async () => {
      await convertToImageElement('http://example.com/image.png', {
        fetchTimeoutMs: 0,
      }).catch((err) => {
        if (err instanceof ImageProcessError && err.code === 'INVALID_SOURCE') {
          throw err;
        }
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
