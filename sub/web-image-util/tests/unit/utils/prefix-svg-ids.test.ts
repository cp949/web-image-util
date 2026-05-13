import { describe, expect, it } from 'vitest';
import { MAX_SVG_BYTES } from '../../../src/core/source-converter/options';
import { ImageProcessError } from '../../../src/errors';
import { prefixSvgIds } from '../../../src/utils/prefix-svg-ids';
import { extractIds } from './prefix-svg-ids-helpers';

// 책임이 분리된 다른 파일:
// - prefix-svg-ids-deopt.test.ts          → deopt 분기 (파싱 실패/DOMParser/style/XMLSerializer/byte)
// - prefix-svg-ids-id-rewrite.test.ts     → id rewrite 변형 (단일/다중/idempotent/collision)
// - prefix-svg-ids-reference-rewrite.test.ts → fragment reference rewrite 변형
// - prefix-svg-ids-leakage.test.ts        → 보고서 누출 방지 회귀

const SIMPLE_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><circle id="c1" r="10"/></svg>';

describe('prefixSvgIds() — 입력 계약과 환경 메타', () => {
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

    it('jsdom 환경에서 environment가 "browser"이다', () => {
      // 이 파일은 jsdom config로 실행된다. 라이브러리 환경 감지기는 jsdom을 일반 브라우저로 인식한다.
      const result = prefixSvgIds(SIMPLE_SVG, 'pfx');
      expect(result.report.environment).toBe('browser');
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
