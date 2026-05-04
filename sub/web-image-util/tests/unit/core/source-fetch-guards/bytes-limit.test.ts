import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToImageElement } from '../../../../src/core/source-converter';
import { ImageProcessError } from '../../../../src/types';
import { createByteStreamBody, createSuccessResponse, mockImgElement, withFetchMock } from './helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('원격 소스 로딩 보호: 최대 크기 제한', () => {
  it('Content-Length가 maxSourceBytes를 초과하면 본문 읽기 전에 거부한다', async () => {
    const maxBytes = 1024; // 1KB
    const fetchMock = vi.fn().mockResolvedValue(
      createSuccessResponse('image/png', maxBytes + 1) // 1바이트 초과
    );

    await withFetchMock(fetchMock, async () => {
      await expect(
        convertToImageElement('http://example.com/large.png', {
          maxSourceBytes: maxBytes,
        })
      ).rejects.toMatchObject({ code: 'SOURCE_BYTES_EXCEEDED' });
    });
  });

  it('Content-Length가 maxSourceBytes 이하이면 정상적으로 진행한다', async () => {
    const maxBytes = 1024 * 1024; // 1MiB
    const fetchMock = vi.fn().mockResolvedValue(
      createSuccessResponse('image/png', 512) // 512바이트 (제한 이하)
    );
    mockImgElement();

    await withFetchMock(fetchMock, async () => {
      await convertToImageElement('http://example.com/small.png', {
        maxSourceBytes: maxBytes,
      }).catch((err) => {
        if (err instanceof ImageProcessError) {
          // Content-Length 체크는 통과했지만 img 로드 실패는 허용
          if (err.code === 'SOURCE_BYTES_EXCEEDED' || err.code === 'INVALID_SOURCE') {
            throw err;
          }
        }
      });
    });
  });

  it('Content-Length 헤더가 없어도 실제 응답 본문이 maxSourceBytes를 초과하면 거부한다', async () => {
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
        convertToImageElement('http://example.com/no-length.png', {
          maxSourceBytes: 1,
        })
      ).rejects.toMatchObject({ code: 'SOURCE_BYTES_EXCEEDED' });
    });
  });

  it('maxSourceBytes: 0이면 크기 제한이 비활성화된다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createSuccessResponse('image/png', 999_999_999) // 거대한 Content-Length
    );
    mockImgElement();

    await withFetchMock(fetchMock, async () => {
      await convertToImageElement('http://example.com/huge.png', {
        maxSourceBytes: 0, // 무제한
      }).catch((err) => {
        if (err instanceof ImageProcessError && err.code === 'SOURCE_BYTES_EXCEEDED') {
          throw err;
        }
      });
    });
  });
});
