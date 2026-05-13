import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_SVG_BYTES } from '../../../src/core/source-converter/options';
import { ImageProcessError } from '../../../src/errors';
import { prefixSvgIds } from '../../../src/utils/prefix-svg-ids';

const SIMPLE_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><circle id="c1" r="10"/></svg>';

describe('prefixSvgIds()', () => {
  describe('비문자열 svgString 검증', () => {
    it('숫자 입력 시 ImageProcessError를 던진다', () => {
      expect(() => prefixSvgIds(42 as unknown as string, 'pfx')).toThrow(ImageProcessError);
    });

    it('숫자 입력 시 code가 SVG_INPUT_INVALID이고 actualType이 "number"다', () => {
      try {
        prefixSvgIds(42 as unknown as string, 'pfx');
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('SVG_INPUT_INVALID');
        expect((e as ImageProcessError).details?.actualType).toBe('number');
      }
    });

    it('undefined 입력 시 ImageProcessError를 던진다', () => {
      expect(() => prefixSvgIds(undefined as unknown as string, 'pfx')).toThrow(ImageProcessError);
    });

    it('undefined 입력 시 code가 SVG_INPUT_INVALID이고 actualType이 "undefined"다', () => {
      try {
        prefixSvgIds(undefined as unknown as string, 'pfx');
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('SVG_INPUT_INVALID');
        expect((e as ImageProcessError).details?.actualType).toBe('undefined');
      }
    });

    it('null 입력 시 ImageProcessError를 던진다', () => {
      expect(() => prefixSvgIds(null as unknown as string, 'pfx')).toThrow(ImageProcessError);
    });

    it('null 입력 시 code가 SVG_INPUT_INVALID이고 actualType이 "null"이다', () => {
      try {
        prefixSvgIds(null as unknown as string, 'pfx');
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('SVG_INPUT_INVALID');
        expect((e as ImageProcessError).details?.actualType).toBe('null');
      }
    });

    it('일반 객체 입력 시 ImageProcessError를 던진다', () => {
      expect(() => prefixSvgIds({} as unknown as string, 'pfx')).toThrow(ImageProcessError);
    });

    it('일반 객체 입력 시 code가 SVG_INPUT_INVALID이고 actualType이 "object"다', () => {
      try {
        prefixSvgIds({} as unknown as string, 'pfx');
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('SVG_INPUT_INVALID');
        expect((e as ImageProcessError).details?.actualType).toBe('object');
      }
    });
  });

  describe('비문자열 prefix 검증', () => {
    it('숫자 prefix 시 ImageProcessError를 던진다', () => {
      expect(() => prefixSvgIds(SIMPLE_SVG, 42 as unknown as string)).toThrow(ImageProcessError);
    });

    it('숫자 prefix 시 code가 OPTION_INVALID이고 option이 "prefix"이며 actualType이 "number"다', () => {
      try {
        prefixSvgIds(SIMPLE_SVG, 42 as unknown as string);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('OPTION_INVALID');
        expect((e as ImageProcessError).details?.option).toBe('prefix');
        expect((e as ImageProcessError).details?.actualType).toBe('number');
      }
    });

    it('undefined prefix 시 code가 OPTION_INVALID이고 actualType이 "undefined"다', () => {
      try {
        prefixSvgIds(SIMPLE_SVG, undefined as unknown as string);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('OPTION_INVALID');
        expect((e as ImageProcessError).details?.option).toBe('prefix');
        expect((e as ImageProcessError).details?.actualType).toBe('undefined');
      }
    });

    it('null prefix 시 code가 OPTION_INVALID이고 actualType이 "null"이다', () => {
      try {
        prefixSvgIds(SIMPLE_SVG, null as unknown as string);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('OPTION_INVALID');
        expect((e as ImageProcessError).details?.option).toBe('prefix');
        expect((e as ImageProcessError).details?.actualType).toBe('null');
      }
    });
  });

  describe('잘못된 prefix 형식 검증', () => {
    it('빈 문자열 prefix 시 ImageProcessError를 던진다', () => {
      expect(() => prefixSvgIds(SIMPLE_SVG, '')).toThrow(ImageProcessError);
    });

    it('빈 문자열 prefix 시 code가 OPTION_INVALID이고 reason이 "invalid-format"이다', () => {
      try {
        prefixSvgIds(SIMPLE_SVG, '');
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('OPTION_INVALID');
        expect((e as ImageProcessError).details?.reason).toBe('invalid-format');
      }
    });

    it('숫자로 시작하는 prefix("1foo") 시 reason이 "invalid-format"이다', () => {
      try {
        prefixSvgIds(SIMPLE_SVG, '1foo');
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('OPTION_INVALID');
        expect((e as ImageProcessError).details?.reason).toBe('invalid-format');
      }
    });

    it('점이 포함된 prefix("foo.bar") 시 reason이 "invalid-format"이다', () => {
      try {
        prefixSvgIds(SIMPLE_SVG, 'foo.bar');
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('OPTION_INVALID');
        expect((e as ImageProcessError).details?.reason).toBe('invalid-format');
      }
    });

    it('콜론이 포함된 prefix("foo:bar") 시 reason이 "invalid-format"이다', () => {
      try {
        prefixSvgIds(SIMPLE_SVG, 'foo:bar');
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('OPTION_INVALID');
        expect((e as ImageProcessError).details?.reason).toBe('invalid-format');
      }
    });

    it('65자 prefix 시 reason이 "invalid-format"이다', () => {
      // 첫 글자 영문자 + 64자 = 65자
      const longPrefix = `a${'b'.repeat(64)}`;
      expect(longPrefix.length).toBe(65);
      try {
        prefixSvgIds(SIMPLE_SVG, longPrefix);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('OPTION_INVALID');
        expect((e as ImageProcessError).details?.reason).toBe('invalid-format');
      }
    });
  });

  describe('정상 입력 — bytes/byteLimit/environment 단정', () => {
    it('정상 SVG 입력의 bytes가 실제 UTF-8 바이트 수와 일치한다', () => {
      const result = prefixSvgIds(SIMPLE_SVG, 'pfx');
      const expected = new TextEncoder().encode(SIMPLE_SVG).byteLength;
      expect(result.report.bytes).toBe(expected);
    });

    it('정상 SVG 입력의 byteLimit이 MAX_SVG_BYTES와 같다', () => {
      const result = prefixSvgIds(SIMPLE_SVG, 'pfx');
      expect(result.report.byteLimit).toBe(MAX_SVG_BYTES);
    });

    it('environment가 허용된 값 중 하나다', () => {
      const result = prefixSvgIds(SIMPLE_SVG, 'pfx');
      expect(['browser', 'happy-dom', 'node', 'unknown']).toContain(result.report.environment);
    });

    it('happy-dom 환경에서 environment가 "happy-dom"이다', () => {
      // Vitest 기본 실행 환경이 happy-dom이므로 이 테스트는 그대로 통과해야 한다
      const result = prefixSvgIds(SIMPLE_SVG, 'pfx');
      expect(result.report.environment).toBe('happy-dom');
    });
  });

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

  describe('정상 SVG 입력 — deopt 없는 응답', () => {
    it('정상 SVG 입력 시 deoptimized가 false다', () => {
      const result = prefixSvgIds('<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/></svg>', 'pfx');
      expect(result.report.deoptimized).toBe(false);
    });

    it('정상 SVG 입력 시 deoptReasons가 빈 배열이다', () => {
      const result = prefixSvgIds('<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/></svg>', 'pfx');
      expect(result.report.deoptReasons).toEqual([]);
    });

    it('정상 SVG 입력 시 warnings가 빈 배열이다', () => {
      const result = prefixSvgIds('<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/></svg>', 'pfx');
      expect(result.report.warnings).toEqual([]);
    });
  });

  /** 결과 svg를 DOMParser로 재파싱해 id 목록을 반환하는 헬퍼. */
  function extractIds(svgString: string): string[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const all = doc.getElementsByTagName('*');
    const ids: string[] = [];
    for (let i = 0; i < all.length; i++) {
      const id = all[i].getAttribute('id');
      if (id !== null && id !== '') ids.push(id);
    }
    return ids;
  }

  /** report 객체의 모든 string 값을 재귀 순회해 수집하는 헬퍼. */
  function collectReportStrings(obj: unknown, results: string[] = []): string[] {
    if (typeof obj === 'string') {
      results.push(obj);
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        collectReportStrings(item, results);
      }
    } else if (obj !== null && typeof obj === 'object') {
      for (const value of Object.values(obj as Record<string, unknown>)) {
        collectReportStrings(value, results);
      }
    }
    return results;
  }

  describe('ID rewrite — 단일 id', () => {
    it('단일 id 입력 시 prefixedIdCount가 1이다', () => {
      const result = prefixSvgIds('<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/></svg>', 'p');
      expect(result.report.prefixedIdCount).toBe(1);
    });

    it('단일 id 입력 시 결과 svg에 "p-a" id 요소가 존재한다', () => {
      const result = prefixSvgIds('<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/></svg>', 'p');
      const ids = extractIds(result.svg);
      expect(ids).toContain('p-a');
    });

    it('단일 id 입력 시 결과 svg에 원본 "a" id가 없다', () => {
      const result = prefixSvgIds('<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/></svg>', 'p');
      const ids = extractIds(result.svg);
      expect(ids).not.toContain('a');
    });
  });

  describe('ID rewrite — 다중 id', () => {
    it('다중 id 입력 시 prefixedIdCount가 3이다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><g id="b"><circle id="c"/></g></svg>';
      const result = prefixSvgIds(input, 'p');
      expect(result.report.prefixedIdCount).toBe(3);
    });

    it('다중 id 입력 시 결과 svg에 세 id 모두 prefix 적용된다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><g id="b"><circle id="c"/></g></svg>';
      const result = prefixSvgIds(input, 'p');
      const ids = extractIds(result.svg);
      expect(ids).toContain('p-a');
      expect(ids).toContain('p-b');
      expect(ids).toContain('p-c');
    });
  });

  describe('ID rewrite — idempotent', () => {
    it('이미 prefix 적용된 id 입력 시 prefixedIdCount가 0이다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="p-a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      expect(result.report.prefixedIdCount).toBe(0);
    });

    it('이미 prefix 적용된 id 입력 시 warnings에 "id-rewrite-skipped-idempotent" (count=1) 포함', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="p-a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const w = result.report.warnings.find((w) => w.code === 'id-rewrite-skipped-idempotent');
      expect(w).toBeDefined();
      expect(w?.count).toBe(1);
    });

    it('이미 prefix 적용된 id 입력 시 결과 svg의 id는 원본 그대로다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="p-a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const ids = extractIds(result.svg);
      expect(ids).toContain('p-a');
    });

    it('같은 prefix로 두 번 호출 시 두 번째 결과 id 분포가 첫 번째와 동등하다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/></svg>';
      const first = prefixSvgIds(input, 'p');
      const second = prefixSvgIds(first.svg, 'p');
      const ids1 = extractIds(first.svg).sort();
      const ids2 = extractIds(second.svg).sort();
      expect(ids1).toEqual(ids2);
    });
  });

  describe('ID rewrite — collision', () => {
    it('기존 id와 collision 시 충돌 id rewrite 생략하고 prefixedIdCount는 충돌 제외 수다', () => {
      // id="a" → "p-a"가 기존 id="p-a"와 충돌. "a" rewrite 생략.
      // id="p-a"는 idempotent로 분류.
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><circle id="p-a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      expect(result.report.prefixedIdCount).toBe(0);
    });

    it('collision 시 warnings에 "id-rewrite-skipped-collision" (count=1) 포함', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><circle id="p-a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const w = result.report.warnings.find((w) => w.code === 'id-rewrite-skipped-collision');
      expect(w).toBeDefined();
      expect(w?.count).toBe(1);
    });

    it('collision 시 두 id 모두 결과 svg에 보존된다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><circle id="p-a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const ids = extractIds(result.svg);
      expect(ids).toContain('a');
      expect(ids).toContain('p-a');
    });
  });

  describe('ID rewrite — 빈 id 속성 제외', () => {
    it('빈 id 속성 입력 시 prefixedIdCount가 0이다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id=""/></svg>';
      const result = prefixSvgIds(input, 'p');
      expect(result.report.prefixedIdCount).toBe(0);
    });
  });

  describe('ID rewrite — 비정상 입력(중복 id)', () => {
    // 같은 id를 가진 두 요소가 한 doc에 있는 비정상 입력. 명세 D12: "1개만 적용, 1개는 collision".
    // 명세는 회귀 테스트 필수 항목이 아니라 권장 사항으로 둔다(input 무결성 의존).
    const DUP_INPUT = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><circle id="a"/></svg>';

    it('중복 id 입력 시 prefixedIdCount가 1이다', () => {
      const result = prefixSvgIds(DUP_INPUT, 'p');
      expect(result.report.prefixedIdCount).toBe(1);
    });

    it('중복 id 입력 시 warnings에 "id-rewrite-skipped-collision" (count=1) 포함', () => {
      const result = prefixSvgIds(DUP_INPUT, 'p');
      const w = result.report.warnings.find((w) => w.code === 'id-rewrite-skipped-collision');
      expect(w).toBeDefined();
      expect(w?.count).toBe(1);
    });

    it('중복 id 입력 시 결과 svg에 "p-a"와 "a"가 공존한다', () => {
      const result = prefixSvgIds(DUP_INPUT, 'p');
      const ids = extractIds(result.svg);
      expect(ids).toContain('p-a');
      expect(ids).toContain('a');
    });
  });

  describe('fragment reference rewrite — 내부 href', () => {
    it('href="#a"를 가진 use 요소 입력 시 rewrittenReferenceCount가 1이다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><use href="#a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      expect(result.report.rewrittenReferenceCount).toBe(1);
    });

    it('href="#a"는 "#p-a"로 rewrite된다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><use href="#a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const doc = new DOMParser().parseFromString(result.svg, 'image/svg+xml');
      expect(doc.getElementsByTagName('use')[0].getAttribute('href')).toBe('#p-a');
    });

    it('href="#a"와 함께 rect id도 "p-a"로 rewrite된다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><use href="#a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const ids = extractIds(result.svg);
      expect(ids).toContain('p-a');
    });
  });

  describe('fragment reference rewrite — xlink:href', () => {
    it('xlink:href="#a"를 "#p-a"로 rewrite한다', () => {
      const XLINK = 'http://www.w3.org/1999/xlink';
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
        '<rect id="a"/><use xlink:href="#a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const doc = new DOMParser().parseFromString(result.svg, 'image/svg+xml');
      expect(doc.getElementsByTagName('use')[0].getAttributeNS(XLINK, 'href')).toBe('#p-a');
    });
  });

  describe('fragment reference rewrite — dangling', () => {
    it('dangling href="#missing"는 rewrite 없이 원본 유지', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><use href="#missing"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const doc = new DOMParser().parseFromString(result.svg, 'image/svg+xml');
      expect(doc.getElementsByTagName('use')[0].getAttribute('href')).toBe('#missing');
    });

    it('dangling ref 시 warnings에 reference-skipped-dangling (count=1) 포함', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><use href="#missing"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const w = result.report.warnings.find((w) => w.code === 'reference-skipped-dangling');
      expect(w).toBeDefined();
      expect(w?.count).toBe(1);
    });
  });

  describe('fragment reference rewrite — external sprite', () => {
    it('external href="sprite.svg#frag"는 rewrite 없이 원본 유지', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><use href="sprite.svg#frag"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const doc = new DOMParser().parseFromString(result.svg, 'image/svg+xml');
      expect(doc.getElementsByTagName('use')[0].getAttribute('href')).toBe('sprite.svg#frag');
    });

    it('external sprite 시 warnings에 reference-skipped-external (count=1) 포함', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><use href="sprite.svg#frag"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const w = result.report.warnings.find((w) => w.code === 'reference-skipped-external');
      expect(w).toBeDefined();
      expect(w?.count).toBe(1);
    });
  });

  describe('fragment reference rewrite — 비fragment 값', () => {
    it('href="http://example.com"은 warning 없음, rewrite 없음', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><a href="http://example.com"/></svg>';
      const result = prefixSvgIds(input, 'p');
      expect(result.report.rewrittenReferenceCount).toBe(0);
      const hasRefWarning = result.report.warnings.some(
        (w) => w.code === 'reference-skipped-dangling' || w.code === 'reference-skipped-external'
      );
      expect(hasRefWarning).toBe(false);
    });

    it('src="data:image/png;base64,..." 는 warning 없음, rewrite 없음', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><image src="data:image/png;base64,abc"/></svg>';
      const result = prefixSvgIds(input, 'p');
      expect(result.report.rewrittenReferenceCount).toBe(0);
      const hasRefWarning = result.report.warnings.some(
        (w) => w.code === 'reference-skipped-dangling' || w.code === 'reference-skipped-external'
      );
      expect(hasRefWarning).toBe(false);
    });
  });

  describe('fragment reference rewrite — 다중 참조', () => {
    it('같은 id를 가리키는 href attribute 3개는 rewrittenReferenceCount가 3이다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/>' +
        '<use href="#a"/><use href="#a"/><use href="#a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      expect(result.report.rewrittenReferenceCount).toBe(3);
    });
  });

  describe('fragment reference rewrite — idempotent id의 fragment ref', () => {
    it('idempotent id를 가리키는 href="#p-a"는 rewrite 없음, rewrittenReferenceCount가 0이다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="p-a"/><use href="#p-a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      expect(result.report.rewrittenReferenceCount).toBe(0);
    });

    it('idempotent id의 fragment ref는 reference 측 warning 없음', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="p-a"/><use href="#p-a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const hasRefWarning = result.report.warnings.some(
        (w) => w.code === 'reference-skipped-dangling' || w.code === 'reference-skipped-external'
      );
      expect(hasRefWarning).toBe(false);
    });

    it('idempotent id의 fragment ref 시 id-rewrite-skipped-idempotent warning은 존재한다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="p-a"/><use href="#p-a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const w = result.report.warnings.find((w) => w.code === 'id-rewrite-skipped-idempotent');
      expect(w).toBeDefined();
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

  describe('보고서 누출 방지 회귀', () => {
    const sentinelHost = 'leak-canary-prefix.example.com';
    const sentinelDataUrl = 'data:image/svg+xml;base64,LEAK_CANARY_PREFIX_PAYLOAD';
    const sentinelDanglingFragment = 'leak-canary-dangling-token';
    const sentinelExternalRef = `sprite.svg#leak-canary-external-token`;
    const sentinels = [
      sentinelHost,
      sentinelDataUrl,
      sentinelDanglingFragment,
      sentinelExternalRef,
      'LEAK_CANARY_PREFIX_PAYLOAD',
      'leak-canary-dangling',
      'leak-canary-external',
    ];

    const dangerousSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
          <rect id="real-id"/>
          <use xlink:href="#${sentinelDanglingFragment}"/>
          <use href="${sentinelExternalRef}"/>
          <a href="http://${sentinelHost}/page"/>
          <image href="${sentinelDataUrl}"/>
        </svg>
      `;

    it('report JSON에 sentinel 7종이 포함되지 않는다', () => {
      const result = prefixSvgIds(dangerousSvg, 'safe');
      const reportJson = JSON.stringify(result.report);
      for (const sentinel of sentinels) {
        expect(reportJson, `sentinel "${sentinel}"이 report JSON에 포함됨`).not.toContain(sentinel);
      }
    });

    it('report의 모든 string 값에 sentinel substring이 없다', () => {
      const result = prefixSvgIds(dangerousSvg, 'safe');
      const strings = collectReportStrings(result.report);
      for (const sentinel of sentinels) {
        for (const str of strings) {
          expect(str, `report string "${str}"에 sentinel "${sentinel}"이 포함됨`).not.toContain(sentinel);
        }
      }
    });
  });

  describe('보조 경계 회귀', () => {
    it('같은 prefix로 두 번 호출 시 두 번째 결과 svg의 id 분포가 첫 번째와 동등하다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><use href="#a"/></svg>';
      const first = prefixSvgIds(input, 'safe');
      const second = prefixSvgIds(first.svg, 'safe');
      const ids1 = extractIds(first.svg).sort();
      const ids2 = extractIds(second.svg).sort();
      expect(ids2).toEqual(ids1);
    });

    it('style 속성 입력 시 id와 reference를 변환하지 않고 deoptimized: true로 분기한다(D5 잠금)', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a" style="fill:red"/><use href="#a"/></svg>';
      const result = prefixSvgIds(input, 'safe');
      expect(result.report.deoptimized).toBe(true);
      expect(result.report.prefixedIdCount).toBe(0);
      expect(result.report.rewrittenReferenceCount).toBe(0);
    });
  });
});
