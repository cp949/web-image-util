/**
 * SmartFormatSelector와 편의 함수(optimizeForWeb 등) 단위 테스트.
 *
 * FormatDetector.getSupportedFormats 를 mock하여
 * 브라우저 WebP/AVIF 지원 여부를 시나리오별로 제어한다.
 *
 * 스코어 계산 참고 (단순 단색·불투명·비사진 캔버스 기준, qualityPriority=0.6):
 *   AVIF  : 90 + 10(그래픽) + 5(단순색) + 6(품질) = 111
 *   WebP  : 80 + 10        + 5         + 4.8     ≈ 100
 *   PNG   : 50 + 10        + 5         + 5.4     ≈ 70
 *   JPEG  : 60 + 0         + 0         + 3.6     ≈ 64
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FORMAT_MIME_MAP, FormatDetector } from '../../../src/base/format-detector';
import {
  autoOptimize,
  ImagePurpose,
  optimizeForThumbnail,
  optimizeForWeb,
  SmartFormatSelector,
} from '../../../src/core/smart-format';
import { ImageFormats } from '../../../src/types';

// -----------------------------------------------------------------------
// 헬퍼
// -----------------------------------------------------------------------

/**
 * 단색(빨강) 불투명 캔버스를 만든다.
 * analyzeImage 는 hasTransparency=false, colorComplexity≈0, 비사진으로 분석한다.
 */
function makeOpaqueCanvas(width = 10, height = 10): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, width, height);
  }
  return canvas;
}

// -----------------------------------------------------------------------
// ImagePurpose 열거형
// -----------------------------------------------------------------------

describe('ImagePurpose', () => {
  it('모든 목적 값이 정의된다', () => {
    expect(ImagePurpose.WEB).toBe('web');
    expect(ImagePurpose.THUMBNAIL).toBe('thumbnail');
    expect(ImagePurpose.PRINT).toBe('print');
    expect(ImagePurpose.SOCIAL).toBe('social');
    expect(ImagePurpose.ICON).toBe('icon');
    expect(ImagePurpose.ARCHIVE).toBe('archive');
  });
});

// -----------------------------------------------------------------------
// SmartFormatSelector.selectOptimalFormat
// -----------------------------------------------------------------------

