import { afterEach, describe, expect, it, vi } from 'vitest';
import { processImage, unsafe_processImage } from '../../src';
import { convertToImageElement } from '../../src/core/source-converter';
import { ImageProcessError } from '../../src/types';

const unsafeSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" onload="alert(1)"><script>alert(1)</script><rect width="12" height="12" fill="red"/></svg>';

function createHeaders(contentType: string): Headers {
  return new Headers({ 'content-type': contentType });
}

function decodeSvgImageSource(src: string): string {
  const base64Prefix = 'data:image/svg+xml;base64,';
  const utf8Prefix = 'data:image/svg+xml,';

  if (src.startsWith(base64Prefix)) {
    return atob(src.slice(base64Prefix.length));
  }

  if (src.startsWith(utf8Prefix)) {
    return decodeURIComponent(src.slice(utf8Prefix.length));
  }

  throw new Error(`SVG data URL이 아닙니다: ${src.slice(0, 64)}`);
}

function expectStrictSanitizedImage(image: HTMLImageElement): void {
  const decoded = decodeSvgImageSource(image.src);

  expect(decoded).toContain('<svg');
  expect(decoded).toContain('<rect');
  expect(decoded).not.toContain('<script');
  expect(decoded).not.toContain('onload=');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('브라우저 SVG 보안 스모크 테스트', () => {
  it.each([
    ['inline SVG 문자열', async () => unsafeSvg],
    ['SVG Data URL', async () => `data:image/svg+xml,${encodeURIComponent(unsafeSvg)}`],
    ['SVG Blob', async () => new Blob([unsafeSvg], { type: 'image/svg+xml' })],
    ['SVG File', async () => new File([unsafeSvg], 'unsafe.svg', { type: '' })],
    ['ArrayBuffer SVG', async () => new TextEncoder().encode(unsafeSvg).buffer as ArrayBuffer],
    ['Uint8Array SVG', async () => new TextEncoder().encode(unsafeSvg)],
  ])('strict sanitizer는 %s 입력을 실제 브라우저 로딩 전에 정화한다', async (_label, createSource) => {
    const image = await convertToImageElement(await createSource(), { svgSanitizer: 'strict' });

    expectStrictSanitizedImage(image);
  });

  it('strict sanitizer는 원격 SVG 응답도 실제 브라우저 로딩 전에 정화한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(unsafeSvg, {
        status: 200,
        headers: createHeaders('image/svg+xml'),
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const image = await convertToImageElement('https://example.com/icon.svg', { svgSanitizer: 'strict' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectStrictSanitizedImage(image);
  });

  it('safe 경로는 상대 리소스 참조 SVG를 차단하고 unsafe 경로는 passthrough로 처리한다', async () => {
    const svgWithRelativeHref =
      '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><image href="./assets/pattern.png" width="12" height="12"/></svg>';

    await expect((processImage(svgWithRelativeHref) as any).toElement()).rejects.toBeInstanceOf(ImageProcessError);

    const image = await (unsafe_processImage(svgWithRelativeHref) as any).toElement();
    expect(image).toBeInstanceOf(HTMLImageElement);
    expect(image.naturalWidth || image.width).toBeGreaterThan(0);
  });

  it('toElement 출력은 실제 브라우저 Blob URL 이미지 로딩 경로로 후속 처리할 수 있다', async () => {
    const element = await (
      processImage(unsafeSvg, { svgSanitizer: 'strict' }).resize({
        fit: 'fill',
        width: 24,
        height: 24,
      }) as any
    ).toElement();

    const result = await processImage(element).resize({ fit: 'fill', width: 12, height: 12 }).toBlob();

    expect(result.width).toBe(12);
    expect(result.height).toBe(12);
    expect(result.blob.size).toBeGreaterThan(0);
  });
});
