import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestImageBlob } from '../../utils/image-helper';

function createOversizedSvg(): string {
  const oversizedPadding = '가'.repeat(5_300_000);
  return `<svg xmlns="http://www.w3.org/2000/svg"><text>${oversizedPadding}</text></svg>`;
}

function createSvgArrayBuffer(svg: string): ArrayBuffer {
  return new TextEncoder().encode(svg).buffer as ArrayBuffer;
}

function createSvgUint8Array(svg: string): Uint8Array {
  return new TextEncoder().encode(svg);
}

describe('unsafe_processImage', () => {
  it('루트 엔트리에서 공개된다', async () => {
    const { unsafe_processImage } = await import('../../../src');
    expect(unsafe_processImage).toBeTypeOf('function');
  });

  it('비-SVG Blob 입력은 processImage와 동일하게 처리한다', async () => {
    const { processImage, unsafe_processImage } = await import('../../../src');
    const blob = await createTestImageBlob(20, 20, 'red');

    const safe = await processImage(blob).resize({ fit: 'cover', width: 10, height: 10 }).toBlob();
    const unsafe = await unsafe_processImage(blob).resize({ fit: 'cover', width: 10, height: 10 }).toBlob();

    expect(unsafe.width).toBe(safe.width);
    expect(unsafe.height).toBe(safe.height);
    expect(unsafe.format).toBe(safe.format);
    expect(unsafe.blob.size).toBeGreaterThan(0);
  });

  it('ArrayBuffer SVG 입력은 safe 경로에서 차단되고 unsafe 경로는 sanitize만 우회한다', async () => {
    vi.resetModules();

    const sanitizeSvg = vi.fn((svg: string) => svg);
    const enhanceSvgForBrowser = vi.fn((svg: string) => svg);

    vi.doMock('../../../src/utils/svg-sanitizer', async () => {
      const actual = await vi.importActual<typeof import('../../../src/utils/svg-sanitizer')>(
        '../../../src/utils/svg-sanitizer'
      );
      return { ...actual, sanitizeSvg, sanitizeSvgForRendering: sanitizeSvg };
    });

    vi.doMock('../../../src/utils/svg-compatibility', async () => {
      const actual = await vi.importActual<typeof import('../../../src/utils/svg-compatibility')>(
        '../../../src/utils/svg-compatibility'
      );
      return { ...actual, enhanceSvgForBrowser };
    });

    try {
      const { processImage, unsafe_processImage } = await import('../../../src');
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="./assets/pattern.png" width="10" height="10"/></svg>';
      const buffer = createSvgArrayBuffer(svg);

      await expect((processImage(buffer) as any).toElement()).rejects.toMatchObject({
        code: 'OUTPUT_FAILED',
        originalError: expect.objectContaining({
          code: 'INVALID_SOURCE',
        }),
      });
      expect(sanitizeSvg).toHaveBeenCalledTimes(1);
      expect(enhanceSvgForBrowser).not.toHaveBeenCalled();

      sanitizeSvg.mockClear();
      enhanceSvgForBrowser.mockClear();

      await expect((unsafe_processImage(buffer) as any).toElement()).resolves.toBeInstanceOf(HTMLImageElement);
      expect(sanitizeSvg).not.toHaveBeenCalled();
      expect(enhanceSvgForBrowser).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
      vi.doUnmock('../../../src/utils/svg-sanitizer');
      vi.doUnmock('../../../src/utils/svg-compatibility');
    }
  });

  it('Uint8Array SVG 입력은 safe 경로에서 크기 제한을 유지하고 unsafe도 동일하게 차단한다', async () => {
    const { processImage, unsafe_processImage } = await import('../../../src');
    const uint8 = createSvgUint8Array(createOversizedSvg());

    await expect((processImage(uint8) as any).toElement()).rejects.toMatchObject({
      code: 'OUTPUT_FAILED',
      originalError: expect.objectContaining({
        code: 'INVALID_SOURCE',
      }),
    });

    await expect((unsafe_processImage(uint8) as any).toElement()).rejects.toMatchObject({
      code: 'OUTPUT_FAILED',
      originalError: expect.objectContaining({
        code: 'INVALID_SOURCE',
      }),
    });
  });
});

