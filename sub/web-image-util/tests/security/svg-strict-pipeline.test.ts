/**
 * processImage의 svgSanitizer: 'strict' 옵션이 모든 입력 형태에 대해
 * strict sanitizer를 올바르게 호출하는지 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestImageBlob } from '../utils/image-helper';
import { createStreamBody } from './helpers/svg-test-helpers';

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock('../../src/svg-sanitizer');
  vi.resetModules();
});

async function importProcessorWithStrictSpy() {
  vi.resetModules();

  const sanitizeSvgStrict = vi.fn((svg: string) =>
    svg.replace(/<script\b[\s\S]*?<\/script\s*>/gi, '').replace(/\s+on[a-z0-9:-]+\s*=\s*"[^"]*"/gi, '')
  );

  vi.doMock('../../src/svg-sanitizer', async () => {
    const actual = await vi.importActual<typeof import('../../src/svg-sanitizer')>('../../src/svg-sanitizer');
    return { ...actual, sanitizeSvgStrict };
  });

  const mod = await import('../../src');
  return { processImage: mod.processImage, sanitizeSvgStrict };
}

describe('svgSanitizer strict 옵션 - 입력 형태별 검증', () => {
  it('svgSanitizer strict는 inline SVG 문자열에 strict sanitizer를 적용한다', async () => {
    const { processImage, sanitizeSvgStrict } = await importProcessorWithStrictSpy();
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect width="10" height="10"/></svg>';

    await expect((processImage(svg, { svgSanitizer: 'strict' }) as any).toElement()).resolves.toBeInstanceOf(
      HTMLImageElement
    );

    expect(sanitizeSvgStrict).toHaveBeenCalledTimes(1);
  });

  it('svgSanitizer strict는 strict sanitizer가 반환한 SVG를 후속 로딩에 사용한다', async () => {
    vi.resetModules();

    const previousSvgMockMode = (globalThis as any)._SVG_MOCK_MODE;
    const sanitizedSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect id="sanitized-result" width="10" height="10"/></svg>';
    const sanitizeSvgStrict = vi.fn(() => sanitizedSvg);
    const enhanceSvgForBrowser = vi.fn((svg: string) => svg);

    vi.doMock('../../src/svg-sanitizer', async () => {
      const actual = await vi.importActual<typeof import('../../src/svg-sanitizer')>('../../src/svg-sanitizer');
      return { ...actual, sanitizeSvgStrict };
    });
    vi.doMock('../../src/utils/svg-compatibility', async () => {
      const actual = await vi.importActual<typeof import('../../src/utils/svg-compatibility')>(
        '../../src/utils/svg-compatibility'
      );
      return { ...actual, enhanceSvgForBrowser };
    });

    try {
      // _SVG_MOCK_MODE = true이면 convertSvgToElement가 즉시 PNG stub을 반환해 enhanceSvgForBrowser를 건너뛴다.
      // false로 설정해 전체 SVG 처리 경로를 실행시켜야 enhanceSvgForBrowser mock 호출을 검증할 수 있다.
      (globalThis as any)._SVG_MOCK_MODE = false;
      const { processImage } = await import('../../src');
      const originalSvg =
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect id="original" width="10" height="10"/></svg>';

      await expect((processImage(originalSvg, { svgSanitizer: 'strict' }) as any).toElement()).resolves.toBeInstanceOf(
        HTMLImageElement
      );

      expect(sanitizeSvgStrict).toHaveBeenCalledTimes(1);
      expect(enhanceSvgForBrowser).toHaveBeenCalledWith(sanitizedSvg);
      expect(enhanceSvgForBrowser.mock.calls[0]?.[0]).not.toContain('id="original"');
    } finally {
      (globalThis as any)._SVG_MOCK_MODE = previousSvgMockMode;
      vi.doUnmock('../../src/utils/svg-compatibility');
    }
  });

  it('svgSanitizer strict는 SVG Data URL을 디코딩한 뒤 strict sanitizer를 적용한다', async () => {
    const { processImage, sanitizeSvgStrict } = await importProcessorWithStrictSpy();
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect width="10" height="10"/></svg>';
    const dataUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;

    await expect((processImage(dataUrl, { svgSanitizer: 'strict' }) as any).toElement()).resolves.toBeInstanceOf(
      HTMLImageElement
    );

    expect(sanitizeSvgStrict).toHaveBeenCalledTimes(1);
    expect(sanitizeSvgStrict.mock.calls[0]?.[0]).toContain('<svg');
  });

  it('svgSanitizer strict는 .svg 원격 URL 응답에 strict sanitizer를 적용한다', async () => {
    const originalFetch = globalThis.fetch;
    const { processImage, sanitizeSvgStrict } = await importProcessorWithStrictSpy();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'image/svg+xml' : null;
        },
      },
      body: createStreamBody([
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect width="10" height="10"/></svg>',
      ]),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(
        (processImage('https://example.com/icon.svg', { svgSanitizer: 'strict' }) as any).toElement()
      ).resolves.toBeInstanceOf(HTMLImageElement);
      expect(sanitizeSvgStrict).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('svgSanitizer strict는 image/svg+xml 원격 응답에 strict sanitizer를 적용한다', async () => {
    const originalFetch = globalThis.fetch;
    const { processImage, sanitizeSvgStrict } = await importProcessorWithStrictSpy();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'image/svg+xml' : null;
        },
      },
      body: createStreamBody([
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect width="10" height="10"/></svg>',
      ]),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(
        (processImage('https://example.com/asset?id=svg', { svgSanitizer: 'strict' }) as any).toElement()
      ).resolves.toBeInstanceOf(HTMLImageElement);
      expect(sanitizeSvgStrict).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('svgSanitizer strict는 XML MIME 응답이 실제 SVG이면 strict sanitizer를 적용한다', async () => {
    const originalFetch = globalThis.fetch;
    const { processImage, sanitizeSvgStrict } = await importProcessorWithStrictSpy();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'application/xml' : null;
        },
      },
      body: createStreamBody([
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect width="10" height="10"/></svg>',
      ]),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(
        (processImage('https://example.com/vector.xml', { svgSanitizer: 'strict' }) as any).toElement()
      ).resolves.toBeInstanceOf(HTMLImageElement);
      expect(sanitizeSvgStrict).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('svgSanitizer strict는 SVG Blob에 strict sanitizer를 적용한다', async () => {
    const { processImage, sanitizeSvgStrict } = await importProcessorWithStrictSpy();
    const blob = new Blob(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect width="10" height="10"/></svg>',
      ],
      { type: 'image/svg+xml' }
    );

    await expect((processImage(blob, { svgSanitizer: 'strict' }) as any).toElement()).resolves.toBeInstanceOf(
      HTMLImageElement
    );

    expect(sanitizeSvgStrict).toHaveBeenCalledTimes(1);
  });

  it('svgSanitizer strict는 .svg File 입력에 strict sanitizer를 적용한다', async () => {
    const { processImage, sanitizeSvgStrict } = await importProcessorWithStrictSpy();
    const file = new File(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect width="10" height="10"/></svg>',
      ],
      'unsafe.svg',
      { type: '' }
    );

    await expect((processImage(file, { svgSanitizer: 'strict' }) as any).toElement()).resolves.toBeInstanceOf(
      HTMLImageElement
    );

    expect(sanitizeSvgStrict).toHaveBeenCalledTimes(1);
  });

  it('svgSanitizer strict는 Blob URL이 SVG로 확인되면 strict sanitizer를 적용한다', async () => {
    const originalFetch = globalThis.fetch;
    const { processImage, sanitizeSvgStrict } = await importProcessorWithStrictSpy();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'image/svg+xml' : null;
        },
      },
      body: createStreamBody([
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect width="10" height="10"/></svg>',
      ]),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(
        (processImage('blob:https://example.com/id', { svgSanitizer: 'strict' }) as any).toElement()
      ).resolves.toBeInstanceOf(HTMLImageElement);
      expect(sanitizeSvgStrict).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('svgSanitizer strict는 ArrayBuffer SVG 입력에도 strict sanitizer를 적용한다', async () => {
    const { processImage, sanitizeSvgStrict } = await importProcessorWithStrictSpy();
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect width="10" height="10"/></svg>';
    const buffer = new TextEncoder().encode(svg).buffer as ArrayBuffer;

    await expect((processImage(buffer, { svgSanitizer: 'strict' }) as any).toElement()).resolves.toBeInstanceOf(
      HTMLImageElement
    );

    expect(sanitizeSvgStrict).toHaveBeenCalledTimes(1);
  });

  it('svgSanitizer strict는 Uint8Array SVG 입력에도 strict sanitizer를 적용한다', async () => {
    const { processImage, sanitizeSvgStrict } = await importProcessorWithStrictSpy();
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect width="10" height="10"/></svg>';
    const bytes = new TextEncoder().encode(svg);

    await expect((processImage(bytes, { svgSanitizer: 'strict' }) as any).toElement()).resolves.toBeInstanceOf(
      HTMLImageElement
    );

    expect(sanitizeSvgStrict).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['PNG Blob', async () => createTestImageBlob(10, 10, 'red')],
    // PNG magic bytes만 포함한 stub이다. 테스트 환경 Image mock은 src를 실제 디코딩하지 않으므로
    // 유효하지 않은 base64여도 HTMLImageElement 로딩이 성공한다.
    // MIME prefix(data:image/png)로 비-SVG를 판정하는 경로를 검증하는 게 목적이다.
    ['PNG Data URL', async () => 'data:image/png;base64,iVBORw0KGgo='],
  ])('svgSanitizer strict는 비-SVG %s에는 strict sanitizer를 호출하지 않는다', async (_label, createSource) => {
    const { processImage, sanitizeSvgStrict } = await importProcessorWithStrictSpy();
    const source = await createSource();

    await expect((processImage(source, { svgSanitizer: 'strict' }) as any).toElement()).resolves.toBeInstanceOf(
      HTMLImageElement
    );

    expect(sanitizeSvgStrict).not.toHaveBeenCalled();
  });
});
