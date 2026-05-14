/**
 * FormatDetector와 FORMAT_MIME_MAP 단위 테스트.
 *
 * 브라우저 이미지 로딩에 의존하는 WebP/AVIF 감지는
 * createImageElement를 mock하여 환경 독립적으로 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// createImageElement mock 선언 — vitest에 의해 호이스팅된다
vi.mock('../../../src/utils/image-element');

import { FORMAT_MIME_MAP, FormatDetector } from '../../../src/base/format-detector';
import { ImageFormats } from '../../../src/types';
import { createImageElement } from '../../../src/utils/image-element';

// -----------------------------------------------------------------------
// 헬퍼
// -----------------------------------------------------------------------

/**
 * src setter 할당 시 onload/onerror를 비동기로 실행하는 가짜 이미지 객체를 만든다.
 * succeed=true 이면 width/height가 1인 이미지로 로드 성공을 흉내낸다.
 */
function makeFakeImage(succeed: boolean): HTMLImageElement {
  const img: any = {
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
    width: succeed ? 1 : 0,
    height: succeed ? 1 : 0,
  };
  Object.defineProperty(img, 'src', {
    set(_val: string) {
      Promise.resolve().then(() => {
        if (succeed) {
          img.onload?.();
        } else {
          img.onerror?.();
        }
      });
    },
  });
  return img as HTMLImageElement;
}

// -----------------------------------------------------------------------
// FORMAT_MIME_MAP
// -----------------------------------------------------------------------

describe('FORMAT_MIME_MAP', () => {
  it.each([
    [ImageFormats.JPEG, 'image/jpeg'],
    [ImageFormats.JPG, 'image/jpeg'],
    [ImageFormats.PNG, 'image/png'],
    [ImageFormats.WEBP, 'image/webp'],
    [ImageFormats.AVIF, 'image/avif'],
    [ImageFormats.GIF, 'image/gif'],
    [ImageFormats.SVG, 'image/svg+xml'],
  ] as const)('%s → %s', (format, expected) => {
    expect(FORMAT_MIME_MAP[format]).toBe(expected);
  });

  it('ImageFormats의 모든 키를 포함한다', () => {
    for (const fmt of Object.values(ImageFormats)) {
      expect(FORMAT_MIME_MAP).toHaveProperty(fmt);
    }
  });
});

// -----------------------------------------------------------------------
// FormatDetector
// -----------------------------------------------------------------------

