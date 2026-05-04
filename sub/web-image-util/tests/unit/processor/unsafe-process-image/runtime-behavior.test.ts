import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestImageBlob } from '../../../utils/image-helper';

function createSvgArrayBuffer(svg: string): ArrayBuffer {
  return new TextEncoder().encode(svg).buffer as ArrayBuffer;
}

describe('unsafe_processImage — 런타임 동작', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('../../../../src/svg-sanitizer');
    vi.doUnmock('../../../../src/utils/svg-sanitizer');
    vi.doUnmock('../../../../src/utils/svg-compatibility');
  });

  it('비-SVG Blob 입력은 processImage와 동일하게 처리한다', async () => {
    const { processImage, unsafe_processImage } = await import('../../../../src');
    const blob = await createTestImageBlob(20, 20, 'red');

    const safe = await processImage(blob).resize({ fit: 'cover', width: 10, height: 10 }).toBlob();
    const unsafe = await unsafe_processImage(blob).resize({ fit: 'cover', width: 10, height: 10 }).toBlob();

    expect(unsafe.width).toBe(safe.width);
    expect(unsafe.height).toBe(safe.height);
    expect(unsafe.format).toBe(safe.format);
    expect(unsafe.blob.size).toBeGreaterThan(0);
  });

  it('ArrayBuffer SVG 입력은 safe 경로에서 차단되고 unsafe 경로는 sanitize만 우회한다', async () => {
    const sanitizeSvgForRenderingSpy = vi.fn((svg: string) => svg);
    const enhanceSvgForBrowser = vi.fn((svg: string) => svg);

    vi.doMock('../../../../src/utils/svg-sanitizer', async () => {
      const actual = await vi.importActual<typeof import('../../../../src/utils/svg-sanitizer')>(
        '../../../../src/utils/svg-sanitizer'
      );
      return {
        ...actual,
        sanitizeSvg: sanitizeSvgForRenderingSpy,
        sanitizeSvgForRendering: sanitizeSvgForRenderingSpy,
      };
    });

    vi.doMock('../../../../src/utils/svg-compatibility', async () => {
      const actual = await vi.importActual<typeof import('../../../../src/utils/svg-compatibility')>(
        '../../../../src/utils/svg-compatibility'
      );
      return { ...actual, enhanceSvgForBrowser };
    });

    const { processImage, unsafe_processImage } = await import('../../../../src');
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="./assets/pattern.png" width="10" height="10"/></svg>';
    const buffer = createSvgArrayBuffer(svg);

    await expect((processImage(buffer) as any).toElement()).rejects.toMatchObject({
      code: 'OUTPUT_FAILED',
      cause: expect.objectContaining({
        code: 'INVALID_SOURCE',
      }),
    });
    expect(sanitizeSvgForRenderingSpy).toHaveBeenCalledTimes(1);
    expect(enhanceSvgForBrowser).not.toHaveBeenCalled();

    sanitizeSvgForRenderingSpy.mockClear();
    enhanceSvgForBrowser.mockClear();

    await expect((unsafe_processImage(buffer) as any).toElement()).resolves.toBeInstanceOf(HTMLImageElement);
    expect(sanitizeSvgForRenderingSpy).not.toHaveBeenCalled();
    expect(enhanceSvgForBrowser).not.toHaveBeenCalled();
  });

  it('safe 경로는 sanitize와 compatibility 보정을 수행하고 unsafe 경로는 건너뛴다', async () => {
    const previousSvgMockMode = (globalThis as any)._SVG_MOCK_MODE;
    try {
      (globalThis as any)._SVG_MOCK_MODE = false;

      const sanitizeSvgForRenderingSpy = vi.fn((svg: string) => svg);
      const enhanceSvgForBrowser = vi.fn((svg: string) => svg);

      vi.doMock('../../../../src/utils/svg-sanitizer', async () => {
        const actual = await vi.importActual<typeof import('../../../../src/utils/svg-sanitizer')>(
          '../../../../src/utils/svg-sanitizer'
        );
        return {
          ...actual,
          sanitizeSvg: sanitizeSvgForRenderingSpy,
          sanitizeSvgForRendering: sanitizeSvgForRenderingSpy,
        };
      });

      vi.doMock('../../../../src/utils/svg-compatibility', async () => {
        const actual = await vi.importActual<typeof import('../../../../src/utils/svg-compatibility')>(
          '../../../../src/utils/svg-compatibility'
        );
        return { ...actual, enhanceSvgForBrowser };
      });

      const { processImage, unsafe_processImage } = await import('../../../../src');
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';

      await (processImage(svg).resize({ fit: 'cover', width: 10, height: 10 }) as any).toElement();
      expect(sanitizeSvgForRenderingSpy).toHaveBeenCalled();
      expect(enhanceSvgForBrowser).toHaveBeenCalled();

      sanitizeSvgForRenderingSpy.mockClear();
      enhanceSvgForBrowser.mockClear();

      await (unsafe_processImage(svg).resize({ fit: 'cover', width: 10, height: 10 }) as any).toElement();
      expect(sanitizeSvgForRenderingSpy).not.toHaveBeenCalled();
      expect(enhanceSvgForBrowser).not.toHaveBeenCalled();
    } finally {
      (globalThis as any)._SVG_MOCK_MODE = previousSvgMockMode;
    }
  });

  it('safe 경로만 상대 경로 참조 SVG를 차단하고 unsafe 경로는 해당 검사 단계를 건너뛴다', async () => {
    const svgWithRelativeHref =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="./assets/pattern.png" width="10" height="10"/></svg>';
    const sanitizeSvgForRenderingSpy = vi.fn((svg: string) => svg);

    vi.doMock('../../../../src/utils/svg-sanitizer', async () => {
      const actual = await vi.importActual<typeof import('../../../../src/utils/svg-sanitizer')>(
        '../../../../src/utils/svg-sanitizer'
      );
      return {
        ...actual,
        sanitizeSvg: sanitizeSvgForRenderingSpy,
        sanitizeSvgForRendering: sanitizeSvgForRenderingSpy,
      };
    });

    const { processImage, unsafe_processImage } = await import('../../../../src');

    await expect((processImage(svgWithRelativeHref) as any).toElement()).rejects.toMatchObject({
      code: 'OUTPUT_FAILED',
      cause: expect.objectContaining({
        code: 'INVALID_SOURCE',
      }),
    });
    expect(sanitizeSvgForRenderingSpy).toHaveBeenCalledTimes(1);

    sanitizeSvgForRenderingSpy.mockClear();

    await expect((unsafe_processImage(svgWithRelativeHref) as any).toElement()).resolves.toBeInstanceOf(
      HTMLImageElement
    );
    expect(sanitizeSvgForRenderingSpy).not.toHaveBeenCalled();
  });

  it('SVG Blob 입력에서도 safe 경로만 보안 게이트에 걸리고 unsafe 경로는 passthrough 모드를 유지한다', async () => {
    const svgWithRelativeHref =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="./assets/pattern.png" width="10" height="10"/></svg>';
    const svgBlob = new Blob([svgWithRelativeHref], { type: 'image/svg+xml' });
    const sanitizeSvgForRenderingSpy = vi.fn((svg: string) => svg);

    vi.doMock('../../../../src/utils/svg-sanitizer', async () => {
      const actual = await vi.importActual<typeof import('../../../../src/utils/svg-sanitizer')>(
        '../../../../src/utils/svg-sanitizer'
      );
      return {
        ...actual,
        sanitizeSvg: sanitizeSvgForRenderingSpy,
        sanitizeSvgForRendering: sanitizeSvgForRenderingSpy,
      };
    });

    const { processImage, unsafe_processImage } = await import('../../../../src');

    await expect((processImage(svgBlob) as any).toElement()).rejects.toMatchObject({
      code: 'OUTPUT_FAILED',
      cause: expect.objectContaining({
        code: 'INVALID_SOURCE',
      }),
    });
    expect(sanitizeSvgForRenderingSpy).toHaveBeenCalledTimes(1);

    sanitizeSvgForRenderingSpy.mockClear();

    await expect((unsafe_processImage(svgBlob) as any).toElement()).resolves.toBeInstanceOf(HTMLImageElement);
    expect(sanitizeSvgForRenderingSpy).not.toHaveBeenCalled();
  });

  it('processImage의 svgSanitizer skip은 sanitizer만 건너뛰고 compatibility 보정은 유지한다', async () => {
    const previousSvgMockMode = (globalThis as any)._SVG_MOCK_MODE;
    try {
      (globalThis as any)._SVG_MOCK_MODE = false;

      const svgWithRelativeHref =
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="./assets/pattern.png" width="10" height="10"/></svg>';
      const sanitizeSvgForRenderingSpy = vi.fn((svg: string) => svg);
      const enhanceSvgForBrowserSpy = vi.fn((svg: string) => svg);

      vi.doMock('../../../../src/utils/svg-sanitizer', async () => {
        const actual = await vi.importActual<typeof import('../../../../src/utils/svg-sanitizer')>(
          '../../../../src/utils/svg-sanitizer'
        );
        return { ...actual, sanitizeSvgForRendering: sanitizeSvgForRenderingSpy };
      });
      vi.doMock('../../../../src/utils/svg-compatibility', async () => {
        const actual = await vi.importActual<typeof import('../../../../src/utils/svg-compatibility')>(
          '../../../../src/utils/svg-compatibility'
        );
        return { ...actual, enhanceSvgForBrowser: enhanceSvgForBrowserSpy };
      });

      const { processImage } = await import('../../../../src');

      await expect(
        (processImage(svgWithRelativeHref, { svgSanitizer: 'skip' }) as any).toElement()
      ).resolves.toBeInstanceOf(HTMLImageElement);
      expect(sanitizeSvgForRenderingSpy).not.toHaveBeenCalled();
      expect(enhanceSvgForBrowserSpy).toHaveBeenCalled();
    } finally {
      (globalThis as any)._SVG_MOCK_MODE = previousSvgMockMode;
    }
  });

  it('processImage의 svgSanitizer strict는 strict sanitizer를 적용한 SVG를 정상 로드한다', async () => {
    const sanitizeSvgStrictSpy = vi.fn(
      () => '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'
    );
    const sanitizeSvgForRenderingSpy = vi.fn((svg: string) => svg);

    vi.doMock('../../../../src/svg-sanitizer', () => ({
      sanitizeSvgStrict: sanitizeSvgStrictSpy,
    }));
    vi.doMock('../../../../src/utils/svg-sanitizer', async () => {
      const actual = await vi.importActual<typeof import('../../../../src/utils/svg-sanitizer')>(
        '../../../../src/utils/svg-sanitizer'
      );
      return {
        ...actual,
        sanitizeSvg: sanitizeSvgForRenderingSpy,
        sanitizeSvgForRendering: sanitizeSvgForRenderingSpy,
      };
    });

    const { processImage } = await import('../../../../src');
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" onload="alert(1)"><script>alert(1)</script><rect width="10" height="10"/></svg>';

    await expect((processImage(svg, { svgSanitizer: 'strict' }) as any).toElement()).resolves.toBeInstanceOf(
      HTMLImageElement
    );
    expect(sanitizeSvgStrictSpy).toHaveBeenCalledTimes(1);
    expect(sanitizeSvgStrictSpy).toHaveBeenCalledWith(svg);
    expect(sanitizeSvgForRenderingSpy).not.toHaveBeenCalled();
  });

  it('unsafe_processImage는 svgSanitizer strict 옵션보다 우선하여 compatibility 보정을 건너뛴다', async () => {
    const previousSvgMockMode = (globalThis as any)._SVG_MOCK_MODE;
    try {
      (globalThis as any)._SVG_MOCK_MODE = false;

      const enhanceSvgForBrowserSpy = vi.fn((svg: string) => svg);

      vi.doMock('../../../../src/utils/svg-compatibility', async () => {
        const actual = await vi.importActual<typeof import('../../../../src/utils/svg-compatibility')>(
          '../../../../src/utils/svg-compatibility'
        );
        return { ...actual, enhanceSvgForBrowser: enhanceSvgForBrowserSpy };
      });

      const { unsafe_processImage } = await import('../../../../src');
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';

      await (unsafe_processImage(svg, { svgSanitizer: 'strict' }) as any).toElement();
      // unsafe_processImage는 __svgPassthroughMode: 'unsafe-pass-through'이 우선하므로
      // compatibility 보정을 수행하지 않는다.
      expect(enhanceSvgForBrowserSpy).not.toHaveBeenCalled();
    } finally {
      (globalThis as any)._SVG_MOCK_MODE = previousSvgMockMode;
    }
  });
});
