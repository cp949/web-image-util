/**
 * 소스 판정 결과가 파이프라인을 관통하는지 검증하는 테스트.
 *
 * - `detectStringSourceType`이 SVG 하위 유형까지 구분해 돌려준다.
 * - `convertStringToElement`는 문자열 형태를 다시 판정하지 않고 판정 결과만 보고 분기한다.
 *   (판정을 조작했을 때 형태와 무관하게 조작된 분기로 가는지로 확인한다)
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  detectSourceType,
  detectSourceTypeAsync,
  detectStringSourceType,
  isSvgSourceType,
} from '../../../src/core/source-converter/detect.internal';

/** 스니핑 판정에 충분한 최소 인라인 SVG 문자열 */
const MINIMAL_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="1" height="1"/></svg>';

const STRING_LOADER_PATH = '../../../src/core/source-converter/loaders/string.internal';

describe('detectStringSourceType — 문자열 판정 표', () => {
  it('인라인 SVG 문자열은 svg-inline으로 판정한다', () => {
    expect(detectStringSourceType(MINIMAL_SVG)).toBe('svg-inline');
    expect(detectStringSourceType(`  \n${MINIMAL_SVG}  `)).toBe('svg-inline');
  });

  it('SVG Data URL은 인코딩 방식과 무관하게 svg-datauri로 판정한다', () => {
    expect(
      detectStringSourceType(
        'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3C%2Fsvg%3E'
      )
    ).toBe('svg-datauri');
    expect(
      detectStringSourceType(
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnPjxyZWN0Lz48L3N2Zz4='
      )
    ).toBe('svg-datauri');
  });

  it('SVG가 아닌 Data URL은 dataurl로 판정한다', () => {
    expect(detectStringSourceType('data:image/png;base64,AAAA')).toBe('dataurl');
  });

  it('.svg를 가리키는 http(s) URL과 protocol-relative URL은 svg-url로 판정한다', () => {
    expect(detectStringSourceType('https://example.com/icon.svg')).toBe('svg-url');
    expect(detectStringSourceType('http://example.com/icon.svg?v=1')).toBe('svg-url');
    expect(detectStringSourceType('//cdn.example.com/icon.svg')).toBe('svg-url');
  });

  it('.svg가 아닌 원격 URL은 url로 판정한다', () => {
    expect(detectStringSourceType('https://example.com/photo.png')).toBe('url');
    expect(detectStringSourceType('//cdn.example.com/photo.webp')).toBe('url');
  });

  it('대문자 HTTP(S) 스킴도 원격 URL로 판정한다', () => {
    expect(detectStringSourceType('HTTPS://example.com/icon.svg')).toBe('svg-url');
    expect(detectStringSourceType('HTTP://example.com/photo.png')).toBe('url');
  });

  it('Blob URL은 bloburl로 판정한다', () => {
    expect(detectStringSourceType('blob:https://example.com/123')).toBe('bloburl');
  });

  it('대문자 Blob 스킴도 bloburl로 판정한다', () => {
    expect(detectStringSourceType('BLOB:https://example.com/123')).toBe('bloburl');
  });

  it('스킴 없는 .svg 경로는 svg-path로, 그 외 경로는 path로 판정한다', () => {
    expect(detectStringSourceType('/assets/icon.svg')).toBe('svg-path');
    expect(detectStringSourceType('./assets/icon.svg?v=1')).toBe('svg-path');
    expect(detectStringSourceType('./assets/photo.png')).toBe('path');
    expect(detectStringSourceType('')).toBe('path');
  });
});

describe('detectSourceType — 문자열 위임과 SVG Blob 구분', () => {
  it('문자열 입력은 detectStringSourceType의 세분 판정을 그대로 돌려준다', () => {
    expect(detectSourceType(MINIMAL_SVG)).toBe('svg-inline');
    expect(detectSourceType('https://example.com/icon.svg')).toBe('svg-url');
    expect(detectSourceType('./assets/photo.png')).toBe('path');
  });

  it('SVG MIME 또는 .svg 파일명을 가진 Blob은 svg-blob으로 판정한다', () => {
    expect(detectSourceType(new Blob([MINIMAL_SVG], { type: 'image/svg+xml' }))).toBe('svg-blob');
    expect(detectSourceType(new File([MINIMAL_SVG], 'icon.svg', { type: '' }))).toBe('svg-blob');
    expect(detectSourceType(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }))).toBe('blob');
  });

  it('대문자 SVG MIME도 정규화해 svg-blob으로 판정한다', () => {
    // Blob 생성자는 type을 소문자화하므로 정규화 누락은 실제 Blob으로 드러나지 않는다.
    // 이 판정이 SVG 보안 경로의 게이트이므로 정규화 계약을 직접 고정한다.
    const blob = new Blob([MINIMAL_SVG], { type: 'image/svg+xml' });
    Object.defineProperty(blob, 'type', { value: 'IMAGE/SVG+XML' });

    expect(detectSourceType(blob)).toBe('svg-blob');
  });

  it('파라미터가 붙은 SVG MIME도 svg-blob으로 판정한다', () => {
    expect(detectSourceType(new Blob([MINIMAL_SVG], { type: 'image/svg+xml; charset=utf-8' }))).toBe('svg-blob');
  });

  it('대문자 SVG 확장자 File도 svg-blob으로 판정한다', () => {
    expect(detectSourceType(new File([MINIMAL_SVG], 'photo.SVG', { type: 'application/octet-stream' }))).toBe(
      'svg-blob'
    );
  });

  it('isSvgSourceType은 SVG 계열 판정만 참으로 본다', () => {
    expect(
      ['svg-inline', 'svg-datauri', 'svg-url', 'svg-path', 'svg-blob'].every((type) => isSvgSourceType(type as never))
    ).toBe(true);
    expect(
      ['dataurl', 'url', 'bloburl', 'path', 'blob', 'element', 'canvas'].some((type) => isSvgSourceType(type as never))
    ).toBe(false);
  });
});

