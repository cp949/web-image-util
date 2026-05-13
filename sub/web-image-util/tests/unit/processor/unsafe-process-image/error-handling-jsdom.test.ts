/**
 * unsafe_processImage 에러 처리 중 jsdom에서 안전하게 도는 케이스만 모은다.
 * Uint8Array SVG 입력 케이스는 production이 내부적으로 Image 로드 경로까지 진입하다가
 * jsdom에서 SOURCE_LOAD_FAILED를 먼저 던져 SVG_BYTES_EXCEEDED 단정이 깨지므로
 * `error-handling.test.ts`(happy-dom)에 남겨둔다.
 */

import { describe, expect, it, vi } from 'vitest';

function createOversizedSvg(): string {
  const oversizedPadding = '가'.repeat(5_300_000);
  return `<svg xmlns="http://www.w3.org/2000/svg"><text>${oversizedPadding}</text></svg>`;
}

describe('unsafe_processImage — 에러 처리 (jsdom-safe)', () => {
  it('unsafe 경로에서도 oversized SVG 입력은 크기 제한으로 차단한다', async () => {
    const { processImage, unsafe_processImage } = await import('../../../../src');
    const oversizedSvg = createOversizedSvg();

    await expect((processImage(oversizedSvg) as any).toElement()).rejects.toMatchObject({
      code: 'OUTPUT_FAILED',
      cause: expect.objectContaining({
        code: 'SVG_BYTES_EXCEEDED',
      }),
    });
    await expect((unsafe_processImage(oversizedSvg) as any).toElement()).rejects.toMatchObject({
      code: 'OUTPUT_FAILED',
      cause: expect.objectContaining({
        code: 'SVG_BYTES_EXCEEDED',
      }),
    });
  });

  it('processImage의 svgSanitizer skip은 oversized SVG를 차단한다', async () => {
    const { processImage } = await import('../../../../src');
    const oversized = createOversizedSvg();

    await expect((processImage(oversized, { svgSanitizer: 'skip' }) as any).toElement()).rejects.toMatchObject({
      code: 'OUTPUT_FAILED',
      cause: expect.objectContaining({
        code: 'SVG_BYTES_EXCEEDED',
      }),
    });
  });

  it('잘못된 svgSanitizer 런타임 값은 원본 SVG를 통과시키지 않고 차단한다', async () => {
    const { processImage } = await import('../../../../src');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';

    await expect((processImage(svg, { svgSanitizer: 'safe' } as any) as any).toElement()).rejects.toMatchObject({
      code: 'OUTPUT_FAILED',
      cause: expect.objectContaining({
        code: 'INVALID_SOURCE',
      }),
    });
  });

  it('processImage의 svgSanitizer skip도 SVG URL fetch 실패는 직접 로딩으로 우회하지 않고 차단한다', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockRejectedValue(new Error('network blocked'));
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const { processImage } = await import('../../../../src');

      await expect(
        (processImage('https://example.com/icon.svg', { svgSanitizer: 'skip' }) as any).toElement()
      ).rejects.toMatchObject({
        code: 'OUTPUT_FAILED',
        cause: expect.objectContaining({
          code: 'INVALID_SOURCE',
        }),
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('processImage의 svgSanitizer skip도 Blob URL fetch 실패는 일반 이미지 경로로 우회하지 않고 차단한다', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockRejectedValue(new Error('blob unavailable'));
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL');
    createObjectUrlSpy.mockClear();
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const { processImage } = await import('../../../../src');

      await expect(
        (processImage('blob:https://example.com/icon', { svgSanitizer: 'skip' }) as any).toElement()
      ).rejects.toMatchObject({
        code: 'OUTPUT_FAILED',
        cause: expect.objectContaining({
          code: 'SOURCE_LOAD_FAILED',
        }),
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(createObjectUrlSpy).not.toHaveBeenCalled();
    } finally {
      createObjectUrlSpy.mockRestore();
      globalThis.fetch = originalFetch;
    }
  });
});
