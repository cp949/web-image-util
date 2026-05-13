import { inspectSvg as inspectSvgFromUtils } from '@cp949/web-image-util/utils';
import { describe, expect, it } from 'vitest';
import { MAX_SVG_BYTES } from '../../../src/core/source-converter/options';
import { ImageProcessError } from '../../../src/errors';
import { inspectSvg } from '../../../src/utils/inspect-svg';

describe('inspectSvg()', () => {
  describe('비문자열 입력 검증', () => {
    it('숫자 입력 시 ImageProcessError를 던진다', () => {
      expect(() => inspectSvg(42 as unknown as string)).toThrow(ImageProcessError);
    });

    it('숫자 입력 시 code가 SVG_INPUT_INVALID다', () => {
      try {
        inspectSvg(42 as unknown as string);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('SVG_INPUT_INVALID');
      }
    });

    it('숫자 입력 시 details.actualType이 "number"다', () => {
      try {
        inspectSvg(42 as unknown as string);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect((e as ImageProcessError).details?.actualType).toBe('number');
      }
    });

    it('undefined 입력 시 ImageProcessError를 던진다', () => {
      expect(() => inspectSvg(undefined as unknown as string)).toThrow(ImageProcessError);
    });

    it('undefined 입력 시 code가 SVG_INPUT_INVALID이고 actualType이 "undefined"다', () => {
      try {
        inspectSvg(undefined as unknown as string);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('SVG_INPUT_INVALID');
        expect((e as ImageProcessError).details?.actualType).toBe('undefined');
      }
    });

    it('null 입력 시 ImageProcessError를 던진다', () => {
      expect(() => inspectSvg(null as unknown as string)).toThrow(ImageProcessError);
    });

    it('null 입력 시 details.actualType이 "null"이다', () => {
      try {
        inspectSvg(null as unknown as string);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('SVG_INPUT_INVALID');
        expect((e as ImageProcessError).details?.actualType).toBe('null');
      }
    });

    it('일반 객체 입력 시 ImageProcessError를 던진다', () => {
      expect(() => inspectSvg({} as unknown as string)).toThrow(ImageProcessError);
    });

    it('일반 객체 입력 시 details.actualType이 "object"다', () => {
      try {
        inspectSvg({} as unknown as string);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('SVG_INPUT_INVALID');
        expect((e as ImageProcessError).details?.actualType).toBe('object');
      }
    });
  });

  describe('정상 문자열 입력', () => {
    it('report.bytes가 UTF-8 바이트 수와 일치한다', () => {
      const input = '<svg></svg>';
      const report = inspectSvg(input);
      const expectedBytes = new TextEncoder().encode(input).length;
      expect(report.bytes).toBe(expectedBytes);
    });

    it('report.byteLimit이 MAX_SVG_BYTES와 같다', () => {
      const report = inspectSvg('<svg></svg>');
      expect(report.byteLimit).toBe(MAX_SVG_BYTES);
    });

    it('report.environment가 허용된 값 중 하나다', () => {
      const report = inspectSvg('<svg></svg>');
      expect(['browser', 'happy-dom', 'node', 'unknown']).toContain(report.environment);
    });
  });

  describe('공개 표면 smoke 테스트', () => {
    it('@cp949/web-image-util/utils에서 inspectSvg를 import해 호출할 수 있다', () => {
      const report = inspectSvgFromUtils('<svg></svg>');
      expect(report).toHaveProperty('valid');
      expect(report).toHaveProperty('findings');
      expect(report).toHaveProperty('recommendation');
    });
  });
});