describe('unsafe_processImage — safe/unsafe 경로 차이', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('../../../src/utils/svg-sanitizer');
    vi.doUnmock('../../../src/utils/svg-compatibility');
  });

  it('safe 경로는 sanitize와 compatibility 보정을 수행하고 unsafe 경로는 건너뛴다', async () => {
    const previousSvgMockMode = (globalThis as any)._SVG_MOCK_MODE;
    try {
      (globalThis as any)._SVG_MOCK_MODE = false;

      const sanitizeSvg = vi.fn((svg: string) => svg);
      const enhanceSvgForBrowser = vi.fn((svg: string) => svg);

      vi.doMock('../../../src/utils/svg-sanitizer', async () => {
        const actual = await vi.importActual<typeof import('../../../src/utils/svg-sanitizer')>(
          '../../../src/utils/svg-sanitizer'
        );
        return { ...actual, sanitizeSvg, sanitizeSvgForRendering: sanitizeSvg };
      });

      vi.doMock('../../../src/utils/svg-compatibility', async () => {
        const actual = await vi.importActual<typeof import('../../../src/utils/svg-compatibility')>(
          '../../../src/utils/svg-compatibility'
        );
        return { ...actual, enhanceSvgForBrowser };
      });

      const { processImage, unsafe_processImage } = await import('../../../src');
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';

      await (processImage(svg).resize({ fit: 'cover', width: 10, height: 10 }) as any).toElement();
      expect(sanitizeSvg).toHaveBeenCalled();
      expect(enhanceSvgForBrowser).toHaveBeenCalled();

      sanitizeSvg.mockClear();
      enhanceSvgForBrowser.mockClear();

      await (unsafe_processImage(svg).resize({ fit: 'cover', width: 10, height: 10 }) as any).toElement();
      expect(sanitizeSvg).not.toHaveBeenCalled();
      expect(enhanceSvgForBrowser).not.toHaveBeenCalled();
    } finally {
      (globalThis as any)._SVG_MOCK_MODE = previousSvgMockMode;
    }
  });

  it('safe 경로만 상대 경로 참조 SVG를 차단하고 unsafe 경로는 해당 검사 단계를 건너뛴다', async () => {
    const svgWithRelativeHref =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="./assets/pattern.png" width="10" height="10"/></svg>';
    const sanitizeSvg = vi.fn((svg: string) => svg);

    vi.doMock('../../../src/utils/svg-sanitizer', async () => {
      const actual = await vi.importActual<typeof import('../../../src/utils/svg-sanitizer')>(
        '../../../src/utils/svg-sanitizer'
      );
      return { ...actual, sanitizeSvg, sanitizeSvgForRendering: sanitizeSvg };
    });

    const { processImage, unsafe_processImage } = await import('../../../src');

    await expect((processImage(svgWithRelativeHref) as any).toElement()).rejects.toMatchObject({
      code: 'OUTPUT_FAILED',
      originalError: expect.objectContaining({
        code: 'INVALID_SOURCE',
      }),
    });
    expect(sanitizeSvg).toHaveBeenCalledTimes(1);

    sanitizeSvg.mockClear();

    await expect((unsafe_processImage(svgWithRelativeHref) as any).toElement()).resolves.toBeInstanceOf(
      HTMLImageElement
    );
    expect(sanitizeSvg).not.toHaveBeenCalled();
  });

  it('SVG Blob 입력에서도 safe 경로만 보안 게이트에 걸리고 unsafe 경로는 passthrough 모드를 유지한다', async () => {
    const svgWithRelativeHref =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="./assets/pattern.png" width="10" height="10"/></svg>';
    const svgBlob = new Blob([svgWithRelativeHref], { type: 'image/svg+xml' });
    const sanitizeSvg = vi.fn((svg: string) => svg);

    vi.doMock('../../../src/utils/svg-sanitizer', async () => {
      const actual = await vi.importActual<typeof import('../../../src/utils/svg-sanitizer')>(
        '../../../src/utils/svg-sanitizer'
      );
      return { ...actual, sanitizeSvg, sanitizeSvgForRendering: sanitizeSvg };
    });

    const { processImage, unsafe_processImage } = await import('../../../src');

    await expect((processImage(svgBlob) as any).toElement()).rejects.toMatchObject({
      code: 'OUTPUT_FAILED',
      originalError: expect.objectContaining({
        code: 'INVALID_SOURCE',
      }),
    });
    expect(sanitizeSvg).toHaveBeenCalledTimes(1);

    sanitizeSvg.mockClear();

    await expect((unsafe_processImage(svgBlob) as any).toElement()).resolves.toBeInstanceOf(HTMLImageElement);
    expect(sanitizeSvg).not.toHaveBeenCalled();
  });

  it('unsafe 경로에서도 oversized SVG 입력은 크기 제한으로 차단한다', async () => {
    const { processImage, unsafe_processImage } = await import('../../../src');
    const oversizedSvg = createOversizedSvg();

    await expect((processImage(oversizedSvg) as any).toElement()).rejects.toMatchObject({
      code: 'OUTPUT_FAILED',
      originalError: expect.objectContaining({
        code: 'INVALID_SOURCE',
      }),
    });
    await expect((unsafe_processImage(oversizedSvg) as any).toElement()).rejects.toMatchObject({
      code: 'OUTPUT_FAILED',
      originalError: expect.objectContaining({
        code: 'INVALID_SOURCE',
      }),
    });
  });
});
