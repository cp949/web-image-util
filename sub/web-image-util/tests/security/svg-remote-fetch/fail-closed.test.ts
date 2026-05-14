/**
 * 원격 SVG/XML fetch 실패 경로가 fail-closed로 차단되는지 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureImageElement } from '../../../src/utils/converters';
import { withFetchMock } from '../../utils';
import { createStreamBody } from '../helpers/svg-test-helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('보안: 원격 SVG fetch fail-closed', () => {
  it('확장자가 없는 URL이라도 image/svg+xml 응답 본문을 읽지 못하면 차단한다', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'image/svg+xml' : null;
        },
      },
      body: createStreamBody([], { throwOnRead: new Error('body decode failed') }),
    });

    await withFetchMock(fetchMock, async () => {
      await expect(ensureImageElement('https://example.com/asset?id=broken-svg')).rejects.toMatchObject({
        code: 'INVALID_SOURCE',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  it('fetch 실패한 .svg URL은 차단한다', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('cors blocked'));

    await withFetchMock(fetchMock, async () => {
      await expect(ensureImageElement('https://example.com/image.svg')).rejects.toMatchObject({
        code: 'INVALID_SOURCE',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it('fetch 실패한 .svg 쿼리 URL도 차단한다', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn().mockRejectedValue(new Error('cors blocked'));

    await withFetchMock(fetchMock, async () => {
      await expect(ensureImageElement('https://example.com/image.svg?download=1')).rejects.toMatchObject({
        code: 'INVALID_SOURCE',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  it('.svg URL 응답 본문을 읽지 못하면 fail-closed로 차단한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'image/svg+xml' : null;
        },
      },
      body: createStreamBody([], { throwOnRead: new Error('stream broken') }),
    });

    await withFetchMock(fetchMock, async () => {
      await expect(ensureImageElement('https://example.com/broken.svg')).rejects.toMatchObject({
        code: 'INVALID_SOURCE',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it('XML MIME 응답 본문을 읽지 못하면 fail-closed로 차단한다', async () => {
    const textSpy = vi.fn().mockResolvedValue('unused fallback');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'text/xml' : null;
        },
      },
      body: createStreamBody([], { throwOnRead: new Error('xml stream broken') }),
      text: textSpy,
    });

    await withFetchMock(fetchMock, async () => {
      await expect(ensureImageElement('https://example.com/broken.xml')).rejects.toMatchObject({
        code: 'INVALID_SOURCE',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(textSpy).not.toHaveBeenCalled();
    });
  });
});
