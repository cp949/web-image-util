/**
 * image-common.ts 분류/변환/보정 함수 분기 단위 테스트.
 *
 * 순수 문자열 처리·동기 분류·SVG 직렬화 함수의 분기를 검증한다.
 * img.src 로드 경로(urlToElement/convertImageSourceToElement)는 controlled mock으로 검증하고,
 * 실제 네트워크 fetch가 필요한 경로(urlToBlob 등)는 본 테스트 범위 밖이다.
 */

import { afterEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import {
  base64ToBuffer,
  blobToDataUrl,
  blobToFile,
  checkImageFormatFromString,
  convertImageSourceToElement,
  downloadBlob,
  downloadLink,
  fixBlobFileExt,
  imageFormatFromDataUrl,
  isSvgDataUrl,
  sourceTypeFromString,
  stringToBlob,
  stringToDataUrl,
  stringToElement,
  stringToFile,
  svgToBlob,
  svgToDataUrl,
  urlToBuffer,
  urlToDataUrl,
  urlToElement,
} from '../../../src/base/image-common';
import { ImageProcessError } from '../../../src/types';

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

// -----------------------------------------------------------------------
// blobToFile
// -----------------------------------------------------------------------

describe('blobToFile', () => {
  it('Blob에서 File 인스턴스를 반환한다', async () => {
    const blob = new Blob([], { type: 'image/png' });
    const file = await blobToFile(blob, 'photo.png');
    expect(file).toBeInstanceOf(File);
  });

  it('PNG Blob의 타입이 보존된다', async () => {
    const blob = new Blob([], { type: 'image/png' });
    const file = await blobToFile(blob, 'photo.png');
    expect(file.type).toBe('image/png');
  });

  it('MIME에 맞게 확장자가 보정된 파일명이 적용된다 (jpeg → jpg)', async () => {
    const blob = new Blob([], { type: 'image/jpeg' });
    const file = await blobToFile(blob, 'photo.png');
    expect(file.name).toBe('photo.jpg');
  });

  it('SVG Blob은 type이 image/svg+xml인 File을 반환한다', async () => {
    const blob = new Blob([SIMPLE_SVG], { type: 'image/svg+xml' });
    const file = await blobToFile(blob, 'diagram.svg');
    expect(file.type).toBe('image/svg+xml');
    expect(file.name).toBe('diagram.svg');
  });

  it('WebP Blob + 잘못된 확장자는 .webp로 보정한다', async () => {
    const blob = new Blob([], { type: 'image/webp' });
    const file = await blobToFile(blob, 'photo.jpg');
    expect(file.name).toBe('photo.webp');
    expect(file.type).toBe('image/webp');
  });

  it('알 수 없는 MIME Blob은 원 파일명을 유지한다', async () => {
    const blob = new Blob([], { type: 'application/octet-stream' });
    const file = await blobToFile(blob, 'data.bin');
    expect(file.name).toBe('data.bin');
    expect(file.type).toBe('application/octet-stream');
  });
});

// -----------------------------------------------------------------------
// blobToDataUrl
// -----------------------------------------------------------------------

describe('blobToDataUrl', () => {
  it('Blob을 Data URL 문자열로 변환한다', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const result = await blobToDataUrl(blob);
    expect(typeof result).toBe('string');
    expect(result.startsWith('data:')).toBe(true);
  });

  it('SVG Blob의 Data URL은 image/svg+xml MIME으로 시작한다', async () => {
    const blob = new Blob([SIMPLE_SVG], { type: 'image/svg+xml' });
    const result = await blobToDataUrl(blob);
    expect(result.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('Blob의 내용이 Data URL에 온전히 보존된다', async () => {
    // 'Hello' = [72, 101, 108, 108, 111], Base64 = SGVsbG8=
    const blob = new Blob(['Hello'], { type: 'text/plain' });
    const dataUrl = await blobToDataUrl(blob);
    const base64Part = dataUrl.split(',')[1];
    const decoded = atob(base64Part);
    const bytes = Array.from(decoded).map((c) => c.charCodeAt(0));
    expect(bytes).toEqual([72, 101, 108, 108, 111]);
  });
});

// -----------------------------------------------------------------------
// urlToBuffer
// -----------------------------------------------------------------------

describe('urlToBuffer', () => {
  it('Data URL을 Uint8Array로 변환한다', async () => {
    // 'Hello' = [72, 101, 108, 108, 111], Base64 = SGVsbG8=
    const dataUrl = 'data:application/octet-stream;base64,SGVsbG8=';
    const result = await urlToBuffer(dataUrl);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(Array.from(result)).toEqual([72, 101, 108, 108, 111]);
  });

  it('빈 Data URL은 빈 Uint8Array를 반환한다', async () => {
    const dataUrl = 'data:application/octet-stream;base64,';
    const result = await urlToBuffer(dataUrl);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(0);
  });
});

// -----------------------------------------------------------------------
// stringToDataUrl
// -----------------------------------------------------------------------

// HTTP URL과 PATH 입력은 실제 네트워크 fetch가 필요하므로 이 테스트에서 다루지 않는다.
describe('stringToDataUrl', () => {
  it('미분류 문자열은 undefined를 반환한다', async () => {
    expect(await stringToDataUrl('relative/path/image.png')).toBeUndefined();
  });

  it('빈 문자열은 undefined를 반환한다', async () => {
    expect(await stringToDataUrl('')).toBeUndefined();
  });

  it('Data URL 입력은 동일한 URL을 그대로 반환한다', async () => {
    const dataUrl = 'data:image/png;base64,abc123';
    expect(await stringToDataUrl(dataUrl)).toBe(dataUrl);
  });

  it('SVG XML 입력은 data:image/svg+xml, Data URL을 반환한다', async () => {
    const result = await stringToDataUrl(SIMPLE_SVG);
    expect(result).toBeDefined();
    expect(result!.startsWith('data:image/svg+xml,')).toBe(true);
  });

  it('SVG XML에서 생성된 Data URL은 isSvgDataUrl 검사를 통과한다', async () => {
    const result = await stringToDataUrl(SIMPLE_SVG);
    expect(isSvgDataUrl(result!)).toBe(true);
  });
});

// -----------------------------------------------------------------------
// stringToBlob
// -----------------------------------------------------------------------

// HTTP URL과 PATH 입력은 실제 네트워크 fetch가 필요하므로 이 테스트에서 다루지 않는다.
describe('stringToBlob', () => {
  it('미분류 문자열은 undefined를 반환한다', async () => {
    expect(await stringToBlob('relative/path.png')).toBeUndefined();
  });

  it('빈 문자열은 undefined를 반환한다', async () => {
    expect(await stringToBlob('')).toBeUndefined();
  });

  it('SVG XML 입력은 Blob 인스턴스를 반환한다', async () => {
    const blob = await stringToBlob(SIMPLE_SVG);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('SVG XML에서 생성된 Blob의 타입은 image/svg+xml이다', async () => {
    const blob = await stringToBlob(SIMPLE_SVG);
    expect(blob!.type).toBe('image/svg+xml');
  });

  it('SVG XML에서 생성된 Blob의 내용에 SVG 마크업이 포함된다', async () => {
    const blob = await stringToBlob(SIMPLE_SVG);
    const text = await blob!.text();
    expect(text).toContain('<svg');
  });

  it('Data URL 입력은 Blob 인스턴스를 반환한다', async () => {
    // fetch로 Data URL을 Blob으로 변환한다
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=';
    const blob = await stringToBlob(dataUrl);
    expect(blob).toBeInstanceOf(Blob);
  });
});

// -----------------------------------------------------------------------
// stringToFile
// -----------------------------------------------------------------------

describe('stringToFile', () => {
  it('미분류 문자열은 undefined를 반환한다', async () => {
    expect(await stringToFile('relative.png', 'output.png')).toBeUndefined();
  });

  it('빈 문자열은 undefined를 반환한다', async () => {
    expect(await stringToFile('', 'output.png')).toBeUndefined();
  });

  it('SVG XML 입력은 File 인스턴스를 반환한다', async () => {
    const file = await stringToFile(SIMPLE_SVG, 'output.svg');
    expect(file).toBeInstanceOf(File);
  });

  it('SVG XML에서 생성된 File의 타입은 image/svg+xml이다', async () => {
    const file = await stringToFile(SIMPLE_SVG, 'output.svg');
    expect(file!.type).toBe('image/svg+xml');
  });

  it('SVG XML에서 생성된 File의 파일명은 확장자가 .svg로 보정된다', async () => {
    // SVG Blob이 되면 fixBlobFileExt가 .svg 확장자를 적용한다
    const file = await stringToFile(SIMPLE_SVG, 'output.png');
    expect(file!.name).toBe('output.svg');
  });
});

// -----------------------------------------------------------------------
// downloadBlob
// -----------------------------------------------------------------------

describe('downloadBlob', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('download 지원 환경에서 anchor 요소를 DOM에 추가하고 클릭 후 제거한다', () => {
    const blob = new Blob(['data'], { type: 'image/png' });
    const fakeObjectUrl = 'blob:http://localhost/test-fake-id';

    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue(fakeObjectUrl);
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

    // createElement가 반환하는 anchor에 click spy를 심어 실제 탐색을 차단한다
    const realCreate = document.createElement.bind(document);
    let capturedAnchor: HTMLAnchorElement | null = null;
    let clickSpy: MockInstance | null = null;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'a') {
        capturedAnchor = el as HTMLAnchorElement;
        clickSpy = vi.spyOn(capturedAnchor, 'click').mockImplementation(() => {});
      }
      return el;
    });

    downloadBlob(blob, 'photo.png');

    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(appendSpy).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(capturedAnchor).not.toBeNull();
    expect(capturedAnchor!.href).toBe(fakeObjectUrl);
    expect(capturedAnchor!.download).toBe('photo.png');
    expect(capturedAnchor!.type).toBe('image/png');
    expect(clickSpy).not.toBeNull();
    expect(clickSpy!).toHaveBeenCalledTimes(1);
    // click 후 revoke 순서 보장 (click → revokeObjectURL)
    expect(clickSpy!.mock.invocationCallOrder[0]).toBeLessThan(
      revokeSpy.mock.invocationCallOrder[0],
    );
    expect(revokeSpy).toHaveBeenCalledWith(fakeObjectUrl);
    expect(removeSpy).toHaveBeenCalled();
  });

  it('anchor에 crossorigin 속성이 anonymous로 설정된다', () => {
    const blob = new Blob([], { type: 'image/png' });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/x');
    vi.spyOn(URL, 'revokeObjectURL');

    let capturedAnchor: HTMLAnchorElement | null = null;
    let clickSpy: MockInstance | null = null;
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'a') {
        capturedAnchor = el as HTMLAnchorElement;
        clickSpy = vi.spyOn(capturedAnchor, 'click').mockImplementation(() => {});
      }
      return el;
    });

    downloadBlob(blob, 'image.png');

    expect(capturedAnchor).not.toBeNull();
    expect(capturedAnchor!.getAttribute('crossorigin')).toBe('anonymous');
    expect(clickSpy).not.toBeNull();
    expect(clickSpy!).toHaveBeenCalledTimes(1);
  });
});

