import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_SVG_BYTES } from '../../../src/core/source-converter/options';
import { prefixSvgIds } from '../../../src/utils/prefix-svg-ids';

// 본문 inline fixture로 한정한다. 한 파일에서만 쓰는 짧은 SVG는 helper로 빼지 않는다.
const SIMPLE_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><circle id="c1" r="10"/></svg>';

describe('prefixSvgIds() — deopt 분기', () => {
  describe('파싱 실패 deopt', () => {
    it('잘못된 SVG 입력 시 throw 없이 반환한다', () => {
      expect(() => prefixSvgIds('<not-svg>broken', 'pfx')).not.toThrow();
    });

    it('잘못된 SVG 입력 시 result.svg가 입력 원본과 동일하다', () => {
      const input = '<not-svg>broken';
      const result = prefixSvgIds(input, 'pfx');
      expect(result.svg).toBe(input);
    });

    it('잘못된 SVG 입력 시 deoptimized가 true다', () => {
      const result = prefixSvgIds('<not-svg>broken', 'pfx');
      expect(result.report.deoptimized).toBe(true);
    });

    it('잘못된 SVG 입력 시 deoptReasons에 "parse-failed"가 포함된다', () => {
      const result = prefixSvgIds('<not-svg>broken', 'pfx');
      expect(result.report.deoptReasons).toContain('parse-failed');
    });

    it('root가 svg가 아닌 정상 XML 입력 시 "parse-failed" deopt를 반환한다', () => {
      const result = prefixSvgIds('<html xmlns="http://www.w3.org/1999/xhtml"></html>', 'pfx');
      expect(result.report.deoptimized).toBe(true);
      expect(result.report.deoptReasons).toContain('parse-failed');
    });
  });

  describe('DOMParser 미가용 deopt', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('DOMParser가 undefined이면 "domparser-unavailable" deopt를 반환한다', () => {
      vi.stubGlobal('DOMParser', undefined);
      const result = prefixSvgIds(SIMPLE_SVG, 'pfx');
      expect(result.report.deoptimized).toBe(true);
      expect(result.report.deoptReasons).toContain('domparser-unavailable');
    });

    it('DOMParser 미가용 시 svg가 입력 원본과 동일하다', () => {
      vi.stubGlobal('DOMParser', undefined);
      const result = prefixSvgIds(SIMPLE_SVG, 'pfx');
      expect(result.svg).toBe(SIMPLE_SVG);
    });
  });

  describe('style deopt', () => {
    it('<style> 요소 입력 시 "style-tag-present" deopt를 반환한다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><style>rect{fill:red}</style></svg>';
      const result = prefixSvgIds(input, 'pfx');
      expect(result.report.deoptimized).toBe(true);
      expect(result.report.deoptReasons).toContain('style-tag-present');
    });

    it('<style> 요소 입력 시 svg가 입력 원본과 동일하다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><style>rect{fill:red}</style></svg>';
      const result = prefixSvgIds(input, 'pfx');
      expect(result.svg).toBe(input);
    });

    it('style 속성 입력 시 "style-attribute-present" deopt를 반환한다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:red"/></svg>';
      const result = prefixSvgIds(input, 'pfx');
      expect(result.report.deoptimized).toBe(true);
      expect(result.report.deoptReasons).toContain('style-attribute-present');
    });

    it('style 속성 입력 시 svg가 입력 원본과 동일하다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:red"/></svg>';
      const result = prefixSvgIds(input, 'pfx');
      expect(result.svg).toBe(input);
    });

    it('<style> 요소와 style 속성이 동시에 있으면 두 사유 모두 deoptReasons에 포함된다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><style>rect{fill:red}</style><rect style="fill:blue"/></svg>';
      const result = prefixSvgIds(input, 'pfx');
      expect(result.report.deoptimized).toBe(true);
      expect(result.report.deoptReasons).toContain('style-tag-present');
      expect(result.report.deoptReasons).toContain('style-attribute-present');
    });
  });

  describe('XMLSerializer 실패 deopt', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('XMLSerializer.serializeToString이 throw하면 "parse-failed" deopt를 반환한다', () => {
      vi.stubGlobal(
        'XMLSerializer',
        class {
          serializeToString() {
            throw new Error('xs failed');
          }
        }
      );
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      expect(result.report.deoptimized).toBe(true);
      expect(result.report.deoptReasons).toContain('parse-failed');
    });

    it('XMLSerializer 실패 시 svg가 입력 원본과 동일하다', () => {
      vi.stubGlobal(
        'XMLSerializer',
        class {
          serializeToString() {
            throw new Error('xs failed');
          }
        }
      );
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      expect(result.svg).toBe(input);
    });
  });

  describe('byte 초과 deopt', () => {
    it('MAX_SVG_BYTES+1 입력 시 throw 없이 반환한다', () => {
      const bigInput = 'a'.repeat(MAX_SVG_BYTES + 1);
      expect(() => prefixSvgIds(bigInput, 'pfx')).not.toThrow();
    });

    it('byte 초과 시 deoptimized가 true다', () => {
      const bigInput = 'a'.repeat(MAX_SVG_BYTES + 1);
      const result = prefixSvgIds(bigInput, 'pfx');
      expect(result.report.deoptimized).toBe(true);
    });

    it('byte 초과 시 deoptReasons에 "byte-limit-exceeded"가 포함된다', () => {
      const bigInput = 'a'.repeat(MAX_SVG_BYTES + 1);
      const result = prefixSvgIds(bigInput, 'pfx');
      expect(result.report.deoptReasons).toContain('byte-limit-exceeded');
    });

    it('byte 초과 시 result.svg가 입력 원본과 동일하다', () => {
      const bigInput = 'a'.repeat(MAX_SVG_BYTES + 1);
      const result = prefixSvgIds(bigInput, 'pfx');
      expect(result.svg).toBe(bigInput);
    });
  });
});