describe('SmartFormatSelector.selectOptimalFormat', () => {
  beforeEach(() => {
    (FormatDetector as any).supportCache.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    (FormatDetector as any).supportCache.clear();
    vi.restoreAllMocks();
  });

  // ------------------------------------------------------------------
  // 포맷 선택 우선순위
  // ------------------------------------------------------------------

  describe('포맷 선택 우선순위', () => {
    it('AVIF 지원시 AVIF가 선택된다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([
        ImageFormats.JPEG,
        ImageFormats.PNG,
        ImageFormats.WEBP,
        ImageFormats.AVIF,
      ]);

      const result = await SmartFormatSelector.selectOptimalFormat(makeOpaqueCanvas());

      expect(result.format).toBe(ImageFormats.AVIF);
    });

    it('AVIF 미지원·WebP 지원시 WebP가 선택된다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([
        ImageFormats.JPEG,
        ImageFormats.PNG,
        ImageFormats.WEBP,
      ]);

      const result = await SmartFormatSelector.selectOptimalFormat(makeOpaqueCanvas());

      expect(result.format).toBe(ImageFormats.WEBP);
    });

    it('AVIF·WebP 모두 미지원시 단순 그래픽 이미지는 PNG가 선택된다', async () => {
      // 단색 캔버스는 비사진(non-photographic)으로 분석되므로
      // PNG(70.4점)가 JPEG(63.6점)보다 높다
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([ImageFormats.JPEG, ImageFormats.PNG]);

      const result = await SmartFormatSelector.selectOptimalFormat(makeOpaqueCanvas());

      expect(result.format).toBe(ImageFormats.PNG);
    });

    it('투명도 포함 이미지에서 AVIF·WebP 미지원시 PNG가 선택된다', async () => {
      // JPEG는 투명도 미지원(-30), PNG는 투명도 보너스(+20)
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([ImageFormats.JPEG, ImageFormats.PNG]);

      const result = await SmartFormatSelector.selectOptimalFormat(makeOpaqueCanvas(), {
        preserveTransparency: true,
      });

      expect(result.format).toBe(ImageFormats.PNG);
    });

    it('투명도 포함 이미지에서 AVIF 지원시 AVIF가 선택된다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([
        ImageFormats.JPEG,
        ImageFormats.PNG,
        ImageFormats.WEBP,
        ImageFormats.AVIF,
      ]);

      const result = await SmartFormatSelector.selectOptimalFormat(makeOpaqueCanvas(), {
        preserveTransparency: true,
      });

      expect(result.format).toBe(ImageFormats.AVIF);
    });
  });

  // ------------------------------------------------------------------
  // legacyCompatible 옵션
  // ------------------------------------------------------------------

  describe('legacyCompatible 옵션', () => {
    it('true면 WebP를 후보에서 제외한다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([
        ImageFormats.JPEG,
        ImageFormats.PNG,
        ImageFormats.WEBP,
        ImageFormats.AVIF,
      ]);

      const result = await SmartFormatSelector.selectOptimalFormat(makeOpaqueCanvas(), {
        legacyCompatible: true,
      });

      expect(result.format).not.toBe(ImageFormats.WEBP);
    });

    it('true이고 AVIF 지원시 AVIF가 선택된다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([
        ImageFormats.JPEG,
        ImageFormats.PNG,
        ImageFormats.WEBP,
        ImageFormats.AVIF,
      ]);

      const result = await SmartFormatSelector.selectOptimalFormat(makeOpaqueCanvas(), {
        legacyCompatible: true,
      });

      // WebP는 제외되지만 AVIF는 legacyCompatible 필터 대상이 아니다
      expect(result.format).toBe(ImageFormats.AVIF);
    });

    it('true이고 AVIF·WebP 모두 없으면 기본 포맷 중 하나가 선택된다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([ImageFormats.JPEG, ImageFormats.PNG]);

      const result = await SmartFormatSelector.selectOptimalFormat(makeOpaqueCanvas(), {
        legacyCompatible: true,
      });

      expect([ImageFormats.JPEG, ImageFormats.PNG]).toContain(result.format);
    });
  });

  // ------------------------------------------------------------------
  // allowedFormats 옵션
  // ------------------------------------------------------------------

  describe('allowedFormats 옵션', () => {
    it('허용 포맷 목록 안에서만 선택한다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([
        ImageFormats.JPEG,
        ImageFormats.PNG,
        ImageFormats.WEBP,
        ImageFormats.AVIF,
      ]);

      const result = await SmartFormatSelector.selectOptimalFormat(makeOpaqueCanvas(), {
        allowedFormats: [ImageFormats.PNG],
      });

      expect(result.format).toBe(ImageFormats.PNG);
    });

    it('허용 포맷이 여러 개면 그 중 최고 점수 포맷을 선택한다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([
        ImageFormats.JPEG,
        ImageFormats.PNG,
        ImageFormats.WEBP,
      ]);

      const result = await SmartFormatSelector.selectOptimalFormat(makeOpaqueCanvas(), {
        allowedFormats: [ImageFormats.JPEG, ImageFormats.WEBP],
      });

      // WebP 기본 점수(80) > JPEG 기본 점수(60)
      expect(result.format).toBe(ImageFormats.WEBP);
    });
  });

  // ------------------------------------------------------------------
  // 결과 구조 검증
  // ------------------------------------------------------------------

  describe('결과 구조', () => {
    it('format, mimeType, quality, reason, alternatives 필드를 포함한다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([
        ImageFormats.JPEG,
        ImageFormats.PNG,
        ImageFormats.WEBP,
      ]);

      const result = await SmartFormatSelector.selectOptimalFormat(makeOpaqueCanvas());

      expect(result).toHaveProperty('format');
      expect(result).toHaveProperty('mimeType');
      expect(result).toHaveProperty('quality');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('alternatives');
      expect(Array.isArray(result.alternatives)).toBe(true);
    });

    it('mimeType은 FORMAT_MIME_MAP의 해당 포맷 값과 일치한다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([
        ImageFormats.JPEG,
        ImageFormats.PNG,
        ImageFormats.WEBP,
      ]);

      const result = await SmartFormatSelector.selectOptimalFormat(makeOpaqueCanvas());

      expect(result.mimeType).toBe(FORMAT_MIME_MAP[result.format]);
    });

    it('quality는 0 초과 1 이하다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([
        ImageFormats.JPEG,
        ImageFormats.PNG,
        ImageFormats.WEBP,
      ]);

      const result = await SmartFormatSelector.selectOptimalFormat(makeOpaqueCanvas());

      expect(result.quality).toBeGreaterThan(0);
      expect(result.quality).toBeLessThanOrEqual(1);
    });

    it('alternatives는 선택된 포맷을 포함하지 않는다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([
        ImageFormats.JPEG,
        ImageFormats.PNG,
        ImageFormats.WEBP,
        ImageFormats.AVIF,
      ]);

      const result = await SmartFormatSelector.selectOptimalFormat(makeOpaqueCanvas());

      const altFormats = result.alternatives.map((a) => a.format);
      expect(altFormats).not.toContain(result.format);
    });
  });

  // ------------------------------------------------------------------
  // purpose별 quality
  // ------------------------------------------------------------------

  describe('purpose별 quality 차이', () => {
    it('THUMBNAIL purpose는 WEB purpose보다 낮거나 같은 quality를 반환한다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([ImageFormats.JPEG]);

      const canvas = makeOpaqueCanvas();
      const webResult = await SmartFormatSelector.selectOptimalFormat(canvas, {
        purpose: ImagePurpose.WEB,
        allowedFormats: [ImageFormats.JPEG],
      });
      const thumbResult = await SmartFormatSelector.selectOptimalFormat(canvas, {
        purpose: ImagePurpose.THUMBNAIL,
        allowedFormats: [ImageFormats.JPEG],
      });

      expect(thumbResult.quality).toBeLessThanOrEqual(webResult.quality);
    });

    it('ARCHIVE purpose는 quality 1.0을 반환한다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([ImageFormats.JPEG]);

      const result = await SmartFormatSelector.selectOptimalFormat(makeOpaqueCanvas(), {
        purpose: ImagePurpose.ARCHIVE,
        allowedFormats: [ImageFormats.JPEG],
      });

      expect(result.quality).toBe(1.0);
    });

    it('PRINT purpose는 WEB purpose보다 높거나 같은 quality를 반환한다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([ImageFormats.JPEG]);

      const canvas = makeOpaqueCanvas();
      const webResult = await SmartFormatSelector.selectOptimalFormat(canvas, {
        purpose: ImagePurpose.WEB,
        allowedFormats: [ImageFormats.JPEG],
      });
      const printResult = await SmartFormatSelector.selectOptimalFormat(canvas, {
        purpose: ImagePurpose.PRINT,
        allowedFormats: [ImageFormats.JPEG],
      });

      expect(printResult.quality).toBeGreaterThanOrEqual(webResult.quality);
    });
  });
});

