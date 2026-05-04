import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToImageElement } from '../../../../src/core/source-converter';
import { createByteStreamBody, createSuccessResponse, withFetchMock } from './helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('원격 소스 로딩 보호: blob: URL', () => {
  it('blob: URL이 허용 프로토콜 목록에서 제외되면 INVALID_SOURCE로 거부한다', async () => {
    await expect(
      convertToImageElement('blob:http://localhost/blocked-blob', {
        allowedProtocols: ['https:'],
      })
    ).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
  });

  it('blob: URL에도 maxSourceBytes 제한이 적용된다', async () => {
    const maxBytes = 512;
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse('image/png', maxBytes + 1));

    await withFetchMock(fetchMock, async () => {
      await expect(
        convertToImageElement('blob:http://localhost/abc-123', {
          maxSourceBytes: maxBytes,
        })
      ).rejects.toMatchObject({ code: 'SOURCE_BYTES_EXCEEDED' });
    });
  });

  it('blob: URL도 Content-Length가 없어도 실제 응답 본문이 maxSourceBytes를 초과하면 거부한다', async () => {
    const oversizedChunk = new Uint8Array(2);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'image/png' : null;
        },
      },
      body: createByteStreamBody([oversizedChunk]),
      blob: async () => new Blob([oversizedChunk], { type: 'image/png' }),
    });

    await withFetchMock(fetchMock, async () => {
      await expect(
        convertToImageElement('blob:http://localhost/no-length-blob', {
          maxSourceBytes: 1,
        })
      ).rejects.toMatchObject({ code: 'SOURCE_BYTES_EXCEEDED' });
    });
  });
});
