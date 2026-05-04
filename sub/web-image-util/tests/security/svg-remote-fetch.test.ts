/**
 * 원격 URL fetch 경로에 대한 SVG 보안 처리를 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToElement } from '../../src/utils/converters';
import { createStreamBody } from './helpers/svg-test-helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('보안: 원격 SVG fetch 처리', () => {
  it('외부 리소스를 참조하는 원격 SVG는 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 외부 href 속성을 제거하므로 convertToElement는 성공한다
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'image/svg+xml' : null;
        },
      },
      body: createStreamBody([
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/tracker.png" width="10" height="10"/></svg>',
      ]),
    });

    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const element = await convertToElement('https://example.com/unsafe.svg');
      expect(element).toBeInstanceOf(HTMLImageElement);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('확장자가 없는 URL이라도 image/svg+xml 응답의 외부 href는 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 외부 href 속성을 제거하므로 convertToElement는 성공한다
    const originalFetch = globalThis.fetch;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'image/svg+xml' : null;
        },
      },
      body: createStreamBody([
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/tracker.png" width="10" height="10"/></svg>',
      ]),
    });

    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const element = await convertToElement('https://example.com/asset?id=unsafe');
      expect(element).toBeInstanceOf(HTMLImageElement);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      globalThis.fetch = originalFetch;
    }
  });

  it('확장자가 없는 URL이라도 image/svg+xml 응답 본문을 읽지 못하면 차단한다', async () => {
    const originalFetch = globalThis.fetch;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'image/svg+xml' : null;
        },
      },
      body: createStreamBody([], { throwOnRead: new Error('body decode failed') }),
    });

    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(convertToElement('https://example.com/asset?id=broken-svg')).rejects.toMatchObject({
        code: 'INVALID_SOURCE',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      globalThis.fetch = originalFetch;
    }
  });

  it('응답 스트림이 없어도 text()로 안전하게 읽을 수 있는 image/svg+xml 응답은 허용한다', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'image/svg+xml' : null;
        },
      },
      body: null,
      text: async () => '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>',
    });

    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const element = await convertToElement('https://example.com/text-only-svg');
      expect(element).toBeInstanceOf(HTMLImageElement);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('fetch 실패한 비-SVG URL(.png)은 직접 로드로 허용된다', async () => {
    const originalFetch = globalThis.fetch;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn().mockRejectedValue(new Error('cors blocked'));
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const element = await convertToElement('https://example.com/image.png');
      expect(element).toBeInstanceOf(HTMLImageElement);
      expect(element.src).toBe('https://example.com/image.png');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
      globalThis.fetch = originalFetch;
    }
  });

  it('fetch 실패한 .svg URL은 차단한다', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockRejectedValue(new Error('cors blocked'));
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(convertToElement('https://example.com/image.svg')).rejects.toMatchObject({
        code: 'INVALID_SOURCE',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('fetch 실패한 .svg 쿼리 URL도 차단한다', async () => {
    const originalFetch = globalThis.fetch;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn().mockRejectedValue(new Error('cors blocked'));
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(convertToElement('https://example.com/image.svg?download=1')).rejects.toMatchObject({
        code: 'INVALID_SOURCE',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      globalThis.fetch = originalFetch;
    }
  });

  it('.svg URL 응답 본문을 읽지 못하면 fail-closed로 차단한다', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'image/svg+xml' : null;
        },
      },
      body: createStreamBody([], { throwOnRead: new Error('stream broken') }),
    });

    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(convertToElement('https://example.com/broken.svg')).rejects.toMatchObject({
        code: 'INVALID_SOURCE',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('Fabric.js 형태의 data:image/svg+xml xlink:href 원격 SVG를 정제 후 보존한다', async () => {
    const originalFetch = globalThis.fetch;
    const nestedSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="81" height="114"/></svg>';
    const nestedDataUrl = `data:image/svg+xml;base64,${btoa(nestedSvg)}`;
    const remoteSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="81px" height="114px" viewBox="0 0 81 114">
        <g transform="matrix(-1 0 0 1 40.5 57)">
          <image xlink:href="${nestedDataUrl}" x="-40.5" y="-57" width="81" height="114"/>
        </g>
      </svg>
    `;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'image/svg+xml' : null;
        },
      },
      body: createStreamBody([remoteSvg]),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const element = await convertToElement('https://example.com/fabric.svg');
      expect(element).toBeInstanceOf(HTMLImageElement);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('XML MIME 응답에서 SVG가 아닌 콘텐츠는 일반 이미지로 폴백한다', async () => {
    const originalFetch = globalThis.fetch;
    const textSpy = vi.fn().mockResolvedValue('unused fallback');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'text/xml' : null;
        },
      },
      body: createStreamBody(['<root><item>not an svg</item></root>']),
      text: textSpy,
    });

    globalThis.fetch = fetchMock as typeof fetch;

    try {
      // text/xml 응답이지만 SVG가 아닌 경우 HTMLImageElement로 폴백한다 (정책 명시)
      const element = await convertToElement('https://example.com/data.xml');
      expect(element).toBeInstanceOf(HTMLImageElement);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(textSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('단일 소비 스트림인 XML MIME 응답도 SVG가 아니면 일반 이미지 로딩으로 폴백한다', async () => {
    const originalFetch = globalThis.fetch;
    let bodyConsumed = false;
    let readerRequests = 0;
    const textSpy = vi.fn().mockResolvedValue('unused fallback');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'text/xml' : null;
        },
      },
      body: {
        getReader() {
          readerRequests += 1;
          if (bodyConsumed) {
            throw new Error('body stream already consumed');
          }

          bodyConsumed = true;
          let done = false;

          return {
            async read() {
              if (done) {
                return { done: true, value: undefined };
              }

              done = true;
              return {
                done: false,
                value: new TextEncoder().encode('<root><item>not an svg</item></root>'),
              };
            },
            async cancel() {},
            releaseLock() {},
          };
        },
      },
      text: textSpy,
    });

    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const element = await convertToElement('https://example.com/single-use-data.xml');
      expect(element).toBeInstanceOf(HTMLImageElement);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(textSpy).not.toHaveBeenCalled();
      expect(readerRequests).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('XML MIME 응답 본문을 읽지 못하면 fail-closed로 차단한다', async () => {
    const originalFetch = globalThis.fetch;
    const textSpy = vi.fn().mockResolvedValue('unused fallback');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'text/xml' : null;
        },
      },
      body: createStreamBody([], { throwOnRead: new Error('xml stream broken') }),
      text: textSpy,
    });

    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(convertToElement('https://example.com/broken.xml')).rejects.toMatchObject({
        code: 'INVALID_SOURCE',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(textSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
