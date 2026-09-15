/**
 * box-config 단위 테스트
 *
 * validateBoxOptions(호출 시점 구조 검증)와 normalizeBoxOptions(기본값 정규화),
 * isValidCssColor(스크래치 캔버스 기반 색 유효성 검사)를 검증한다.
 * radius의 % → px 해석과 CSS 겹침 축소는 box-calculator 테스트가 담당한다
 * (여기서는 radius의 "형태"만 검증하고 실제 픽셀 값으로 변환하지 않는다).
 */

import { describe, expect, it } from 'vitest';
import { ImageProcessError } from '../../../src/errors.internal';
import {
  type BoxOptions,
  isValidCssColor,
  normalizeBoxOptions,
  validateBoxOptions,
} from '../../../src/types/box-config';

function expectOptionInvalid(fn: () => void, option?: string): void {
  try {
    fn();
    expect.fail('ImageProcessError가 발생해야 한다');
  } catch (error) {
    expect(error).toBeInstanceOf(ImageProcessError);
    if (error instanceof ImageProcessError) {
      expect(error.code).toBe('OPTION_INVALID');
      if (option !== undefined) {
        expect(error.details?.option).toBe(option);
      }
    }
  }
}

describe('isValidCssColor — 스크래치 캔버스 기반 색 유효성 검사', () => {
  // CSS Level 1/2 형식만 쓴다 — hsl()이나 8자리 hex(#RRGGBBAA) 같은 최신 문법은
  // node-canvas(cairo 기반)의 실제 지원 여부가 불확실해 환경에 따라 거짓 실패할 수 있다.
  it.each(['#fff', '#ffffff', 'red', 'blue', 'rgba(0, 0, 0, 0.5)', 'rgb(255, 0, 0)', 'transparent'])(
    '%s는 유효한 CSS 색이다',
    (color) => {
      expect(isValidCssColor(color)).toBe(true);
    }
  );

  it.each(['not-a-color', '', '#12', '#gggggg', 'rgb(это не число)', 'hsl(bad)'])(
    '%s는 유효하지 않은 CSS 색이다',
    (color) => {
      expect(isValidCssColor(color)).toBe(false);
    }
  );
});

