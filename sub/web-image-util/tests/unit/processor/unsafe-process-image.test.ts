import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestImageBlob } from '../../utils/image-helper';

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
});

describe('unsafe_processImage — safe/unsafe 경로 차이', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('safe 경로는 sanitize와 compatibility 보정을 수행하고 unsafe 경로는 건너뛴다', async () => {
    const previousSvgMockMode = (globalThis as any)._SVG_MOCK_MODE;
    (globalThis as any)._SVG_MOCK_MODE = false;

    const sanitizeSvg = vi.fn((svg: string) => svg);
    const enhanceSvgForBrowser = vi.fn((svg: string) => svg);

    vi.doMock('../../../src/utils/svg-sanitizer', async () => {
      const actual = await vi.importActual<typeof import('../../../src/utils/svg-sanitizer')>(
        '../../../src/utils/svg-sanitizer'
      );
      return { ...actual, sanitizeSvg };
    });

    vi.doMock('../../../src/utils/svg-compatibility', async () => {
      const actual = await vi.importActual<typeof import('../../../src/utils/svg-compatibility')>(
        '../../../src/utils/svg-compatibility'
      );
      return { ...actual, enhanceSvgForBrowser };
    });

    const { processImage, unsafe_processImage } = await import('../../../src');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';

    try {
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
});
