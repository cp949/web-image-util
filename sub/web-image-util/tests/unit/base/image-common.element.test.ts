/**
 * image-common.ts 이미지 element 로드 경로 단위 테스트.
 *
 * 실제 네트워크 없이 img.src 로드 경로만 controlled mock으로 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  convertImageSourceToElement,
  stringToElement,
  urlToDataUrl,
  urlToElement,
} from '../../../src/base/image-common';
import { ImageProcessError } from '../../../src/types';
import { createControlledImg, SIMPLE_SVG, spyCreateImg } from './image-common.helpers';

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

  it.each([
    ['ArrayBuffer', () => new Uint8Array([1, 2, 3, 4]).buffer],
    ['Uint8Array', () => new Uint8Array([1, 2, 3, 4])],
  ] as const)('%s 입력은 Blob으로 포장된 뒤 Data URL로 변환되어 로드된다', async (_label, createSource) => {
    const img = createControlledImg('load');
    spyCreateImg(img);

    const result = await convertImageSourceToElement(createSource());

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