describe('FormatDetector', () => {
  beforeEach(() => {
    // 각 테스트 전 지원 여부 캐시를 초기화한다
    (FormatDetector as any).supportCache.clear();
    vi.resetAllMocks();
  });

  afterEach(() => {
    (FormatDetector as any).supportCache.clear();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // isSupported — 기본 지원 포맷 (항상 true)
  // -----------------------------------------------------------------------

  describe('isSupported — 기본 지원 포맷', () => {
    it.each([
      [ImageFormats.JPEG],
      [ImageFormats.JPG],
      [ImageFormats.PNG],
      [ImageFormats.GIF],
      [ImageFormats.SVG],
    ] as const)('%s는 항상 지원한다', async (format) => {
      expect(await FormatDetector.isSupported(format)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // isSupported — WebP (이미지 로드로 판별)
  // -----------------------------------------------------------------------

  describe('isSupported — WebP', () => {
    it('이미지가 정상 로드되면 지원 포맷으로 반환한다', async () => {
      vi.mocked(createImageElement).mockReturnValue(makeFakeImage(true));

      expect(await FormatDetector.isSupported(ImageFormats.WEBP)).toBe(true);
    });

    it('이미지 로드 실패시 미지원 포맷으로 반환한다', async () => {
      vi.mocked(createImageElement).mockReturnValue(makeFakeImage(false));

      expect(await FormatDetector.isSupported(ImageFormats.WEBP)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // isSupported — AVIF (이미지 로드로 판별)
  // -----------------------------------------------------------------------

  describe('isSupported — AVIF', () => {
    it('이미지가 정상 로드되면 지원 포맷으로 반환한다', async () => {
      vi.mocked(createImageElement).mockReturnValue(makeFakeImage(true));

      expect(await FormatDetector.isSupported(ImageFormats.AVIF)).toBe(true);
    });

    it('이미지 로드 실패시 미지원 포맷으로 반환한다', async () => {
      vi.mocked(createImageElement).mockReturnValue(makeFakeImage(false));

      expect(await FormatDetector.isSupported(ImageFormats.AVIF)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // isSupported — 캐시 동작
  // -----------------------------------------------------------------------

  describe('isSupported — 캐시', () => {
    it('동일 포맷의 두 번째 호출은 createImageElement를 추가로 호출하지 않는다', async () => {
      vi.mocked(createImageElement).mockReturnValue(makeFakeImage(true));

      await FormatDetector.isSupported(ImageFormats.WEBP);
      const countAfterFirst = vi.mocked(createImageElement).mock.calls.length;

      await FormatDetector.isSupported(ImageFormats.WEBP);

      // 캐시에서 반환되므로 createImageElement 호출 횟수가 증가하지 않는다
      expect(vi.mocked(createImageElement).mock.calls.length).toBe(countAfterFirst);
    });

    it('캐시를 초기화하면 다시 감지를 수행한다', async () => {
      vi.mocked(createImageElement).mockReturnValue(makeFakeImage(true));

      await FormatDetector.isSupported(ImageFormats.AVIF);
      const countAfterFirst = vi.mocked(createImageElement).mock.calls.length;

      // 캐시 초기화 후 재호출
      (FormatDetector as any).supportCache.clear();
      await FormatDetector.isSupported(ImageFormats.AVIF);

      expect(vi.mocked(createImageElement).mock.calls.length).toBeGreaterThan(countAfterFirst);
    });
  });

  // -----------------------------------------------------------------------
  // getSupportedFormats
  // -----------------------------------------------------------------------

  describe('getSupportedFormats', () => {
    it('배열을 반환한다', async () => {
      vi.mocked(createImageElement).mockReturnValue(makeFakeImage(false));

      const formats = await FormatDetector.getSupportedFormats();

      expect(Array.isArray(formats)).toBe(true);
    });

    it('항상 지원하는 포맷(jpeg, jpg, png, gif, svg)을 포함한다', async () => {
      vi.mocked(createImageElement).mockReturnValue(makeFakeImage(false));

      const formats = await FormatDetector.getSupportedFormats();

      expect(formats).toContain(ImageFormats.JPEG);
      expect(formats).toContain(ImageFormats.JPG);
      expect(formats).toContain(ImageFormats.PNG);
      expect(formats).toContain(ImageFormats.GIF);
      expect(formats).toContain(ImageFormats.SVG);
    });

    it('WebP/AVIF 로드 성공 환경이면 두 포맷도 포함된다', async () => {
      vi.mocked(createImageElement).mockReturnValue(makeFakeImage(true));

      const formats = await FormatDetector.getSupportedFormats();

      expect(formats).toContain(ImageFormats.WEBP);
      expect(formats).toContain(ImageFormats.AVIF);
    });

    it('WebP/AVIF 로드 실패 환경이면 두 포맷은 포함되지 않는다', async () => {
      vi.mocked(createImageElement).mockReturnValue(makeFakeImage(false));

      const formats = await FormatDetector.getSupportedFormats();

      expect(formats).not.toContain(ImageFormats.WEBP);
      expect(formats).not.toContain(ImageFormats.AVIF);
    });
  });

  // -----------------------------------------------------------------------
  // getBestFormat
  // -----------------------------------------------------------------------

  describe('getBestFormat', () => {
    describe('투명도 없는 경우 (hasTransparency = false)', () => {
      it('AVIF 지원시 avif를 반환한다', async () => {
        vi.spyOn(FormatDetector, 'isSupported').mockResolvedValue(true);

        const result = await FormatDetector.getBestFormat(false);

        expect(result).toBe(ImageFormats.AVIF);
      });

      it('AVIF 미지원·WebP 지원시 webp를 반환한다', async () => {
        vi.spyOn(FormatDetector, 'isSupported').mockImplementation(async (format) => {
          if (format === ImageFormats.AVIF) return false;
          if (format === ImageFormats.WEBP) return true;
          return true;
        });

        const result = await FormatDetector.getBestFormat(false);

        expect(result).toBe(ImageFormats.WEBP);
      });

      it('AVIF·WebP 모두 미지원시 jpeg를 반환한다', async () => {
        vi.spyOn(FormatDetector, 'isSupported').mockImplementation(async (format) => {
          if (format === ImageFormats.AVIF) return false;
          if (format === ImageFormats.WEBP) return false;
          return true;
        });

        const result = await FormatDetector.getBestFormat(false);

        expect(result).toBe(ImageFormats.JPEG);
      });
    });

    describe('투명도 있는 경우 (hasTransparency = true)', () => {
      it('AVIF 지원시 avif를 반환한다', async () => {
        vi.spyOn(FormatDetector, 'isSupported').mockResolvedValue(true);

        const result = await FormatDetector.getBestFormat(true);

        expect(result).toBe(ImageFormats.AVIF);
      });

      it('AVIF 미지원·WebP 지원시 webp를 반환한다', async () => {
        vi.spyOn(FormatDetector, 'isSupported').mockImplementation(async (format) => {
          if (format === ImageFormats.AVIF) return false;
          if (format === ImageFormats.WEBP) return true;
          return true;
        });

        const result = await FormatDetector.getBestFormat(true);

        expect(result).toBe(ImageFormats.WEBP);
      });

      it('AVIF·WebP 모두 미지원시 png를 반환한다', async () => {
        vi.spyOn(FormatDetector, 'isSupported').mockImplementation(async (format) => {
          if (format === ImageFormats.AVIF) return false;
          if (format === ImageFormats.WEBP) return false;
          return true;
        });

        const result = await FormatDetector.getBestFormat(true);

        expect(result).toBe(ImageFormats.PNG);
      });
    });

    it('인수 없이 호출하면 투명도 없는 경로로 동작한다', async () => {
      vi.spyOn(FormatDetector, 'isSupported').mockImplementation(async (format) => {
        if (format === ImageFormats.AVIF) return false;
        if (format === ImageFormats.WEBP) return false;
        return true;
      });

      // hasTransparency 기본값 false → jpeg
      const result = await FormatDetector.getBestFormat();

      expect(result).toBe(ImageFormats.JPEG);
    });
  });
});
