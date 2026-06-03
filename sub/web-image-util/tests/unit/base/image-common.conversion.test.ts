/**
 * image-common.ts Blob/File/Data URL 변환과 파일명 보정 함수 단위 테스트.
 */

import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  base64ToBuffer,
  blobToDataUrl,
  blobToFile,
  fixBlobFileExt,
  isSvgDataUrl,
  stringToBlob,
  stringToDataUrl,
  stringToFile,
  svgToBlob,
  svgToDataUrl,
  urlToBuffer,
} from '../../../src/base/image-common.internal';
import { createImageBlob, SIMPLE_SVG } from './image-common.helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe('fixBlobFileExt', () => {
  describe('MIME와 확장자가 일치하는 경우', () => {
    it.each([
      ['image/png', 'photo.png', 'photo.png'],
      ['image/jpeg', 'photo.jpg', 'photo.jpg'],
      ['image/png', 'photo.PNG', 'photo.PNG'],
      ['image/svg+xml', 'diagram.svg', 'diagram.svg'],
    ] as const)('%s Blob + %s 파일명은 %s를 반환한다', (type, fileName, expected) => {
      expect(fixBlobFileExt(createImageBlob(type), fileName)).toBe(expected);
    });
  });

  describe('MIME와 확장자가 불일치하는 경우', () => {
    it.each([
      ['image/png', 'photo.jpg', 'photo.png'],
      ['image/jpeg', 'photo.png', 'photo.jpg'],
      ['image/webp', 'photo.png', 'photo.webp'],
    ] as const)('%s Blob + %s 파일명은 %s로 보정한다', (type, fileName, expected) => {
      expect(fixBlobFileExt(createImageBlob(type), fileName)).toBe(expected);
    });
  });

  describe('파일명에 확장자가 없는 경우', () => {
    it.each([
      ['photo', 'photo.png'],
      ['.hidden', '.hidden.png'],
    ] as const)('%s 파일명에는 .png를 추가한다', (fileName, expected) => {
      // 확장자 경계로 인정할 점이 없으면 파일명 뒤에 MIME 확장자를 붙인다.
      expect(fixBlobFileExt(createImageBlob('image/png'), fileName)).toBe(expected);
    });
  });

  describe('알 수 없는 MIME 타입인 경우', () => {
    it('매핑 없는 MIME Blob은 파일명을 그대로 반환한다', () => {
      expect(fixBlobFileExt(createImageBlob('application/octet-stream'), 'photo.jpg')).toBe('photo.jpg');
    });

    it('빈 MIME Blob은 파일명을 그대로 반환한다', () => {
      const blob = new Blob([]);
      expect(fixBlobFileExt(blob, 'photo.jpg')).toBe('photo.jpg');
    });
  });
});

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
    // '!!!invalid!!!' 는 base64 알파벳 밖 문자이므로 fetch가 TypeError로 실패한다.
    await expect(base64ToBuffer('!!!invalid!!!')).rejects.toThrow();
  });

  it('@ 기호가 포함된 입력도 Promise를 거부한다', async () => {
    await expect(base64ToBuffer('@@@@')).rejects.toThrow();
  });
});

describe('blobToFile', () => {
  it('Blob에서 File 인스턴스를 반환한다', async () => {
    const blob = createImageBlob('image/png');
    const file = await blobToFile(blob, 'photo.png');
    expect(file).toBeInstanceOf(File);
  });

  it('PNG Blob의 타입이 보존된다', async () => {
    const blob = createImageBlob('image/png');
    const file = await blobToFile(blob, 'photo.png');
    expect(file.type).toBe('image/png');
  });

  it('MIME에 맞게 확장자가 보정된 파일명이 적용된다 (jpeg → jpg)', async () => {
    const blob = createImageBlob('image/jpeg');
    const file = await blobToFile(blob, 'photo.png');
    expect(file.name).toBe('photo.jpg');
  });

  it('SVG Blob은 type이 image/svg+xml인 File을 반환한다', async () => {
    const blob = createImageBlob('image/svg+xml', [SIMPLE_SVG]);
    const file = await blobToFile(blob, 'diagram.svg');
    expect(file.type).toBe('image/svg+xml');
    expect(file.name).toBe('diagram.svg');
  });

  it('WebP Blob + 잘못된 확장자는 .webp로 보정한다', async () => {
    const blob = createImageBlob('image/webp');
    const file = await blobToFile(blob, 'photo.jpg');
    expect(file.name).toBe('photo.webp');
    expect(file.type).toBe('image/webp');
  });

  it('알 수 없는 MIME Blob은 원 파일명을 유지한다', async () => {
    const blob = createImageBlob('application/octet-stream');
    const file = await blobToFile(blob, 'data.bin');
    expect(file.name).toBe('data.bin');
    expect(file.type).toBe('application/octet-stream');
  });
});

describe('blobToDataUrl', () => {
  it('Blob을 Data URL 문자열로 변환한다', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const result = await blobToDataUrl(blob);
    expect(typeof result).toBe('string');
    expect(result.startsWith('data:')).toBe(true);
  });

  it('SVG Blob의 Data URL은 image/svg+xml MIME으로 시작한다', async () => {
    const blob = createImageBlob('image/svg+xml', [SIMPLE_SVG]);
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

// HTTP URL과 PATH 입력은 실제 네트워크 fetch가 필요하므로 이 테스트에서 다루지 않는다.
describe('stringToDataUrl', () => {
  it.each([
    ['미분류 문자열', 'relative/path/image.png'],
    ['빈 문자열', ''],
  ] as const)('%s은 undefined를 반환한다', async (_label, src) => {
    expect(await stringToDataUrl(src)).toBeUndefined();
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

// HTTP URL과 PATH 입력은 실제 네트워크 fetch가 필요하므로 이 테스트에서 다루지 않는다.
describe('stringToBlob', () => {
  it.each([
    ['미분류 문자열', 'relative/path.png'],
    ['빈 문자열', ''],
  ] as const)('%s은 undefined를 반환한다', async (_label, src) => {
    expect(await stringToBlob(src)).toBeUndefined();
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
    // fetch로 Data URL을 Blob으로 변환한다.
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=';
    const blob = await stringToBlob(dataUrl);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('fetch가 다른 realm의 Blob을 반환해도 현재 realm Blob으로 정규화한다', async () => {
    const foreignBlob = new NodeBlob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      blob: async () => foreignBlob,
    } as Response);

    const blob = await stringToBlob('data:image/png;base64,AQID');

    expect(blob).toBeInstanceOf(Blob);
    expect(blob).not.toBe(foreignBlob);
    expect(blob!.type).toBe('image/png');
    expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });
});

describe('stringToFile', () => {
  it.each([
    ['미분류 문자열', 'relative.png'],
    ['빈 문자열', ''],
  ] as const)('%s은 undefined를 반환한다', async (_label, src) => {
    expect(await stringToFile(src, 'output.png')).toBeUndefined();
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
    // SVG Blob이 되면 fixBlobFileExt가 .svg 확장자를 적용한다.
    const file = await stringToFile(SIMPLE_SVG, 'output.png');
    expect(file!.name).toBe('output.svg');
  });
});