// -----------------------------------------------------------------------
// SmartFormatSelector.batchOptimize
// -----------------------------------------------------------------------

describe('SmartFormatSelector.batchOptimize', () => {
  beforeEach(() => {
    (FormatDetector as any).supportCache.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    (FormatDetector as any).supportCache.clear();
    vi.restoreAllMocks();
  });

  it('입력 캔버스 수만큼 결과를 반환한다', async () => {
    vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([ImageFormats.JPEG, ImageFormats.PNG]);

    const canvases = [
      { canvas: makeOpaqueCanvas(), name: '첫번째' },
      { canvas: makeOpaqueCanvas(), name: '두번째' },
      { canvas: makeOpaqueCanvas(), name: '세번째' },
    ];

    const results = await SmartFormatSelector.batchOptimize(canvases);

    expect(results).toHaveLength(3);
  });

  it('각 결과에 name이 전달된다', async () => {
    vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([ImageFormats.JPEG]);

    const results = await SmartFormatSelector.batchOptimize([
      { canvas: makeOpaqueCanvas(), name: 'first' },
      { canvas: makeOpaqueCanvas(), name: 'second' },
    ]);

    expect(results[0].name).toBe('first');
    expect(results[1].name).toBe('second');
  });

  it('각 결과에 FormatOptimizationResult 필드가 존재한다', async () => {
    vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([ImageFormats.JPEG, ImageFormats.PNG]);

    const results = await SmartFormatSelector.batchOptimize([{ canvas: makeOpaqueCanvas() }]);

    expect(results[0].result).toHaveProperty('format');
    expect(results[0].result).toHaveProperty('mimeType');
    expect(results[0].result).toHaveProperty('quality');
  });

  it('globalOptions가 각 항목에 적용된다', async () => {
    vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([
      ImageFormats.JPEG,
      ImageFormats.PNG,
      ImageFormats.WEBP,
    ]);

    const results = await SmartFormatSelector.batchOptimize(
      [{ canvas: makeOpaqueCanvas() }, { canvas: makeOpaqueCanvas() }],
      { allowedFormats: [ImageFormats.JPEG] }
    );

    for (const { result } of results) {
      expect(result.format).toBe(ImageFormats.JPEG);
    }
  });
});

