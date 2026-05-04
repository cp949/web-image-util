import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToImageElement } from '../../../../src/core/source-converter';
import { ImageProcessError } from '../../../../src/types';
import { createSuccessResponse, mockImgElement, withFetchMock } from './helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('원격 소스 로딩 보호: 기본 동작 유지', () => {
  it('옵션 없이 호출해도 http:// URL 처리가 정상적으로 시작된다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse('image/png'));
    mockImgElement();

    await withFetchMock(fetchMock, async () => {
      await convertToImageElement('http://example.com/image.png').catch((err) => {
        if (err instanceof ImageProcessError && err.code === 'INVALID_SOURCE') {
          throw err;
        }
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it('ftp:// URL은 옵션 없이 호출해도 INVALID_SOURCE로 거부된다', async () => {
    await expect(convertToImageElement('ftp://example.com/image.png')).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });
});