describe('detectSourceTypeAsync — Blob 본문까지 포함한 최종 판정', () => {
  it.each([
    { caseName: 'MIME 없음', source: new Blob([MINIMAL_SVG], { type: '' }), expected: 'svg-blob' },
    { caseName: 'text/xml MIME', source: new Blob([MINIMAL_SVG], { type: 'text/xml' }), expected: 'svg-blob' },
    {
      caseName: 'application/octet-stream MIME',
      source: new Blob([MINIMAL_SVG], { type: 'application/octet-stream' }),
      expected: 'svg-blob',
    },
    { caseName: 'text/plain MIME', source: new Blob([MINIMAL_SVG], { type: 'text/plain' }), expected: 'svg-blob' },
    {
      caseName: 'application/rss+xml MIME',
      source: new Blob([MINIMAL_SVG], { type: 'application/rss+xml' }),
      expected: 'svg-blob',
    },
    {
      caseName: 'text/xml-external-parsed-entity MIME',
      source: new Blob([MINIMAL_SVG], { type: 'text/xml-external-parsed-entity' }),
      expected: 'svg-blob',
    },
    {
      caseName: 'application/xml-external-parsed-entity MIME',
      source: new Blob([MINIMAL_SVG], { type: 'application/xml-external-parsed-entity' }),
      expected: 'svg-blob',
    },
    {
      caseName: 'image/svg+xml MIME',
      source: new Blob([MINIMAL_SVG], { type: 'image/svg+xml' }),
      expected: 'svg-blob',
    },
    { caseName: '.svg 파일명', source: new File([MINIMAL_SVG], 'icon.svg', { type: '' }), expected: 'svg-blob' },
  ])('$caseName SVG Blob을 $expected으로 최종 판정한다', async ({ source, expected }) => {
    await expect(detectSourceTypeAsync(source)).resolves.toBe(expected);
  });

  it('명시적 비-SVG 이미지 MIME은 SVG처럼 보이는 본문을 스니핑하지 않는다', async () => {
    await expect(detectSourceTypeAsync(new Blob([MINIMAL_SVG], { type: 'image/png' }))).resolves.toBe('blob');
  });
});

describe('convertStringToElement — 문자열 형태가 아니라 판정 결과로 분기한다', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  /** 지정한 판정 결과를 문자열 로더에 전달하는 호출 함수를 만든다. */
  async function loadStringConverterWithVerdict(verdict: string) {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('fetch는 호출되지 않아야 한다')));
    vi.stubGlobal('fetch', fetchSpy);
    const { convertStringToElement: loadString } = await import(STRING_LOADER_PATH);
    const convertStringToElement = (source: string) => loadString(source, verdict as never);
    return { convertStringToElement, fetchSpy };
  }

  it("판정이 'svg-url'이면 인라인 SVG 문자열도 원격 URL 경로로 보낸다", async () => {
    const { convertStringToElement, fetchSpy } = await loadStringConverterWithVerdict('svg-url');

    await expect(convertStringToElement(MINIMAL_SVG)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
      message: expect.stringContaining('Invalid URL format'),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("판정이 'svg-inline'이면 http URL 문자열도 SVG 본문으로 넘긴다", async () => {
    const { convertStringToElement, fetchSpy } = await loadStringConverterWithVerdict('svg-inline');

    // SVG 본문이 아니므로 공통 SVG 처리기가 거부한다 — fetch나 Data URL 복원으로 새지 않는다.
    await expect(convertStringToElement('https://example.com/icon.svg')).rejects.toMatchObject({
      code: 'SOURCE_LOAD_FAILED',
      message: expect.stringContaining('No <svg> element found'),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("판정이 'svg-datauri'면 http URL 문자열도 Data URL 복원 경로로 보낸다", async () => {
    const { convertStringToElement, fetchSpy } = await loadStringConverterWithVerdict('svg-datauri');

    await expect(convertStringToElement('https://example.com/icon.svg')).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
      message: 'Invalid SVG Data URL format',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("판정이 'svg-path'면 차단된 프로토콜을 fetch 전에 전파한다", async () => {
    const { convertStringToElement, fetchSpy } = await loadStringConverterWithVerdict('svg-path');

    await expect(convertStringToElement('javascript:alert(1)//x.svg')).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
      message: expect.stringContaining('Protocol not allowed: javascript:'),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('판정 union에 없는 값은 INVALID_SOURCE로 거부한다', async () => {
    const { convertStringToElement } = await loadStringConverterWithVerdict('arrayBuffer');

    await expect(convertStringToElement('whatever')).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
      message: expect.stringContaining('Cannot convert string source'),
    });
  });
});
