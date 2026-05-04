import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToImageElement } from '../../../../src/core/source-converter';
import { withFetchMock } from './helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('원격 소스 로딩 보호: AbortSignal', () => {
  it('이미 취소된 AbortSignal이 전달되면 fetch가 거부된다', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));
    const controller = new AbortController();
    controller.abort();

    await withFetchMock(fetchMock, async () => {
      await expect(
        convertToImageElement('http://example.com/image.png', {
          abortSignal: controller.signal,
        })
      ).rejects.toThrow();
    });
  });

  it('이미 취소된 AbortSignal은 비-SVG URL에서도 img 폴백으로 우회되지 않는다', async () => {
    const originalCreate = document.createElement.bind(document);
    let imageCreateCount = 0;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'img') imageCreateCount += 1;
      return originalCreate(tag);
    });

    const fetchMock = vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));
    const controller = new AbortController();
    controller.abort();

    await withFetchMock(fetchMock, async () => {
      await expect(
        convertToImageElement('http://example.com/aborted-no-fallback.png', {
          abortSignal: controller.signal,
        })
      ).rejects.toThrow();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(imageCreateCount).toBe(0);
    });
  });

  it('이미 취소된 AbortSignal이 전달된 .svg URL은 SOURCE_LOAD_FAILED로 구분한다', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));
    const controller = new AbortController();
    controller.abort();

    await withFetchMock(fetchMock, async () => {
      await expect(
        convertToImageElement('https://example.com/aborted.svg', {
          abortSignal: controller.signal,
        })
      ).rejects.toMatchObject({ code: 'SOURCE_LOAD_FAILED' });
    });
  });
});
