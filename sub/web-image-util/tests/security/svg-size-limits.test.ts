/**
 * SVG 입력 크기 제한 방어를 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToElement } from '../../src/utils/converters';
import { SVG_LIMIT_BYTES, createStreamBody } from './helpers/svg-test-helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('보안: SVG 크기 제한', () => {
  describe('대용량 SVG 입력 방어', () => {
    it('10MB를 초과하는 SVG 문자열은 변환 시 reject한다', async () => {
      // 10MB를 초과하는 SVG 문자열을 생성한다
      const svgString = `<svg xmlns="http://www.w3.org/2000/svg"><!-- ${'a'.repeat(SVG_LIMIT_BYTES + 1)} --><rect/></svg>`;
      await expect(convertToElement(svgString)).rejects.toMatchObject({
        code: 'SVG_BYTES_EXCEEDED',
        details: {
          actualBytes: expect.any(Number),
          maxBytes: SVG_LIMIT_BYTES,
        },
      });
    });

    it('문자 수는 10MB 미만이어도 UTF-8 바이트 수가 10MB를 초과하는 SVG 문자열은 reject한다', async () => {
      const multiBytePayload = '가'.repeat(4 * 1024 * 1024);
      const svgString = `<svg xmlns="http://www.w3.org/2000/svg"><text>${multiBytePayload}</text></svg>`;

      expect(svgString.length).toBeLessThan(SVG_LIMIT_BYTES);
      expect(new TextEncoder().encode(svgString).length).toBeGreaterThan(SVG_LIMIT_BYTES);

      await expect(convertToElement(svgString)).rejects.toMatchObject({
        code: 'SVG_BYTES_EXCEEDED',
        details: {
          actualBytes: expect.any(Number),
          maxBytes: SVG_LIMIT_BYTES,
        },
      });
    });

    it('10MB를 초과하는 Data URL SVG는 변환 시 reject한다', async () => {
      // URL 인코딩 방식으로 10MB를 초과하는 Data URL SVG를 생성한다
      const largeDataUrl =
        'data:image/svg+xml,' +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg"><!-- ${'a'.repeat(10 * 1024 * 1024 + 1)} --></svg>`
        );
      await expect(convertToElement(largeDataUrl)).rejects.toMatchObject({
        code: 'SVG_BYTES_EXCEEDED',
        details: {
          actualBytes: expect.any(Number),
          maxBytes: SVG_LIMIT_BYTES,
        },
      });
    });

    it('URL 인코딩 길이가 길어도 디코딩 후 10MB 이하인 Data URL SVG는 허용한다', async () => {
      const repeatedMarkup = '<text x="1" y="1">%</text>'.repeat(250_000);
      const encodedSvg = `<svg xmlns="http://www.w3.org/2000/svg">${repeatedMarkup}</svg>`;
      const decodedLength = encodedSvg.length;
      const encodedLength = encodeURIComponent(encodedSvg).length;

      expect(decodedLength).toBeLessThan(SVG_LIMIT_BYTES);
      expect(encodedLength).toBeGreaterThan(SVG_LIMIT_BYTES);

      const dataUrl = `data:image/svg+xml,${encodeURIComponent(encodedSvg)}`;
      const element = await convertToElement(dataUrl);

      expect(element).toBeInstanceOf(HTMLImageElement);
    });

    it('10MB를 초과하는 base64 Data URL SVG는 디코딩 전에 reject한다', async () => {
      const atobSpy = vi.spyOn(globalThis, 'atob');
      const largeBase64Payload = 'A'.repeat(14 * 1024 * 1024);
      const largeDataUrl = `data:image/svg+xml;base64,${largeBase64Payload}`;

      try {
        await expect(convertToElement(largeDataUrl)).rejects.toMatchObject({
          code: 'SVG_BYTES_EXCEEDED',
          details: {
            actualBytes: expect.any(Number),
            maxBytes: SVG_LIMIT_BYTES,
          },
        });
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
        await expect(convertToElement('https://example.com/text-only-large.svg')).rejects.toMatchObject({
          code: 'SVG_BYTES_EXCEEDED',
          details: {
            actualBytes: expect.any(Number),
            maxBytes: SVG_LIMIT_BYTES,
          },
        });
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
        await expect(convertToElement('https://example.com/header-large.xml')).rejects.toMatchObject({
          code: 'SVG_BYTES_EXCEEDED',
          details: {
            actualBytes: expect.any(Number),
            maxBytes: SVG_LIMIT_BYTES,
          },
        });
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
        await expect(convertToElement('https://example.com/header-large.svg')).rejects.toMatchObject({
          code: 'SVG_BYTES_EXCEEDED',
          details: {
            actualBytes: expect.any(Number),
            maxBytes: SVG_LIMIT_BYTES,
          },
        });
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
        await expect(convertToElement('https://example.com/large.svg')).rejects.toMatchObject({
          code: 'SVG_BYTES_EXCEEDED',
          details: {
            actualBytes: expect.any(Number),
            maxBytes: SVG_LIMIT_BYTES,
          },
        });
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
        await expect(convertToElement('https://example.com/stream-large.svg')).rejects.toMatchObject({
          code: 'SVG_BYTES_EXCEEDED',
          details: {
            actualBytes: expect.any(Number),
            maxBytes: SVG_LIMIT_BYTES,
          },
        });
        expect(textSpy).not.toHaveBeenCalled();
        expect(cancelSpy).toHaveBeenCalledTimes(1);
        expect(readSpy).toHaveBeenCalledTimes(2);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