// -----------------------------------------------------------------------
// downloadLink
// -----------------------------------------------------------------------

describe('downloadLink', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('download 지원 환경에서 anchor 요소를 DOM에 추가하고 클릭 후 제거한다', () => {
    const href = 'https://example.com/file.bin';

    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    let capturedAnchor: HTMLAnchorElement | null = null;
    let clickSpy: MockInstance | null = null;
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'a') {
        capturedAnchor = el as HTMLAnchorElement;
        clickSpy = vi.spyOn(capturedAnchor, 'click').mockImplementation(() => {});
      }
      return el;
    });

    downloadLink(href);

    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(appendSpy).toHaveBeenCalled();
    expect(capturedAnchor).not.toBeNull();
    expect(capturedAnchor!.href).toBe(href);
    expect(capturedAnchor!.type).toBe('application/octet-stream');
    expect(clickSpy).not.toBeNull();
    expect(clickSpy!).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------
// checkImageFormatFromString
// -----------------------------------------------------------------------

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
});

// -----------------------------------------------------------------------
// urlToElement / convertImageSourceToElement / stringToElement
//   - 실제 네트워크 없이 img.src 로드 경로만 controlled mock으로 검증한다.
// -----------------------------------------------------------------------

/**
 * src 할당 시 동기적으로 load/error 이벤트를 발생시키는 제어 img를 만든다.
 * 할당된 src는 getter로 노출해 어떤 URL이 전달됐는지 검증할 수 있다.
 */
