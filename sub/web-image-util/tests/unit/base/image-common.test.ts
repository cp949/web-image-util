/**
 * image-common.ts 분류/변환/보정 함수 분기 단위 테스트.
 *
 * 순수 문자열 처리·동기 분류·SVG 직렬화 함수의 분기를 검증한다.
 * 네트워크 의존 함수(urlTo*)와 실제 이미지 디코딩 경로는 본 테스트 범위 밖이다.
 */

import { describe, expect, it } from 'vitest';
import {
  base64ToBuffer,
  fixBlobFileExt,
  imageFormatFromDataUrl,
  isSvgDataUrl,
  sourceTypeFromString,
  svgToBlob,
  svgToDataUrl,
} from '../../../src/base/image-common';

// 테스트용 작은 SVG fixture
const SIMPLE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';

// -----------------------------------------------------------------------
// sourceTypeFromString
// -----------------------------------------------------------------------

describe('sourceTypeFromString', () => {
  describe('HTTP URL 분기', () => {
    it('http://로 시작하면 HTTP_URL을 반환한다', () => {
      expect(sourceTypeFromString('http://example.com/image.png')).toBe('HTTP_URL');
    });

    it('https://로 시작하면 HTTP_URL을 반환한다', () => {
      expect(sourceTypeFromString('https://example.com/image.png')).toBe('HTTP_URL');
    });
  });

  describe('Data URL 분기', () => {
    it('data:로 시작하면 DATA_URL을 반환한다', () => {
      expect(sourceTypeFromString('data:image/png;base64,abc123')).toBe('DATA_URL');
    });

    it('data:image/svg+xml 형태도 DATA_URL을 반환한다', () => {
      expect(sourceTypeFromString('data:image/svg+xml,<svg/>')).toBe('DATA_URL');
    });
  });

  describe('SVG XML 분기', () => {
    it('<svg가 포함되면 SVG_XML을 반환한다', () => {
      expect(sourceTypeFromString(SIMPLE_SVG)).toBe('SVG_XML');
    });

    it('속성 없이 <svg만 포함해도 SVG_XML을 반환한다', () => {
      expect(sourceTypeFromString('<svg></svg>')).toBe('SVG_XML');
    });
  });

  describe('PATH 분기', () => {
    it('/로 시작하는 절대 경로는 PATH를 반환한다', () => {
      expect(sourceTypeFromString('/images/photo.png')).toBe('PATH');
    });
  });

  describe('undefined 분기', () => {
    it('상대 경로는 undefined를 반환한다', () => {
      expect(sourceTypeFromString('relative/path/image.png')).toBeUndefined();
    });

    it('확장자만 있는 파일명은 undefined를 반환한다', () => {
      expect(sourceTypeFromString('image.png')).toBeUndefined();
    });

    it('빈 문자열은 undefined를 반환한다', () => {
      expect(sourceTypeFromString('')).toBeUndefined();
    });
  });

  describe('분기 우선순위', () => {
    it('http://로 시작하고 <svg가 포함된 문자열은 HTTP_URL을 반환한다', () => {
      // HTTP URL 검사가 SVG 검사보다 앞서므로 HTTP_URL이 우선한다
      expect(sourceTypeFromString('http://example.com/?q=<svg')).toBe('HTTP_URL');
    });

    it('data:로 시작하고 <svg가 포함된 문자열은 DATA_URL을 반환한다', () => {
      // DATA URL 검사가 SVG 검사보다 앞서므로 DATA_URL이 우선한다
      expect(sourceTypeFromString('data:image/svg+xml,<svg/>')).toBe('DATA_URL');
    });

    it('/로 시작하면서 <svg가 포함된 문자열은 SVG_XML을 반환한다', () => {
      // SVG_XML 검사가 PATH 검사보다 앞서므로 SVG_XML이 우선한다
      expect(sourceTypeFromString('/path<svg/x')).toBe('SVG_XML');
    });
  });
});

// -----------------------------------------------------------------------
// imageFormatFromDataUrl
// -----------------------------------------------------------------------

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

// -----------------------------------------------------------------------
// isSvgDataUrl
// -----------------------------------------------------------------------

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

// -----------------------------------------------------------------------
// svgToDataUrl
// -----------------------------------------------------------------------

describe('svgToDataUrl', () => {
  it('data:image/svg+xml, 접두사로 시작하는 문자열을 반환한다', () => {
    const result = svgToDataUrl(SIMPLE_SVG);
    expect(result.startsWith('data:image/svg+xml,')).toBe(true);
  });

  it('반환된 Data URL은 isSvgDataUrl 검사를 통과한다', () => {
    const result = svgToDataUrl(SIMPLE_SVG);
    expect(isSvgDataUrl(result)).toBe(true);
  });

  it('&nbsp를 &#160으로 치환한 뒤 인코딩한다', () => {
    const svgWithNbsp = '<svg xmlns="http://www.w3.org/2000/svg"><text>&nbsp;</text></svg>';
    const result = svgToDataUrl(svgWithNbsp);
    const decoded = decodeURIComponent(result.replace('data:image/svg+xml,', ''));
    expect(decoded).toContain('&#160');
    expect(decoded).not.toContain('&nbsp');
  });

  it('공백이 %20으로 퍼센트 인코딩된다', () => {
    const result = svgToDataUrl('<svg width="10 20"/>');
    expect(result).toContain('%20');
  });
});

// -----------------------------------------------------------------------
// svgToBlob
// -----------------------------------------------------------------------

