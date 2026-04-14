/**
 * SVG 보안 차단 경로를 검증하는 테스트다.
 */

import { describe, expect, it, vi } from 'vitest';
import { convertToImageElement } from '../../src/core/source-converter';
import { convertToElement } from '../../src/utils/converters';

/**
 * 스트리밍 응답 본문을 흉내 내는 최소 Reader 구현을 만든다.
 *
 * @param chunks 순서대로 반환할 텍스트 또는 바이트 청크
 * @param options 읽기 중 예외를 강제로 발생시킬 옵션
 * @returns Response.body 대역 객체
 */
function createStreamBody(chunks: Array<string | Uint8Array>, options?: { throwOnRead?: Error }) {
  const encoder = new TextEncoder();
  const normalizedChunks = chunks.map((chunk) => (typeof chunk === 'string' ? encoder.encode(chunk) : chunk));

  return {
    getReader() {
      let index = 0;

      return {
        async read() {
          if (options?.throwOnRead) {
            throw options.throwOnRead;
          }

          if (index >= normalizedChunks.length) {
            return { done: true, value: undefined };
          }

          const value = normalizedChunks[index];
          index += 1;
          return { done: false, value };
        },
        async cancel() {},
        releaseLock() {},
      };
    },
  };
}

describe('보안: SVG 위험 요소 차단', () => {
  it('스크립트 요소가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 script 요소를 제거하므로 convertToElement는 성공한다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('스크립트 요소가 제거된 SVG는 성공적으로 변환된다', async () => {
    // sanitize 계층이 script 요소를 제거하므로 INVALID_SOURCE 에러는 발생하지 않는다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

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
      await expect(convertToElement('https://example.com/asset?id=broken-svg')).rejects.toThrow(/svg/i);
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
      await expect(convertToElement('https://example.com/image.svg')).rejects.toThrow(/svg/i);
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
      await expect(convertToElement('https://example.com/broken.svg')).rejects.toThrow(/svg/i);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('style 속성의 외부 url() 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="fill:url(https://evil.example/pattern.svg#id)"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('style 태그의 외부 url() 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><style>rect{fill:url(https://evil.example/pattern.svg#id)}</style><rect width="10" height="10"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('상대 경로 참조가 포함된 SVG 문자열은 외부 리소스로 간주해 거부한다', async () => {
    const safeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="./assets/pattern.png" width="10" height="10"/></svg>';

    await expect(convertToElement(safeSvg)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('따옴표 없는 상대 경로 href가 포함된 SVG 문자열도 외부 리소스로 간주해 거부한다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href=./assets/pattern.png width="10" height="10"/></svg>';

    await expect(convertToElement(unsafeSvg)).rejects.toThrow(/svg/i);
  });

  it('protocol-relative href가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href=//evil.example/pattern.png width="10" height="10"/></svg>';

    const element = await convertToElement(unsafeSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('루트 절대 경로 참조가 포함된 SVG 문자열은 외부 리소스로 간주해 거부한다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="/assets/pattern.png" width="10" height="10"/></svg>';

    await expect(convertToElement(unsafeSvg)).rejects.toThrow(/svg/i);
  });

  it('javascript: URI href가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 javascript: href를 제거하므로 convertToElement는 성공한다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect width="10" height="10"/></a></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('onload 이벤트 속성이 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 onload 속성을 제거하므로 convertToElement는 성공한다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="10" height="10"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('대소문자가 섞인 onclick 이벤트 속성이 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 on* 속성을 대소문자 무관하게 제거한다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" oNcLiCk="alert(1)"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('대소문자가 섞인 외부 href 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 HTTPS:// href를 대소문자 무관하게 제거한다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="HTTPS://evil.example/tracker.png" width="10" height="10"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('대소문자가 섞인 javascript: URI href가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 javascript: href를 대소문자 무관하게 제거한다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="JaVaScRiPt:alert(1)"><rect width="10" height="10"/></a></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('엔티티로 인코딩된 javascript: URI href가 포함된 SVG 문자열도 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="jav&#x61;script:alert(1)"><rect width="10" height="10"/></a></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('style 속성 내 url()에 작은따옴표로 감싼 외부 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 style 속성의 외부 url() 참조를 제거하므로 convertToElement는 성공한다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="fill:url(\'https://evil.example/x.svg\')"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('style 속성 내 대문자 외부 url() 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 대소문자 무관하게 외부 url()을 제거하므로 convertToElement는 성공한다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="fill:url(HTTPS://evil.example/x.svg)"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('style 속성 내 javascript: url() 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 javascript: url()을 제거하므로 convertToElement는 성공한다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="fill:url(javascript:alert(1))"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('따옴표 없는 style 속성의 외부 url() 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style=fill:url(https://evil.example/x.svg#id)/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('protocol-relative style 속성의 외부 url() 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style=fill:url(//evil.example/x.svg#id)/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('텍스트 노드 안의 href= 문자열은 위험 속성으로 오인하지 않고 렌더링한다', async () => {
    const safeSvg = '<svg xmlns="http://www.w3.org/2000/svg"><text>x href=https://example.com y</text></svg>';

    const element = await convertToElement(safeSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('텍스트 노드 안의 style=url() 문자열은 위험 속성으로 오인하지 않고 렌더링한다', async () => {
    const safeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><text>x style=fill:url(https://example.com/pattern.svg#id) y</text></svg>';

    const element = await convertToElement(safeSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('속성값 안의 > 문자 뒤에 오는 외부 href도 sanitize 후 렌더링된다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image aria-label="1 > 0" href="https://evil.example/pattern.png" width="10" height="10"/></svg>';

    const element = await convertToElement(unsafeSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('속성값 안의 > 문자 뒤에 오는 외부 style url()도 sanitize 후 렌더링된다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect aria-label="1 > 0" style="fill:url(https://evil.example/x.svg#id)" width="10" height="10"/></svg>';

    const element = await convertToElement(unsafeSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('data: URI href가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 data: href를 제거하므로 convertToElement는 성공한다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+" width="10" height="10"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('MIME 타입이 비어 있는 SVG Blob도 본문을 스니핑해 sanitize 후 렌더링한다', async () => {
    const svgBlob = new Blob(
      ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>'],
      { type: '' }
    );

    const element = await convertToElement(svgBlob);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('SVG Data URL은 allowedProtocols에 data:가 없으면 거부한다', async () => {
    const dataSvg =
      'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%2210%22%20height%3D%2210%22%2F%3E%3C%2Fsvg%3E';

    await expect(
      convertToImageElement(dataSvg, {
        allowedProtocols: ['http:', 'https:'],
      })
    ).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('XML MIME 타입의 SVG Blob에 상대 경로 참조가 있으면 보안 게이트에서 차단한다', async () => {
    const svgBlob = new Blob(
      ['<svg xmlns="http://www.w3.org/2000/svg"><image href="./assets/pattern.png" width="10" height="10"/></svg>'],
      { type: 'application/xml' }
    );

    await expect(convertToElement(svgBlob)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  describe('대용량 SVG 입력 방어', () => {
    it('10MB를 초과하는 SVG 문자열은 변환 시 reject한다', async () => {
      // 10MB를 초과하는 SVG 문자열을 생성한다
      const svgString = `<svg xmlns="http://www.w3.org/2000/svg"><!-- ${'a'.repeat(10 * 1024 * 1024 + 1)} --><rect/></svg>`;
      await expect(convertToElement(svgString)).rejects.toThrow();
    });

    it('문자 수는 10MB 미만이어도 UTF-8 바이트 수가 10MB를 초과하는 SVG 문자열은 reject한다', async () => {
      const multiBytePayload = '가'.repeat(4 * 1024 * 1024);
      const svgString = `<svg xmlns="http://www.w3.org/2000/svg"><text>${multiBytePayload}</text></svg>`;

      expect(svgString.length).toBeLessThan(10 * 1024 * 1024);
      expect(new TextEncoder().encode(svgString).length).toBeGreaterThan(10 * 1024 * 1024);

      await expect(convertToElement(svgString)).rejects.toThrow(/10M|초과/);
    });

    it('10MB를 초과하는 Data URL SVG는 변환 시 reject한다', async () => {
      // URL 인코딩 방식으로 10MB를 초과하는 Data URL SVG를 생성한다
      const largeDataUrl =
        'data:image/svg+xml,' +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg"><!-- ${'a'.repeat(10 * 1024 * 1024 + 1)} --></svg>`
        );
      await expect(convertToElement(largeDataUrl)).rejects.toThrow();
    });

    it('URL 인코딩 길이가 길어도 디코딩 후 10MB 이하인 Data URL SVG는 허용한다', async () => {
      const repeatedMarkup = '<text x="1" y="1">%</text>'.repeat(250_000);
      const encodedSvg = `<svg xmlns="http://www.w3.org/2000/svg">${repeatedMarkup}</svg>`;
      const decodedLength = encodedSvg.length;
      const encodedLength = encodeURIComponent(encodedSvg).length;

      expect(decodedLength).toBeLessThan(10 * 1024 * 1024);
      expect(encodedLength).toBeGreaterThan(10 * 1024 * 1024);

      const dataUrl = `data:image/svg+xml,${encodeURIComponent(encodedSvg)}`;
      const element = await convertToElement(dataUrl);

      expect(element).toBeInstanceOf(HTMLImageElement);
    });

    it('10MB를 초과하는 base64 Data URL SVG는 디코딩 전에 reject한다', async () => {
      const atobSpy = vi.spyOn(globalThis, 'atob');
      const largeBase64Payload = 'A'.repeat(14 * 1024 * 1024);
      const largeDataUrl = `data:image/svg+xml;base64,${largeBase64Payload}`;

      try {
        await expect(convertToElement(largeDataUrl)).rejects.toThrow(/10M|초과/);
        expect(atobSpy).not.toHaveBeenCalled();
      } finally {
        atobSpy.mockRestore();
      }
    });
  });

  describe('대용량 원격 SVG 응답 방어', () => {
    it('응답 스트림이 없는 원격 SVG도 text() 결과가 10MB를 초과하면 크기 초과로 reject한다', async () => {
      const originalFetch = globalThis.fetch;
      const largeSvgText = `<svg xmlns="http://www.w3.org/2000/svg"><!-- ${'a'.repeat(10 * 1024 * 1024 + 1)} --><rect/></svg>`;
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get(name: string) {
            return name.toLowerCase() === 'content-type' ? 'image/svg+xml' : null;
          },
        },
        body: null,
        text: async () => largeSvgText,
      });

      globalThis.fetch = fetchMock as typeof fetch;

      try {
        await expect(convertToElement('https://example.com/text-only-large.svg')).rejects.toThrow(/10M|초과/);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('원격 XML MIME 응답의 Content-Length가 10MB를 초과하면 본문 읽기 전에 reject한다', async () => {
      const originalFetch = globalThis.fetch;
      const textSpy = vi.fn();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get(name: string) {
            const lowerName = name.toLowerCase();
            if (lowerName === 'content-type') {
              return 'text/xml';
            }
            if (lowerName === 'content-length') {
              return String(10 * 1024 * 1024 + 1);
            }
            return null;
          },
        },
        text: textSpy,
      });

      globalThis.fetch = fetchMock as typeof fetch;

      try {
        await expect(convertToElement('https://example.com/header-large.xml')).rejects.toThrow(/10M|초과/);
        expect(textSpy).not.toHaveBeenCalled();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('원격 SVG 응답의 Content-Length가 10MB를 초과하면 본문 읽기 전에 reject한다', async () => {
      const originalFetch = globalThis.fetch;
      const textSpy = vi.fn();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get(name: string) {
            const lowerName = name.toLowerCase();
            if (lowerName === 'content-type') {
              return 'image/svg+xml';
            }
            if (lowerName === 'content-length') {
              return String(10 * 1024 * 1024 + 1);
            }
            return null;
          },
        },
        text: textSpy,
      });

      globalThis.fetch = fetchMock as typeof fetch;

      try {
        await expect(convertToElement('https://example.com/header-large.svg')).rejects.toThrow(/10M|초과/);
        expect(textSpy).not.toHaveBeenCalled();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('원격 SVG 응답이 10MB를 초과하면 reject한다', async () => {
      const originalFetch = globalThis.fetch;
      // 10MB + 1바이트 크기의 응답 텍스트를 반환하는 mock fetch를 설정한다
      const largeSvgText = `<svg xmlns="http://www.w3.org/2000/svg"><!-- ${'a'.repeat(10 * 1024 * 1024 + 1)} --><rect/></svg>`;
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get(name: string) {
            return name.toLowerCase() === 'content-type' ? 'image/svg+xml' : null;
          },
        },
        body: createStreamBody([largeSvgText]),
      });

      globalThis.fetch = fetchMock as typeof fetch;

      try {
        await expect(convertToElement('https://example.com/large.svg')).rejects.toThrow(/10M|초과/);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('Content-Length가 없어도 스트리밍 중 10MB를 초과하는 원격 SVG는 즉시 차단한다', async () => {
      const originalFetch = globalThis.fetch;
      const textSpy = vi.fn().mockResolvedValue('unused fallback');
      const cancelSpy = vi.fn();
      const readSpy = vi.fn();
      const encoder = new TextEncoder();
      const chunks = [
        encoder.encode('<svg xmlns="http://www.w3.org/2000/svg"><!-- '),
        encoder.encode('a'.repeat(10 * 1024 * 1024 + 1)),
        encoder.encode(' --></svg>'),
      ];

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get(name: string) {
            return name.toLowerCase() === 'content-type' ? 'image/svg+xml' : null;
          },
        },
        body: {
          getReader() {
            let index = 0;
            return {
              async read() {
                readSpy();
                if (index >= chunks.length) {
                  return { done: true, value: undefined };
                }

                const value = chunks[index];
                index += 1;
                return { done: false, value };
              },
              async cancel() {
                cancelSpy();
              },
              releaseLock() {},
            };
          },
        },
        text: textSpy,
      });

      globalThis.fetch = fetchMock as typeof fetch;

      try {
        await expect(convertToElement('https://example.com/stream-large.svg')).rejects.toThrow(/10M|초과/);
        expect(textSpy).not.toHaveBeenCalled();
        expect(cancelSpy).toHaveBeenCalledTimes(1);
        expect(readSpy).toHaveBeenCalledTimes(2);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
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
      await expect(convertToElement('https://example.com/broken.xml')).rejects.toThrow(/xml|svg|차단/i);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(textSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