function createControlledImg(outcome: 'load' | 'error'): HTMLImageElement {
  const img = document.createElement('img') as HTMLImageElement;
  let assignedSrc = '';
  Object.defineProperty(img, 'src', {
    configurable: true,
    get: () => assignedSrc,
    set: (value: string) => {
      assignedSrc = value;
      // urlToElement는 onload/onerror를 src 할당 전에 등록하므로 동기 트리거가 안전하다.
      if (outcome === 'load') {
        img.onload?.(new Event('load'));
      } else {
        img.onerror?.(new Event('error'));
      }
    },
  });
  return img;
}

/** document.createElement('img') 호출만 제어 img로 가로채고 나머지는 원본을 사용한다. */
function spyCreateImg(controlledImg: HTMLImageElement): MockInstance {
  const realCreate = document.createElement.bind(document);
  return vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'img') return controlledImg as unknown as HTMLElement;
    return realCreate(tag as keyof HTMLElementTagNameMap);
  });
}

describe('urlToElement', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('load 성공 시 생성한 img를 반환하고 src에 입력 URL을 그대로 설정한다', async () => {
    const img = createControlledImg('load');
    spyCreateImg(img);

    const result = await urlToElement('https://example.com/a.png');

    expect(result).toBe(img);
    expect(result.src).toBe('https://example.com/a.png');
  });

  it('crossOrigin 옵션을 주면 img.crossOrigin에 반영된다', async () => {
    const img = createControlledImg('load');
    spyCreateImg(img);

    const result = await urlToElement('https://example.com/a.png', { crossOrigin: 'anonymous' });

    expect(result.crossOrigin).toBe('anonymous');
  });

  it('load 실패 시 SOURCE_LOAD_FAILED 코드의 ImageProcessError로 거부하고 url을 context에 보존한다', async () => {
    const img = createControlledImg('error');
    spyCreateImg(img);

    let caught: unknown;
    try {
      await urlToElement('https://example.com/missing.png');
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(ImageProcessError);
    const err = caught as ImageProcessError;
    expect(err.code).toBe('SOURCE_LOAD_FAILED');
    // context에 실패한 url이 보존된다.
    expect((err as unknown as { context?: { format?: string } }).context?.format).toBe(
      'https://example.com/missing.png'
    );
  });
});

