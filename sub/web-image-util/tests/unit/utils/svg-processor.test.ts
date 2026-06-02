/**
 * SVGProcessor static 메서드 단위 테스트다.
 *
 * 제공 메서드:
 *   - extractSVGDimensions(svgString): SVGDimensions | null
 *       width/height → viewBox → style 순서로 크기 추출. 상대 단위·파싱 실패는 null.
 *   - addDimensionsToSVG(svgString, width, height): string
 *       누락된 width/height/viewBox만 추가. 기존 값은 보존.
 *   - isValidSVG(svgString): boolean
 *       parsererror 없고 <svg> 요소가 있으면 true.
 *   - normalizeSVG(svgString): string
 *       enhanceSvgForBrowser 래퍼 — 결과 형태 검증.
 *   - processSVGString(svgString, options?): Promise<HTMLImageElement>
 *       URL.createObjectURL/revokeObjectURL 정리 계약과 crossOrigin 전달 검증.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageProcessError } from '../../../src/types';
import { enhanceSvgForBrowser } from '../../../src/utils/svg-compatibility';
import { SVGProcessor } from '../../../src/utils/svg-processor';

// svg-compatibility 모듈을 spy로 래핑해 실제 구현을 유지하면서 호출 여부를 추적한다.
vi.mock('../../../src/utils/svg-compatibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils/svg-compatibility')>();
  return {
    ...actual,
    enhanceSvgForBrowser: vi.fn(actual.enhanceSvgForBrowser),
  };
});

// ── 픽스처 ────────────────────────────────────────────────────────────────────

const SVG_WITH_WH = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="200"></svg>';
const SVG_WITH_WH_PX = '<svg xmlns="http://www.w3.org/2000/svg" width="100px" height="200px"></svg>';
const SVG_WITH_VIEWBOX = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 150"></svg>';
const SVG_WITH_STYLE = '<svg xmlns="http://www.w3.org/2000/svg" style="width:80px;height:60px"></svg>';
const SVG_NO_DIMS = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
const NOT_SVG = '<html><body></body></html>';
// parsererror를 확실히 유발하는 깨진 XML
const BROKEN_XML = '<svg<';
const VALID_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';

// ── 제어 이미지 헬퍼 ──────────────────────────────────────────────────────────

/**
 * src 세터에서 onload 또는 onerror를 즉시 트리거하는 img 요소를 생성한다.
 * processSVGString 내부 document.createElement('img') 호출을 스파이로 가로채
 * 이 요소를 반환하면 jsdom에서 실제 Blob URL 로딩 없이 계약을 검증할 수 있다.
 */
function createControlledImage(result: 'load' | 'error'): HTMLImageElement {
  // 스파이가 적용되기 전에 실제 createElement로 생성한다.
  const img = document.createElement('img');
  let assignedSrc = '';

  Object.defineProperty(img, 'src', {
    configurable: true,
    get: () => assignedSrc,
    set: (value: string) => {
      assignedSrc = value;
      if (result === 'load') {
        img.onload?.(new Event('load'));
      } else {
        img.onerror?.(new Event('error'));
      }
    },
  });

  return img;
}

// ────────────────────────────────────────────────────────────────────────────
// extractSVGDimensions
// ────────────────────────────────────────────────────────────────────────────

