import { describe, expect, it, vi } from 'vitest';
import { getImageFormat } from '../../../../src/utils';

describe('getImageFormat', () => {
  it('Blob MIME만으로 포맷을 단독 조회한다', async () => {
    const blob = new Blob(['mock'], { type: 'image/webp' });
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');

    await expect(getImageFormat(blob)).resolves.toBe('webp');
    expect(createObjectURLSpy).not.toHaveBeenCalled();
  });

  it('확장자로 포맷을 알 수 있는 URL을 네트워크 요청 없이 반환한다', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(getImageFormat('https://example.com/photo.webp?cache=1')).resolves.toBe('webp');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