// -----------------------------------------------------------------------
// 편의 함수
// -----------------------------------------------------------------------

describe('편의 함수', () => {
  beforeEach(() => {
    (FormatDetector as any).supportCache.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    (FormatDetector as any).supportCache.clear();
    vi.restoreAllMocks();
  });

  describe('optimizeForWeb', () => {
    it('FormatOptimizationResult를 반환한다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([ImageFormats.JPEG, ImageFormats.PNG]);

      const result = await optimizeForWeb(makeOpaqueCanvas());

      expect(result).toHaveProperty('format');
      expect(result).toHaveProperty('mimeType');
      expect(result).toHaveProperty('quality');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('alternatives');
    });

    it('WEB purpose로 SmartFormatSelector.selectOptimalFormat에 위임한다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([ImageFormats.JPEG, ImageFormats.PNG]);

      const canvas = makeOpaqueCanvas();
      const directResult = await SmartFormatSelector.selectOptimalFormat(canvas, { purpose: ImagePurpose.WEB });
      const webResult = await optimizeForWeb(canvas);

      expect(webResult.format).toBe(directResult.format);
      expect(webResult.quality).toBe(directResult.quality);
    });
  });

  describe('optimizeForThumbnail', () => {
    it('FormatOptimizationResult를 반환한다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([ImageFormats.JPEG, ImageFormats.PNG]);

      const result = await optimizeForThumbnail(makeOpaqueCanvas());

      expect(result).toHaveProperty('format');
      expect(result).toHaveProperty('quality');
    });

    it('optimizeForWeb보다 낮거나 같은 quality를 반환한다', async () => {
      // getSupportedFormats를 JPEG 하나로 고정해 두 함수가 같은 포맷을 선택하게 한다
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([ImageFormats.JPEG]);

      const canvas = makeOpaqueCanvas();
      const webResult = await optimizeForWeb(canvas);
      const thumbResult = await optimizeForThumbnail(canvas);

      expect(thumbResult.quality).toBeLessThanOrEqual(webResult.quality);
    });
  });

  describe('autoOptimize', () => {
    it('format, quality, mimeType 세 필드를 반환한다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([ImageFormats.JPEG, ImageFormats.PNG]);

      const result = await autoOptimize(makeOpaqueCanvas());

      expect(result).toHaveProperty('format');
      expect(result).toHaveProperty('quality');
      expect(result).toHaveProperty('mimeType');
    });

    it('FormatOptimizationResult와 달리 alternatives 필드가 없다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([ImageFormats.JPEG, ImageFormats.PNG]);

      const result = await autoOptimize(makeOpaqueCanvas());

      expect(result).not.toHaveProperty('alternatives');
    });

    it('maxSizeKB 옵션을 받아 결과를 반환한다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([
        ImageFormats.JPEG,
        ImageFormats.PNG,
        ImageFormats.WEBP,
      ]);

      const result = await autoOptimize(makeOpaqueCanvas(), 100);

      expect(result).toHaveProperty('format');
    });

    it('반환된 mimeType이 선택된 format의 MIME 타입과 일치한다', async () => {
      vi.spyOn(FormatDetector, 'getSupportedFormats').mockResolvedValue([ImageFormats.JPEG, ImageFormats.PNG]);

      const result = await autoOptimize(makeOpaqueCanvas());

      expect(result.mimeType).toBe(FORMAT_MIME_MAP[result.format]);
    });
  });
});
