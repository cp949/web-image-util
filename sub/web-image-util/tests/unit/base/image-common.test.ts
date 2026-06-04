/**
 * image-common.ts 문자열 분류와 이미지 형식 판정 함수 분기 단위 테스트.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkImageFormatFromString,
  imageFormatFromDataUrl,
  isSvgDataUrl,
  sourceTypeFromString,
} from '../../../src/base/image-common.internal';
import { SIMPLE_SVG } from './image-common.helpers';

describe('sourceTypeFromString', () => {
  describe('HTTP URL 분기', () => {
    it.each(['http://example.com/image.png', 'https://example.com/image.png'])('%s는 HTTP_URL을 반환한다', (src) => {
      expect(sourceTypeFromString(src)).toBe('HTTP_URL');
    });
  });

  describe('Data URL 분기', () => {
    it.each(['data:image/png;base64,abc123', 'data:image/svg+xml,<svg/>'])('%s는 DATA_URL을 반환한다', (src) => {
      expect(sourceTypeFromString(src)).toBe('DATA_URL');
    });
  });

  describe('SVG XML 분기', () => {
    it.each([
      ['속성이 있는 SVG 마크업', SIMPLE_SVG],
      ['속성 없는 SVG 마크업', '<svg></svg>'],
    ] as const)('%s은 SVG_XML을 반환한다', (_label, src) => {
      expect(sourceTypeFromString(src)).toBe('SVG_XML');
    });
  });

  describe('Blob URL 분기', () => {
    it('blob:으로 시작하는 문자열은 BLOB_URL을 반환한다', () => {
      expect(sourceTypeFromString('blob:https://example.com/image-id')).toBe('BLOB_URL');
    });

    it('앞뒤 공백이 있는 blob: 문자열도 BLOB_URL을 반환한다', () => {
      expect(sourceTypeFromString(' blob:https://example.com/image-id ')).toBe('BLOB_URL');
    });

    it('SVG 마크업 안에 blob: 텍스트가 있어도 SVG_XML이 우선한다', () => {
      // startsWith('blob:')만 검사하므로 본문에 포함된 blob: 텍스트는 URL로 오판하지 않는다.
      expect(sourceTypeFromString('<svg><image href="blob:https://example.com/image-id"/></svg>')).toBe('SVG_XML');
    });
  });

  describe('PATH 분기', () => {
    it('/로 시작하는 절대 경로는 PATH를 반환한다', () => {
      expect(sourceTypeFromString('/images/photo.png')).toBe('PATH');
    });
  });

  describe('undefined 분기', () => {
    it.each([
      ['상대 경로', 'relative/path/image.png'],
      ['확장자만 있는 파일명', 'image.png'],
      ['빈 문자열', ''],
    ] as const)('%s는 undefined를 반환한다', (_label, src) => {
      expect(sourceTypeFromString(src)).toBeUndefined();
    });
  });

  describe('분기 우선순위', () => {
    it('http://로 시작하고 <svg가 포함된 문자열은 HTTP_URL을 반환한다', () => {
      // HTTP URL 검사가 SVG 검사보다 앞서므로 HTTP_URL이 우선한다.
      expect(sourceTypeFromString('http://example.com/?q=<svg')).toBe('HTTP_URL');
    });

    it('data:로 시작하고 <svg가 포함된 문자열은 DATA_URL을 반환한다', () => {
      // DATA URL 검사가 SVG 검사보다 앞서므로 DATA_URL이 우선한다.
      expect(sourceTypeFromString('data:image/svg+xml,<svg/>')).toBe('DATA_URL');
    });

    it('/로 시작하면서 <svg가 포함된 문자열은 SVG_XML을 반환한다', () => {
      // SVG_XML 검사가 PATH 검사보다 앞서므로 SVG_XML이 우선한다.
      expect(sourceTypeFromString('/path<svg/x')).toBe('SVG_XML');
    });
  });
});

describe('imageFormatFromDataUrl', () => {
  it.each([
    ['data:image/png;base64,abc', 'png'],
    ['data:image/jpeg;base64,abc', 'jpg'],
    ['data:image/jpg;base64,abc', 'jpg'],
    ['data:image/svg+xml,<svg/>', 'svg'],
    ['data:image/bmp;base64,abc', 'bmp'],
    ['data:image/tiff;base64,abc', 'tiff'],
    ['data:image/gif;base64,abc', 'gif'],
    ['data:image/webp;base64,abc', 'webp'],
    ['data:image/vnd.microsoft.icon;base64,abc', 'ico'],
  ] as const)('%s → %s', (src, expected) => {
    expect(imageFormatFromDataUrl(src)).toBe(expected);
  });

  it('미인식 MIME 타입은 undefined를 반환한다', () => {
    expect(imageFormatFromDataUrl('data:image/avif;base64,abc')).toBeUndefined();
  });

  it('data: 접두사 없는 문자열은 undefined를 반환한다', () => {
    expect(imageFormatFromDataUrl('image/png')).toBeUndefined();
  });

  it('빈 문자열은 undefined를 반환한다', () => {
    expect(imageFormatFromDataUrl('')).toBeUndefined();
  });
});

describe('isSvgDataUrl', () => {
  it('data:image/svg+xml로 시작하는 문자열은 true를 반환한다', () => {
    expect(isSvgDataUrl('data:image/svg+xml,<svg/>')).toBe(true);
  });

  it('data:image/svg+xml;base64, 형태도 true를 반환한다', () => {
    expect(isSvgDataUrl('data:image/svg+xml;base64,PHN2Zy8+')).toBe(true);
  });

  it('data:image/png으로 시작하면 false를 반환한다', () => {
    expect(isSvgDataUrl('data:image/png;base64,abc')).toBe(false);
  });

  it('data: 없이 SVG 마크업만 있으면 false를 반환한다', () => {
    expect(isSvgDataUrl(SIMPLE_SVG)).toBe(false);
  });

  it('빈 문자열은 false를 반환한다', () => {
    expect(isSvgDataUrl('')).toBe(false);
  });

  it('일반 HTTP URL은 false를 반환한다', () => {
    expect(isSvgDataUrl('https://example.com/image.svg')).toBe(false);
  });
});

describe('checkImageFormatFromString', () => {
  describe('Data URL 직접 판정 경로', () => {
    it('PNG Data URL은 format: "png" 객체를 반환한다', async () => {
      const dataUrl = 'data:image/png;base64,abc';
      const result = await checkImageFormatFromString(dataUrl);
      expect(result).toEqual({ format: 'png', src: dataUrl });
    });

    it('SVG Data URL은 format: "svg" 객체를 반환한다', async () => {
      const dataUrl = 'data:image/svg+xml,<svg/>';
      const result = await checkImageFormatFromString(dataUrl);
      expect(result).toEqual({ format: 'svg', src: dataUrl });
    });

    it('알 수 없는 MIME의 Data URL은 undefined를 반환한다', async () => {
      const result = await checkImageFormatFromString('data:image/avif;base64,abc');
      expect(result).toBeUndefined();
    });
  });

  describe('Data URL 변환 후 판정 경로', () => {
    it('SVG XML 입력은 Data URL로 변환 후 format: "svg"를 반환한다', async () => {
      const result = await checkImageFormatFromString(SIMPLE_SVG);
      expect(result).toBeDefined();
      expect(result!.format).toBe('svg');
      expect(result!.src.startsWith('data:image/svg+xml,')).toBe(true);
    });

    it('미분류 문자열은 undefined를 반환한다', async () => {
      const result = await checkImageFormatFromString('relative/path.png');
      expect(result).toBeUndefined();
    });
  });

  describe('Blob URL MIME 기반 판정 경로', () => {
    const blobUrl = 'blob:https://example.com/image-id';

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('Blob MIME이 image/png이면 format: "png"와 원본 blob URL을 src로 반환하고 원본 URL을 fetch한다', async () => {
      const blob = new Blob(['fake'], { type: 'image/png' });
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ blob: async () => blob } as Response);

      const result = await checkImageFormatFromString(blobUrl);

      expect(result).toEqual({ format: 'png', src: blobUrl });
      expect(fetchSpy).toHaveBeenCalledWith(blobUrl);
    });

    it('MIME에 charset 파라미터가 붙어도 essence로 format을 판정한다', async () => {
      const blob = new Blob(['<svg/>'], { type: 'image/svg+xml; charset=utf-8' });
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ blob: async () => blob } as Response);

      const result = await checkImageFormatFromString(blobUrl);

      expect(result).toEqual({ format: 'svg', src: blobUrl });
    });

    it('Blob MIME이 image/svg+xml이면 format: "svg"를 반환한다', async () => {
      const blob = new Blob(['<svg/>'], { type: 'image/svg+xml' });
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ blob: async () => blob } as Response);

      const result = await checkImageFormatFromString(blobUrl);

      expect(result).toEqual({ format: 'svg', src: blobUrl });
    });

    it('빈 MIME Blob은 undefined를 반환한다', async () => {
      const blob = new Blob(['fake']);
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ blob: async () => blob } as Response);

      expect(await checkImageFormatFromString(blobUrl)).toBeUndefined();
    });

    it('미인식 MIME Blob은 undefined를 반환한다', async () => {
      const blob = new Blob(['fake'], { type: 'image/avif' });
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ blob: async () => blob } as Response);

      expect(await checkImageFormatFromString(blobUrl)).toBeUndefined();
    });

    it('fetch 실패는 undefined를 반환한다', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));

      expect(await checkImageFormatFromString(blobUrl)).toBeUndefined();
    });
  });
});
