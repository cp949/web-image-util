/**
 * SVG 길이 파싱 프리미티브(parseSvgLength / parseViewBoxValues)를 직접 검증한다.
 *
 * 이 leaf는 extractSvgDimensions · readInspectDimensions · applyViewBoxPolicy
 * 세 소비자가 공유하므로, 여기의 커버리지가 곧 세 경로의 커버리지다.
 */

import { describe, expect, it } from 'vitest';

import {
  hasWhitespaceBeforeSvgLengthUnit,
  parseSvgLength,
  parseViewBoxValues,
} from '../../../src/utils/svg-length.internal';

describe('parseSvgLength()', () => {
  describe('빈 입력', () => {
    it('null·undefined·빈 문자열은 value·unit 모두 null이다', () => {
      expect(parseSvgLength(undefined)).toEqual({ value: null, unit: null });
      expect(parseSvgLength(null)).toEqual({ value: null, unit: null });
      expect(parseSvgLength('')).toEqual({ value: null, unit: null });
    });
  });

  describe('단위', () => {
    it('단위 없는 숫자는 user unit(unit=null)으로 본다', () => {
      expect(parseSvgLength('100')).toEqual({ value: 100, unit: null });
    });

    it('단위는 소문자로 정규화한다', () => {
      expect(parseSvgLength('100PX')).toEqual({ value: 100, unit: 'px' });
      expect(parseSvgLength('2em')).toEqual({ value: 2, unit: 'em' });
      expect(parseSvgLength('50%')).toEqual({ value: 50, unit: '%' });
    });

    it('숫자와 단위 사이 공백을 허용한다', () => {
      expect(parseSvgLength('100 px')).toEqual({ value: 100, unit: 'px' });
    });

    it('앞뒤 공백을 제거한다', () => {
      expect(parseSvgLength('  100px  ')).toEqual({ value: 100, unit: 'px' });
    });
  });

  describe('숫자 형식', () => {
    it('음수를 받아들인다', () => {
      expect(parseSvgLength('-50')).toEqual({ value: -50, unit: null });
    });

    it('소수를 받아들인다', () => {
      expect(parseSvgLength('12.5px')).toEqual({ value: 12.5, unit: 'px' });
    });

    it('선행 0이 없는 소수와 양의 부호를 받아들인다', () => {
      expect(parseSvgLength('.5px')).toEqual({ value: 0.5, unit: 'px' });
      expect(parseSvgLength('+5')).toEqual({ value: 5, unit: null });
    });

    it('지수 표기를 받아들인다', () => {
      expect(parseSvgLength('-1.5e-3')).toEqual({ value: -0.0015, unit: null });
      expect(parseSvgLength('1e+3')).toEqual({ value: 1000, unit: null });
      expect(parseSvgLength('1E3')).toEqual({ value: 1000, unit: null });
    });
  });

  describe('거부', () => {
    it('형식에 맞지 않는 문자열은 null을 반환한다', () => {
      expect(parseSvgLength('abc')).toEqual({ value: null, unit: null });
      expect(parseSvgLength('10 20')).toEqual({ value: null, unit: null });
      expect(parseSvgLength('100px!')).toEqual({ value: null, unit: null });
    });

    it('유한값이 아닌 결과(예: 1e999)는 null로 보정한다', () => {
      expect(parseSvgLength('1e999')).toEqual({ value: null, unit: null });
    });
  });
});

describe('hasWhitespaceBeforeSvgLengthUnit()', () => {
  it('숫자와 단위 사이의 공백만 감지한다', () => {
    expect(hasWhitespaceBeforeSvgLengthUnit('100 px')).toBe(true);
    expect(hasWhitespaceBeforeSvgLengthUnit('100px')).toBe(false);
    expect(hasWhitespaceBeforeSvgLengthUnit('100')).toBe(false);
    expect(hasWhitespaceBeforeSvgLengthUnit('invalid')).toBe(false);
  });
});

describe('parseViewBoxValues()', () => {
  describe('구분자', () => {
    it('공백 구분자를 파싱한다', () => {
      expect(parseViewBoxValues('0 0 300 150')).toEqual({ x: 0, y: 0, width: 300, height: 150 });
    });

    it('콤마 구분자를 파싱한다', () => {
      expect(parseViewBoxValues('0,0,300,150')).toEqual({ x: 0, y: 0, width: 300, height: 150 });
    });

    it('콤마와 공백을 혼용해도 파싱한다', () => {
      expect(parseViewBoxValues('0, 0, 300, 150')).toEqual({ x: 0, y: 0, width: 300, height: 150 });
    });

    it('앞뒤 공백을 제거한다', () => {
      expect(parseViewBoxValues('  0 0 300 150 ')).toEqual({ x: 0, y: 0, width: 300, height: 150 });
    });
  });

  describe('값 형식', () => {
    it('음수 min-x·min-y를 받아들인다', () => {
      expect(parseViewBoxValues('-10 -20 300 150')).toEqual({ x: -10, y: -20, width: 300, height: 150 });
    });

    it('소수를 받아들인다', () => {
      expect(parseViewBoxValues('0 0 12.5 7.5')).toEqual({ x: 0, y: 0, width: 12.5, height: 7.5 });
    });

    it('선행 0이 없는 소수와 양의 부호를 받아들인다', () => {
      expect(parseViewBoxValues('+.5 -.5 +12.5 7.5')).toEqual({ x: 0.5, y: -0.5, width: 12.5, height: 7.5 });
    });
  });

  describe('거부', () => {
    it('null·undefined·빈 문자열은 null을 반환한다', () => {
      expect(parseViewBoxValues(undefined)).toBeNull();
      expect(parseViewBoxValues(null)).toBeNull();
      expect(parseViewBoxValues('')).toBeNull();
    });

    it('값이 4개가 아니면 null을 반환한다', () => {
      expect(parseViewBoxValues('0 0 100')).toBeNull();
      expect(parseViewBoxValues('0 0 100 100 100')).toBeNull();
    });

    it('숫자가 아닌 값이 섞이면 null을 반환한다', () => {
      expect(parseViewBoxValues('invalid')).toBeNull();
      expect(parseViewBoxValues('0 0 abc 150')).toBeNull();
    });

    it('SVG 숫자 문법이 아닌 16진수와 중복 콤마를 거부한다', () => {
      expect(parseViewBoxValues('0 0 0x10 150')).toBeNull();
      expect(parseViewBoxValues('0,,0,300,150')).toBeNull();
    });

    it('유한값이 아닌 값은 거부한다', () => {
      expect(parseViewBoxValues('0 0 Infinity 150')).toBeNull();
    });
  });
});