describe('validateBoxOptions — 호출 시점 검증', () => {
  it('빈 객체는 유효하다 (no-op)', () => {
    expect(() => validateBoxOptions({})).not.toThrow();
  });

  it('모든 필드가 채워진 정상 옵션은 통과한다', () => {
    const options: BoxOptions = {
      padding: 4,
      background: '#ffffff',
      radius: '50%',
      border: { width: 2, color: '#333333', inset: true },
    };
    expect(() => validateBoxOptions(options)).not.toThrow();
  });

  it('객체가 아닌 입력은 OPTION_INVALID (option: box)', () => {
    expectOptionInvalid(() => validateBoxOptions(null as unknown as BoxOptions), 'box');
    expectOptionInvalid(() => validateBoxOptions('x' as unknown as BoxOptions), 'box');
  });

  describe('padding', () => {
    it('음수 숫자 padding은 OPTION_INVALID (option: padding)', () => {
      expectOptionInvalid(() => validateBoxOptions({ padding: -1 }), 'padding');
    });

    it('비유한수 padding은 OPTION_INVALID', () => {
      expectOptionInvalid(() => validateBoxOptions({ padding: Number.NaN }), 'padding');
      expectOptionInvalid(() => validateBoxOptions({ padding: Number.POSITIVE_INFINITY }), 'padding');
    });

    it('객체 padding 중 한 방향이라도 음수면 OPTION_INVALID', () => {
      expectOptionInvalid(() => validateBoxOptions({ padding: { top: 10, left: -5 } }), 'padding');
    });

    it('0과 양수 padding은 통과한다', () => {
      expect(() => validateBoxOptions({ padding: 0 })).not.toThrow();
      expect(() => validateBoxOptions({ padding: { top: 1, right: 2, bottom: 3, left: 4 } })).not.toThrow();
    });
  });

  describe('background', () => {
    it('유효하지 않은 CSS 색은 OPTION_INVALID (option: background)', () => {
      expectOptionInvalid(() => validateBoxOptions({ background: 'not-a-color' }), 'background');
    });

    it('유효한 CSS 색은 통과한다', () => {
      expect(() => validateBoxOptions({ background: '#fff' })).not.toThrow();
    });
  });

  describe('radius', () => {
    it('음수 숫자는 OPTION_INVALID (option: radius)', () => {
      expectOptionInvalid(() => validateBoxOptions({ radius: -10 }), 'radius');
    });

    it('비유한수는 OPTION_INVALID', () => {
      expectOptionInvalid(() => validateBoxOptions({ radius: Number.NaN }), 'radius');
    });

    it('% 형식이 아닌 문자열은 OPTION_INVALID', () => {
      expectOptionInvalid(() => validateBoxOptions({ radius: '50px' as unknown as BoxOptions['radius'] }), 'radius');
    });

    it('음수 % 문자열은 OPTION_INVALID', () => {
      expectOptionInvalid(() => validateBoxOptions({ radius: '-10%' as unknown as BoxOptions['radius'] }), 'radius');
    });

    it('배열 길이가 4가 아니면 OPTION_INVALID', () => {
      expectOptionInvalid(() => validateBoxOptions({ radius: [1, 2, 3] as unknown as BoxOptions['radius'] }), 'radius');
    });

    it('배열 원소 중 하나라도 형식이 틀리면 OPTION_INVALID', () => {
      expectOptionInvalid(
        () => validateBoxOptions({ radius: [1, 2, 'bad', 4] as unknown as BoxOptions['radius'] }),
        'radius'
      );
    });

    it('숫자·%·배열 전부 유효하면 통과한다', () => {
      expect(() => validateBoxOptions({ radius: 10 })).not.toThrow();
      expect(() => validateBoxOptions({ radius: '25%' })).not.toThrow();
      expect(() => validateBoxOptions({ radius: [1, '2%', 3, '4%'] })).not.toThrow();
      expect(() => validateBoxOptions({ radius: 0 })).not.toThrow();
    });

    it('BoxRadius 타입이 허용하는 number 문자열 표현(.5%, 1e2% 등)은 런타임도 통과한다', () => {
      // `${number}%` 타입은 number의 모든 문자열 표현(".5", "1e2" 등)을 허용하는데
      // 기존 정규식(/^\d+(\.\d+)?%$/)은 선행 0 없는 소수점(".5%")과 지수 표기("1e2%")를 거부했다.
      expect(() => validateBoxOptions({ radius: '.5%' })).not.toThrow();
      expect(() => validateBoxOptions({ radius: '1e2%' })).not.toThrow();
      expect(() => validateBoxOptions({ radius: '1.5e-2%' })).not.toThrow();
    });
  });

  describe('border', () => {
    it('width가 음수·비유한수면 OPTION_INVALID (option: border.width)', () => {
      expectOptionInvalid(() => validateBoxOptions({ border: { width: -1, color: '#000' } }), 'border.width');
      expectOptionInvalid(() => validateBoxOptions({ border: { width: Number.NaN, color: '#000' } }), 'border.width');
    });

    it('color가 유효하지 않으면 OPTION_INVALID (option: border.color)', () => {
      expectOptionInvalid(() => validateBoxOptions({ border: { width: 1, color: 'nope' } }), 'border.color');
    });

    it('inset이 boolean이 아니면 OPTION_INVALID (option: border.inset)', () => {
      expectOptionInvalid(
        () => validateBoxOptions({ border: { width: 1, color: '#000', inset: 'yes' as unknown as boolean } }),
        'border.inset'
      );
    });

    it('width 0은 허용한다', () => {
      expect(() => validateBoxOptions({ border: { width: 0, color: '#000' } })).not.toThrow();
    });
  });
});

describe('normalizeBoxOptions — 내부 형태 정규화', () => {
  it('빈 객체는 전부 기본값이다', () => {
    expect(normalizeBoxOptions({})).toEqual({
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      background: 'transparent',
      radius: 0,
      border: null,
    });
  });

  it('숫자 padding을 네 방향 객체로 편다', () => {
    expect(normalizeBoxOptions({ padding: 10 }).padding).toEqual({ top: 10, right: 10, bottom: 10, left: 10 });
  });

  it('객체 padding의 생략된 방향은 0이다', () => {
    expect(normalizeBoxOptions({ padding: { top: 5, left: 3 } }).padding).toEqual({
      top: 5,
      right: 0,
      bottom: 0,
      left: 3,
    });
  });

  it('background를 그대로 보존한다', () => {
    expect(normalizeBoxOptions({ background: '#ff0000' }).background).toBe('#ff0000');
  });

  it('radius를 그대로 보존한다 (px 해석은 box-calculator 몫)', () => {
    expect(normalizeBoxOptions({ radius: '30%' }).radius).toBe('30%');
    expect(normalizeBoxOptions({ radius: [1, 2, 3, 4] }).radius).toEqual([1, 2, 3, 4]);
  });

  it('border.inset 생략은 false로 채운다', () => {
    expect(normalizeBoxOptions({ border: { width: 2, color: '#000' } }).border).toEqual({
      width: 2,
      color: '#000',
      inset: false,
    });
  });

  it('border.inset을 명시하면 그대로 보존한다', () => {
    expect(normalizeBoxOptions({ border: { width: 2, color: '#000', inset: true } }).border?.inset).toBe(true);
  });
});