describe('SVGProcessor.extractSVGDimensions()', () => {
  describe('width/height 속성 우선', () => {
    it('width와 height 속성 값을 추출한다', () => {
      const result = SVGProcessor.extractSVGDimensions(SVG_WITH_WH);
      expect(result).toEqual({ width: 100, height: 200 });
    });

    it('px 단위가 붙은 width/height도 숫자로 추출한다', () => {
      const result = SVGProcessor.extractSVGDimensions(SVG_WITH_WH_PX);
      expect(result).toEqual({ width: 100, height: 200 });
    });
  });

  describe('viewBox fallback', () => {
    it('width/height 없이 viewBox만 있으면 viewBox 크기를 반환한다', () => {
      const result = SVGProcessor.extractSVGDimensions(SVG_WITH_VIEWBOX);
      expect(result).toEqual({ width: 300, height: 150 });
    });

    it('viewBox 값이 4개 미만이면 null을 반환한다', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100"></svg>';
      expect(SVGProcessor.extractSVGDimensions(svg)).toBeNull();
    });

    it('viewBox 너비·높이가 0이면 null을 반환한다', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 0"></svg>';
      expect(SVGProcessor.extractSVGDimensions(svg)).toBeNull();
    });
  });

  describe('style 속성 fallback', () => {
    it('width/height·viewBox 모두 없고 style에 px 크기가 있으면 추출한다', () => {
      const result = SVGProcessor.extractSVGDimensions(SVG_WITH_STYLE);
      expect(result).toEqual({ width: 80, height: 60 });
    });
  });

  describe('값이 0인 경우 — null 반환', () => {
    it('width/height가 0이면 viewBox 없을 때 null을 반환한다', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"></svg>';
      expect(SVGProcessor.extractSVGDimensions(svg)).toBeNull();
    });

    it('width가 0이고 height만 양수이면 null을 반환한다', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="100"></svg>';
      expect(SVGProcessor.extractSVGDimensions(svg)).toBeNull();
    });
  });

  describe('크기 정보 없음 — null 반환', () => {
    it('width/height·viewBox·style 모두 없으면 null을 반환한다', () => {
      expect(SVGProcessor.extractSVGDimensions(SVG_NO_DIMS)).toBeNull();
    });

    it('svg 요소가 없는 HTML 문자열은 null을 반환한다', () => {
      expect(SVGProcessor.extractSVGDimensions(NOT_SVG)).toBeNull();
    });

    it('잘못된 XML 입력은 null을 반환한다', () => {
      // DOMParser가 parsererror를 반환하거나 내부 예외가 발생해도 null이다.
      expect(SVGProcessor.extractSVGDimensions(BROKEN_XML)).toBeNull();
    });
  });

  // ── 차단 이슈 1: 상대 단위 — parseNumericValue 해석 불가 단위 분기 잠금 ──
  // 참고: "100%"는 parseFloat("100%") = 100 이므로 null이 아니라 숫자로 처리된다.
  // auto·fit-content 등 parseFloat이 NaN을 반환하는 값만 0으로 처리된다.
  describe('상대 단위 — null 반환 또는 viewBox 폴스루', () => {
    it('width·height가 해석 불가 단위(auto)이고 viewBox가 없으면 null을 반환한다', () => {
      // auto → parseFloat("auto") = NaN → 0 반환 → 0 > 0 조건 실패 → style 없음 → null
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="auto" height="auto"></svg>';
      expect(SVGProcessor.extractSVGDimensions(svg)).toBeNull();
    });

    it('width·height가 해석 불가 단위(auto)이고 viewBox가 있으면 viewBox 크기를 반환한다', () => {
      // auto → 0 → width/height 블록 통과 못함 → viewBox 폴스루
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="auto" height="auto" viewBox="0 0 200 100"></svg>';
      expect(SVGProcessor.extractSVGDimensions(svg)).toEqual({ width: 200, height: 100 });
    });
  });

  // ── 차단 이슈 2: 추출 우선순위 — 여러 소스 동거 픽스처 ──
  describe('추출 우선순위 — 여러 소스 동거', () => {
    it('width·height와 viewBox가 동시에 있으면 width·height 값을 반환한다', () => {
      // width/height 블록이 viewBox 블록보다 먼저 평가되어야 한다
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="200" viewBox="0 0 500 300"></svg>';
      expect(SVGProcessor.extractSVGDimensions(svg)).toEqual({ width: 100, height: 200 });
    });

    it('viewBox와 style이 동시에 있으면 viewBox 값을 반환한다', () => {
      // viewBox 블록이 style 블록보다 먼저 평가되어야 한다
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 150" style="width:80px;height:60px"></svg>';
      expect(SVGProcessor.extractSVGDimensions(svg)).toEqual({ width: 300, height: 150 });
    });
  });

  // ── 차단 이슈 3: width 또는 height 한쪽만 존재 → viewBox 폴스루 ──
  describe('한쪽 속성만 존재 — viewBox 폴스루', () => {
    it('width만 있고 height가 없으면 viewBox로 폴스루해 viewBox 크기를 반환한다', () => {
      // if (widthAttr && heightAttr) 조건: heightAttr = null → 실패 → viewBox 폴스루
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" viewBox="0 0 50 50"></svg>';
      expect(SVGProcessor.extractSVGDimensions(svg)).toEqual({ width: 50, height: 50 });
    });

    it('height만 있고 width가 없으면 viewBox로 폴스루해 viewBox 크기를 반환한다', () => {
      // widthAttr = null → 실패 → viewBox 폴스루
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" height="200" viewBox="0 0 80 40"></svg>';
      expect(SVGProcessor.extractSVGDimensions(svg)).toEqual({ width: 80, height: 40 });
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// addDimensionsToSVG
// ────────────────────────────────────────────────────────────────────────────

describe('SVGProcessor.addDimensionsToSVG()', () => {
  it('크기 정보가 없는 SVG에 width·height·viewBox를 추가한다', () => {
    const result = SVGProcessor.addDimensionsToSVG(SVG_NO_DIMS, 120, 80);
    expect(result).toContain('width="120"');
    expect(result).toContain('height="80"');
    expect(result).toContain('viewBox="0 0 120 80"');
  });

  it('이미 width가 있으면 덮어쓰지 않는다', () => {
    const result = SVGProcessor.addDimensionsToSVG(SVG_WITH_WH, 999, 999);
    expect(result).toContain('width="100"');
    expect(result).not.toContain('width="999"');
  });

  it('이미 height가 있으면 덮어쓰지 않는다', () => {
    const result = SVGProcessor.addDimensionsToSVG(SVG_WITH_WH, 999, 999);
    expect(result).toContain('height="200"');
    expect(result).not.toContain('height="999"');
  });

  it('이미 viewBox가 있으면 덮어쓰지 않는다', () => {
    const result = SVGProcessor.addDimensionsToSVG(SVG_WITH_VIEWBOX, 999, 999);
    expect(result).toContain('viewBox="0 0 300 150"');
    expect(result).not.toContain('viewBox="0 0 999 999"');
  });

  it('svg 요소가 없는 문자열은 새 svg 래퍼로 감싼다', () => {
    const result = SVGProcessor.addDimensionsToSVG('not-svg-content', 50, 30);
    expect(result).toContain('<svg');
    expect(result).toContain('width="50"');
    expect(result).toContain('height="30"');
    expect(result).toContain('not-svg-content');
  });

  it('width·height만 있고 viewBox가 없는 SVG에 viewBox를 추가한다', () => {
    // SVG_WITH_WH는 width=100 height=200은 있지만 viewBox가 없다.
    const result = SVGProcessor.addDimensionsToSVG(SVG_WITH_WH, 999, 999);
    expect(result).toContain('viewBox="0 0 999 999"');
  });

  it('viewBox만 있고 width·height가 없는 SVG에 width·height를 추가한다', () => {
    // SVG_WITH_VIEWBOX는 viewBox만 있고 width/height가 없다.
    const result = SVGProcessor.addDimensionsToSVG(SVG_WITH_VIEWBOX, 400, 250);
    expect(result).toContain('width="400"');
    expect(result).toContain('height="250"');
    expect(result).toContain('viewBox="0 0 300 150"');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// isValidSVG
// ────────────────────────────────────────────────────────────────────────────

describe('SVGProcessor.isValidSVG()', () => {
  it('정상 SVG는 true를 반환한다', () => {
    expect(SVGProcessor.isValidSVG(VALID_SVG)).toBe(true);
  });

  it('xmlns 없는 최소 SVG도 true를 반환한다', () => {
    expect(SVGProcessor.isValidSVG('<svg></svg>')).toBe(true);
  });

  it('svg 요소가 없는 HTML 문자열은 false를 반환한다', () => {
    expect(SVGProcessor.isValidSVG(NOT_SVG)).toBe(false);
  });

  it('명확히 깨진 XML 입력은 false를 반환한다', () => {
    // DOMParser가 parsererror 요소를 생성해 false를 반환한다.
    expect(SVGProcessor.isValidSVG(BROKEN_XML)).toBe(false);
  });

  it('빈 문자열은 false를 반환한다', () => {
    expect(SVGProcessor.isValidSVG('')).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// normalizeSVG
// ────────────────────────────────────────────────────────────────────────────

describe('SVGProcessor.normalizeSVG()', () => {
  it('결과가 문자열이다', () => {
    expect(typeof SVGProcessor.normalizeSVG(VALID_SVG)).toBe('string');
  });

  it('정상 SVG에 SVG 네임스페이스를 보존한다', () => {
    const result = SVGProcessor.normalizeSVG(VALID_SVG);
    expect(result).toContain('http://www.w3.org/2000/svg');
  });

  it('비어 있지 않은 결과를 반환한다', () => {
    expect(SVGProcessor.normalizeSVG(VALID_SVG).length).toBeGreaterThan(0);
  });

  it('enhanceSvgForBrowser를 입력 SVG 문자열로 호출한다', () => {
    vi.mocked(enhanceSvgForBrowser).mockClear();
    SVGProcessor.normalizeSVG(VALID_SVG);
    expect(vi.mocked(enhanceSvgForBrowser)).toHaveBeenCalledWith(VALID_SVG);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// processSVGString — object URL 정리 계약과 crossOrigin 전달
// ────────────────────────────────────────────────────────────────────────────

describe('SVGProcessor.processSVGString()', () => {
  const FAKE_BLOB_URL = 'blob:svg-processor-test';

  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue(FAKE_BLOB_URL);
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
    vi.mocked(enhanceSvgForBrowser).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('성공 경로: URL.createObjectURL이 Blob을 인수로 받아 호출된다', async () => {
    const img = createControlledImage('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 못한 createElement 호출: ${tagName}`);
    });

    try {
      await SVGProcessor.processSVGString(VALID_SVG);
    } finally {
      createElementSpy.mockRestore();
    }

    expect(createObjectURLSpy).toHaveBeenCalledWith(expect.any(Blob));
  });

  it('성공 경로: onload 후 URL.revokeObjectURL이 생성된 URL로 호출된다', async () => {
    const img = createControlledImage('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 못한 createElement 호출: ${tagName}`);
    });

    try {
      await SVGProcessor.processSVGString(VALID_SVG);
    } finally {
      createElementSpy.mockRestore();
    }

    expect(revokeObjectURLSpy).toHaveBeenCalledWith(FAKE_BLOB_URL);
  });

  it('실패 경로: onerror 후에도 URL.revokeObjectURL이 반드시 호출된다', async () => {
    const img = createControlledImage('error');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 못한 createElement 호출: ${tagName}`);
    });

    try {
      await expect(SVGProcessor.processSVGString(VALID_SVG)).rejects.toBeInstanceOf(ImageProcessError);
    } finally {
      createElementSpy.mockRestore();
    }

    expect(revokeObjectURLSpy).toHaveBeenCalledWith(FAKE_BLOB_URL);
  });

  it('실패 경로: ImageProcessError 코드가 SVG_LOAD_FAILED이다', async () => {
    const img = createControlledImage('error');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 못한 createElement 호출: ${tagName}`);
    });

    try {
      await expect(SVGProcessor.processSVGString(VALID_SVG)).rejects.toMatchObject({
        code: 'SVG_LOAD_FAILED',
      });
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it('crossOrigin 옵션을 img.crossOrigin에 설정한다', async () => {
    const img = createControlledImage('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 못한 createElement 호출: ${tagName}`);
    });

    try {
      await SVGProcessor.processSVGString(VALID_SVG, { crossOrigin: 'anonymous' });
    } finally {
      createElementSpy.mockRestore();
    }

    expect(img.crossOrigin).toBe('anonymous');
  });

  it('crossOrigin 옵션 없으면 img.crossOrigin을 변경하지 않는다', async () => {
    const img = createControlledImage('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 못한 createElement 호출: ${tagName}`);
    });

    try {
      await SVGProcessor.processSVGString(VALID_SVG);
    } finally {
      createElementSpy.mockRestore();
    }

    // crossOrigin을 명시하지 않으면 img.crossOrigin은 setAttribute를 호출하지 않으므로 기본값이다.
    expect(img.crossOrigin).toBeFalsy();
  });

  it('normalize 옵션이 false이면 원본 SVG 문자열을 그대로 Blob으로 변환한다', async () => {
    const img = createControlledImage('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 못한 createElement 호출: ${tagName}`);
    });

    try {
      await SVGProcessor.processSVGString(VALID_SVG, { normalize: false });
    } finally {
      createElementSpy.mockRestore();
    }

    // normalize=false 경로도 URL.createObjectURL 까지 정상 도달해야 한다.
    expect(createObjectURLSpy).toHaveBeenCalledWith(expect.any(Blob));
    // Blob 본문이 원본 SVG 문자열과 정확히 일치해야 한다.
    const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
    const blobText = await blob.text();
    expect(blobText).toBe(VALID_SVG);
  });

  // ── 이슈 3: normalize 옵션이 enhanceSvgForBrowser 호출에 실제로 영향을 주는지 검증 ──

  it('normalize: true(기본)이면 enhanceSvgForBrowser를 원본 SVG로 호출한다', async () => {
    const img = createControlledImage('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 못한 createElement 호출: ${tagName}`);
    });

    try {
      await SVGProcessor.processSVGString(VALID_SVG);
    } finally {
      createElementSpy.mockRestore();
    }

    expect(vi.mocked(enhanceSvgForBrowser)).toHaveBeenCalledWith(VALID_SVG);
  });

  it('normalize: false이면 enhanceSvgForBrowser를 호출하지 않는다', async () => {
    const img = createControlledImage('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 못한 createElement 호출: ${tagName}`);
    });

    try {
      await SVGProcessor.processSVGString(VALID_SVG, { normalize: false });
    } finally {
      createElementSpy.mockRestore();
    }

    expect(vi.mocked(enhanceSvgForBrowser)).not.toHaveBeenCalled();
  });

  // ── 이슈 4: img.src에 createObjectURL 결과 URL이 실제로 할당되는지 검증 ──

  it('img.src에 createObjectURL 결과 URL이 할당된다', async () => {
    const img = createControlledImage('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 못한 createElement 호출: ${tagName}`);
    });

    try {
      await SVGProcessor.processSVGString(VALID_SVG);
    } finally {
      createElementSpy.mockRestore();
    }

    expect(img.src).toBe(FAKE_BLOB_URL);
  });

  // ── 이슈 1: defaultWidth/defaultHeight 폴백 분기 검증 ──

  it('크기 없는 SVG에 defaultWidth·defaultHeight가 주어지면 Blob에 그 크기가 반영된다', async () => {
    // enhanceSvgForBrowser가 크기를 추가하지 않도록 원본을 그대로 반환시킨다.
    vi.mocked(enhanceSvgForBrowser).mockReturnValueOnce(SVG_NO_DIMS);

    const img = createControlledImage('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 못한 createElement 호출: ${tagName}`);
    });

    try {
      await SVGProcessor.processSVGString(SVG_NO_DIMS, { defaultWidth: 120, defaultHeight: 80 });
    } finally {
      createElementSpy.mockRestore();
    }

    const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
    const blobText = await blob.text();
    expect(blobText).toContain('width="120"');
    expect(blobText).toContain('height="80"');
  });

  // ── 이슈 2: 일반 예외 → SVG_PROCESSING_FAILED wrap 분기 검증 ──

  it('createObjectURL이 일반 예외를 던지면 SVG_PROCESSING_FAILED 코드로 wrap한다', async () => {
    createObjectURLSpy.mockImplementation(() => {
      throw new Error('Blob URL 생성 실패');
    });

    await expect(SVGProcessor.processSVGString(VALID_SVG)).rejects.toMatchObject({
      code: 'SVG_PROCESSING_FAILED',
    });
  });

  // ── 블로커 2: 크기 있는 SVG + defaultWidth/Height → default 무시 분기 ──

  it('크기 있는 SVG에 defaultWidth·defaultHeight를 주어도 원래 크기가 유지된다', async () => {
    // enhanceSvgForBrowser가 SVG_WITH_WH를 그대로 반환하도록 설정한다.
    vi.mocked(enhanceSvgForBrowser).mockReturnValueOnce(SVG_WITH_WH);

    const img = createControlledImage('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 못한 createElement 호출: ${tagName}`);
    });

    try {
      await SVGProcessor.processSVGString(SVG_WITH_WH, { defaultWidth: 500, defaultHeight: 600 });
    } finally {
      createElementSpy.mockRestore();
    }

    const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
    const blobText = await blob.text();
    // default 크기(500/600)가 Blob에 들어가면 안 된다.
    expect(blobText).not.toContain('width="500"');
    expect(blobText).not.toContain('height="600"');
    // 원래 크기(100)가 그대로 유지돼야 한다.
    expect(blobText).toContain('width="100"');
  });

  // ── 블로커 3: defaultWidth 단독 / defaultHeight 단독 폴백(300) 분기 ──

  it('defaultWidth만 주면 height는 300으로 폴백된다', async () => {
    vi.mocked(enhanceSvgForBrowser).mockReturnValueOnce(SVG_NO_DIMS);

    const img = createControlledImage('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 못한 createElement 호출: ${tagName}`);
    });

    try {
      await SVGProcessor.processSVGString(SVG_NO_DIMS, { defaultWidth: 150 });
    } finally {
      createElementSpy.mockRestore();
    }

    const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
    const blobText = await blob.text();
    expect(blobText).toContain('width="150"');
    expect(blobText).toContain('height="300"');
  });

  it('defaultHeight만 주면 width는 300으로 폴백된다', async () => {
    vi.mocked(enhanceSvgForBrowser).mockReturnValueOnce(SVG_NO_DIMS);

    const img = createControlledImage('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 못한 createElement 호출: ${tagName}`);
    });

    try {
      await SVGProcessor.processSVGString(SVG_NO_DIMS, { defaultHeight: 90 });
    } finally {
      createElementSpy.mockRestore();
    }

    const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
    const blobText = await blob.text();
    expect(blobText).toContain('width="300"');
    expect(blobText).toContain('height="90"');
  });
});
