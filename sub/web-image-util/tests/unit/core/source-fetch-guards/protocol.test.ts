import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToImageElement } from '../../../../src/core/source-converter';
import { ImageProcessError } from '../../../../src/types';
import { createSuccessResponse, mockImgElement, withFetchMock } from './helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('원격 소스 로딩 보호: 프로토콜 차단', () => {
  it('ftp:// URL은 INVALID_SOURCE 오류로 거부한다', async () => {
    await expect(convertToImageElement('ftp://example.com/image.png', {})).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('javascript: URL은 INVALID_SOURCE 오류로 거부한다', async () => {
    await expect(convertToImageElement('javascript:alert(1)', {})).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
  });

  it('file:// URL은 INVALID_SOURCE 오류로 거부한다', async () => {
    await expect(convertToImageElement('file:///etc/passwd', {})).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
  });

  it('허용 목록에 없는 커스텀 프로토콜도 INVALID_SOURCE로 거부한다', async () => {
    await expect(convertToImageElement('custom://example.com/img.png', {})).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('http:// URL은 기본 허용 프로토콜이다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse('image/png'));
    mockImgElement();

    await withFetchMock(fetchMock, async () => {
      // INVALID_SOURCE가 아닌 한 허용 (happy-dom에서 img 로드가 완전히 동작하지 않을 수 있다)
      await convertToImageElement('http://example.com/image.png', {}).catch((err) => {
        if (err instanceof ImageProcessError && err.code === 'INVALID_SOURCE') {
          throw err;
        }
      });
    });
  });

  it('https:// URL은 기본 허용 프로토콜이다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse('image/png'));
    mockImgElement();

    await withFetchMock(fetchMock, async () => {
      await convertToImageElement('https://example.com/image.png', {}).catch((err) => {
        if (err instanceof ImageProcessError && err.code === 'INVALID_SOURCE') {
          throw err;
        }
      });
    });
  });

  it('allowedProtocols 옵션으로 허용 목록을 재정의할 수 있다', async () => {
    // ftp://만 허용하도록 재정의하면 http://가 차단되어야 한다
    await expect(
      convertToImageElement('http://example.com/image.png', {
        allowedProtocols: ['ftp:'],
      })
    ).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
  });

  it('allowedProtocols에 blob:을 포함하면 blob: URL이 허용된다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse('image/png'));
    mockImgElement();

    await withFetchMock(fetchMock, async () => {
      await convertToImageElement('blob:http://localhost/abc-123', {
        allowedProtocols: ['blob:'],
      }).catch((err) => {
        if (err instanceof ImageProcessError && err.code === 'INVALID_SOURCE') {
          throw err;
        }
      });
    });
  });

  it('상대 경로 이미지는 INVALID_SOURCE 없이 브라우저 로딩 경로를 유지한다', async () => {
    mockImgElement();

    await convertToImageElement('./assets/image.png', {}).catch((err) => {
      if (err instanceof ImageProcessError && err.code === 'INVALID_SOURCE') {
        throw err;
      }
    });
  });

  it('루트 상대 경로 이미지는 INVALID_SOURCE 없이 브라우저 로딩 경로를 유지한다', async () => {
    mockImgElement();

    await convertToImageElement('/assets/image.png', {}).catch((err) => {
      if (err instanceof ImageProcessError && err.code === 'INVALID_SOURCE') {
        throw err;
      }
    });
  });

  it('protocol-relative URL은 원격 URL로 간주해 허용 프로토콜 제한을 적용한다', async () => {
    const originalCreate = document.createElement.bind(document);
    let imageCreateCount = 0;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'img') imageCreateCount += 1;
      return originalCreate(tag);
    });

    const fetchMock = vi.fn();
    await withFetchMock(fetchMock, async () => {
      await expect(
        convertToImageElement('//cdn.example.com/image.png', {
          allowedProtocols: ['blob:'],
        })
      ).rejects.toMatchObject({ code: 'INVALID_SOURCE' });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(imageCreateCount).toBe(0);
    });
  });
});