describe('urlToDataUrl — data URL passthrough', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('data:로 시작하는 입력은 fetch 없이 동일 문자열을 그대로 반환한다', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const dataUrl = 'data:image/png;base64,abc';

    const result = await urlToDataUrl(dataUrl);

    expect(result).toBe(dataUrl);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('convertImageSourceToElement — 입력 타입 분류', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('HTMLImageElement 입력은 변환 없이 동일 인스턴스를 반환한다', async () => {
    const img = document.createElement('img') as HTMLImageElement;

    const result = await convertImageSourceToElement(img);

    expect(result).toBe(img);
  });

  it('지원하지 않는 타입(number)은 Unsupported 오류를 던진다', async () => {
    await expect(convertImageSourceToElement(123 as unknown as Blob)).rejects.toThrow(
      'Unsupported image source type: number'
    );
  });

  it('http URL 문자열은 SVG 직렬화를 거치지 않고 원본 URL을 src로 로드한다', async () => {
    const img = createControlledImg('load');
    spyCreateImg(img);

    const result = await convertImageSourceToElement('https://example.com/photo.png');

    expect(result).toBe(img);
    expect(result.src).toBe('https://example.com/photo.png');
  });

  it('인라인 SVG 문자열은 data:image/svg+xml Data URL로 직렬화된 뒤 로드된다', async () => {
    const img = createControlledImg('load');
    spyCreateImg(img);

    await convertImageSourceToElement(SIMPLE_SVG);

    expect(img.src.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('Blob 입력은 Data URL로 변환된 뒤 img로 로드된다', async () => {
    const img = createControlledImg('load');
    spyCreateImg(img);

    const blob = new Blob(['fake-bytes'], { type: 'image/png' });
    const result = await convertImageSourceToElement(blob);

    expect(result).toBe(img);
    // blobToDataUrl(FileReader)을 거치므로 data: Data URL이 src로 설정된다.
    expect(img.src.startsWith('data:')).toBe(true);
  });

  it('ArrayBuffer 입력은 Blob으로 포장된 뒤 Data URL로 변환되어 로드된다', async () => {
    const img = createControlledImg('load');
    spyCreateImg(img);

    const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
    const result = await convertImageSourceToElement(buffer);

    expect(result).toBe(img);
    expect(img.src.startsWith('data:')).toBe(true);
  });

  it('Uint8Array 입력은 Blob으로 포장된 뒤 Data URL로 변환되어 로드된다', async () => {
    const img = createControlledImg('load');
    spyCreateImg(img);

    const bytes = new Uint8Array([1, 2, 3, 4]);
    const result = await convertImageSourceToElement(bytes);

    expect(result).toBe(img);
    expect(img.src.startsWith('data:')).toBe(true);
  });

  it('비-SVG·비-URL 문자열(상대 경로)은 SVG 직렬화 없이 원본 문자열을 src로 로드한다', async () => {
    const img = createControlledImg('load');
    spyCreateImg(img);

    const result = await convertImageSourceToElement('relative/path.png');

    expect(result).toBe(img);
    // 경로 문자열은 그대로 urlToElement로 전달된다(data: 직렬화 없음).
    expect(result.src).toBe('relative/path.png');
  });
});

describe('stringToElement', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('미분류 문자열(상대 경로)은 Data URL 변환에 실패해 undefined를 반환한다', async () => {
    // sourceTypeFromString이 undefined → stringToDataUrl undefined → element도 undefined
    const result = await stringToElement('relative/path.png');

    expect(result).toBeUndefined();
  });
});