describe('svgToBlob', () => {
  it('Blob 인스턴스를 반환한다', () => {
    const blob = svgToBlob(SIMPLE_SVG);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('반환 Blob의 MIME 타입은 image/svg+xml이다', () => {
    const blob = svgToBlob(SIMPLE_SVG);
    expect(blob.type).toBe('image/svg+xml');
  });

  it('Blob 크기가 0보다 크다', () => {
    const blob = svgToBlob(SIMPLE_SVG);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('&nbsp를 &#160으로 치환한 내용을 Blob에 담는다', async () => {
    const svgWithNbsp = '<svg xmlns="http://www.w3.org/2000/svg"><text>&nbsp;</text></svg>';
    const blob = svgToBlob(svgWithNbsp);
    const text = await blob.text();
    expect(text).toContain('&#160');
    expect(text).not.toContain('&nbsp');
  });
});

// -----------------------------------------------------------------------
// fixBlobFileExt
// -----------------------------------------------------------------------

describe('fixBlobFileExt', () => {
  describe('MIME와 확장자가 일치하는 경우', () => {
    it('PNG Blob + .png 파일명은 그대로 반환한다', () => {
      const blob = new Blob([], { type: 'image/png' });
      expect(fixBlobFileExt(blob, 'photo.png')).toBe('photo.png');
    });

    it('JPEG Blob + .jpg 파일명은 그대로 반환한다', () => {
      const blob = new Blob([], { type: 'image/jpeg' });
      expect(fixBlobFileExt(blob, 'photo.jpg')).toBe('photo.jpg');
    });

    it('대소문자 구분 없이 일치 여부를 판단한다 (photo.PNG + image/png → 그대로)', () => {
      const blob = new Blob([], { type: 'image/png' });
      expect(fixBlobFileExt(blob, 'photo.PNG')).toBe('photo.PNG');
    });

    it('SVG Blob + .svg 파일명은 그대로 반환한다', () => {
      const blob = new Blob([], { type: 'image/svg+xml' });
      expect(fixBlobFileExt(blob, 'diagram.svg')).toBe('diagram.svg');
    });
  });

  describe('MIME와 확장자가 불일치하는 경우', () => {
    it('PNG Blob + .jpg 파일명은 확장자를 .png로 교체한다', () => {
      const blob = new Blob([], { type: 'image/png' });
      expect(fixBlobFileExt(blob, 'photo.jpg')).toBe('photo.png');
    });

    it('JPEG Blob + .png 파일명은 확장자를 .jpg로 교체한다', () => {
      const blob = new Blob([], { type: 'image/jpeg' });
      expect(fixBlobFileExt(blob, 'photo.png')).toBe('photo.jpg');
    });

    it('WebP Blob + .png 파일명은 확장자를 .webp로 교체한다', () => {
      const blob = new Blob([], { type: 'image/webp' });
      expect(fixBlobFileExt(blob, 'photo.png')).toBe('photo.webp');
    });
  });

  describe('파일명에 확장자가 없는 경우', () => {
    it('확장자 없는 파일명 + PNG Blob은 .png를 추가한다', () => {
      const blob = new Blob([], { type: 'image/png' });
      expect(fixBlobFileExt(blob, 'photo')).toBe('photo.png');
    });

    it('점이 첫 글자인 파일명(.hidden)은 뒤에 .png를 붙인다', () => {
      // lastIndexOf('.') === 0 → idx > 0 조건 불만족 → 파일명 뒤에 확장자 추가
      const blob = new Blob([], { type: 'image/png' });
      expect(fixBlobFileExt(blob, '.hidden')).toBe('.hidden.png');
    });
  });

  describe('알 수 없는 MIME 타입인 경우', () => {
    it('매핑 없는 MIME Blob은 파일명을 그대로 반환한다', () => {
      const blob = new Blob([], { type: 'application/octet-stream' });
      expect(fixBlobFileExt(blob, 'photo.jpg')).toBe('photo.jpg');
    });

    it('빈 MIME Blob은 파일명을 그대로 반환한다', () => {
      const blob = new Blob([]);
      expect(fixBlobFileExt(blob, 'photo.jpg')).toBe('photo.jpg');
    });
  });
});

// -----------------------------------------------------------------------
// base64ToBuffer
// -----------------------------------------------------------------------

describe('base64ToBuffer', () => {
  it('정상 base64 문자열을 Uint8Array로 변환한다', async () => {
    // 'Hello' = [72, 101, 108, 108, 111]
    const result = await base64ToBuffer('SGVsbG8=');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(5);
    expect(Array.from(result)).toEqual([72, 101, 108, 108, 111]);
  });

  it('1바이트 base64도 정확히 변환한다', async () => {
    // 'A' = [65]
    const result = await base64ToBuffer('QQ==');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(1);
    expect(result[0]).toBe(65);
  });

  it('빈 base64 문자열은 빈 Uint8Array를 반환한다', async () => {
    const result = await base64ToBuffer('');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(0);
  });

  it('base64 알파벳 밖 문자가 포함된 입력은 Promise를 거부한다', async () => {
    // '!!!invalid!!!' 는 base64 알파벳 밖 문자이므로 fetch가 TypeError로 실패한다
    await expect(base64ToBuffer('!!!invalid!!!')).rejects.toThrow();
  });

  it('@ 기호가 포함된 입력도 Promise를 거부한다', async () => {
    await expect(base64ToBuffer('@@@@')).rejects.toThrow();
  });
});
