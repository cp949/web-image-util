/**
 * transform-config 단위 테스트
 *
 * validateTransformOptions(호출 시점 검증)와 normalizeTransformOptions(축약형·기본값 정규화)를 검증한다.
 * 원본 크기에 의존하는 교집합 판정은 transform-calculator 테스트가 담당한다.
 */

import { describe, expect, it } from 'vitest';
import { ImageProcessError } from '../../../src/errors.internal';
import {
  normalizeDegrees,
  normalizeTransformOptions,
  type TransformOptions,
  validateTransformOptions,
} from '../../../src/types/transform-config';

function expectError(fn: () => void, code: string, option?: string): void {
  try {
    fn();
    expect.fail('ImageProcessError가 발생해야 한다');
  } catch (error) {
    expect(error).toBeInstanceOf(ImageProcessError);
    if (error instanceof ImageProcessError) {
      expect(error.code).toBe(code);
      if (option !== undefined) {
        expect(error.details?.option).toBe(option);
      }
    }
  }
}

describe('validateTransformOptions — 호출 시점 검증', () => {
  it('빈 객체는 유효하다 (no-op)', () => {
    expect(() => validateTransformOptions({})).not.toThrow();
  });

  it('모든 필드가 채워진 정상 옵션은 통과한다', () => {
    const options: TransformOptions = {
      crop: { x: 10, y: 20, width: 640, height: 480 },
      flip: { horizontal: true, vertical: false },
      rotate: { degrees: 90, expand: false },
    };
    expect(() => validateTransformOptions(options)).not.toThrow();
  });

  it('객체가 아닌 입력은 OPTION_INVALID (option: transform)', () => {
    expectError(() => validateTransformOptions(null as unknown as TransformOptions), 'OPTION_INVALID', 'transform');
    expectError(() => validateTransformOptions('x' as unknown as TransformOptions), 'OPTION_INVALID', 'transform');
  });

  describe('crop', () => {
    it('비유한수 좌표는 INVALID_DIMENSIONS (kind: invalid-crop)', () => {
      expectError(
        () => validateTransformOptions({ crop: { x: Number.NaN, y: 0, width: 10, height: 10 } }),
        'INVALID_DIMENSIONS'
      );
      expectError(
        () => validateTransformOptions({ crop: { x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 10 } }),
        'INVALID_DIMENSIONS'
      );
    });

    it('반올림 후 0 이하가 되는 width/height는 INVALID_DIMENSIONS', () => {
      expectError(
        () => validateTransformOptions({ crop: { x: 0, y: 0, width: 0.4, height: 10 } }),
        'INVALID_DIMENSIONS'
      );
      expectError(
        () => validateTransformOptions({ crop: { x: 0, y: 0, width: 10, height: -5 } }),
        'INVALID_DIMENSIONS'
      );
    });

    it('음수 x/y는 허용한다 (경계 이탈 영역은 렌더 시 투명)', () => {
      expect(() => validateTransformOptions({ crop: { x: -50, y: -50, width: 100, height: 100 } })).not.toThrow();
    });

    it('소수 width가 반올림 후 양수면 통과한다', () => {
      expect(() => validateTransformOptions({ crop: { x: 0, y: 0, width: 0.6, height: 1.4 } })).not.toThrow();
    });
  });

  describe('rotate', () => {
    it('숫자 축약형이 비유한수면 OPTION_INVALID (option: rotate.degrees)', () => {
      expectError(() => validateTransformOptions({ rotate: Number.NaN }), 'OPTION_INVALID', 'rotate.degrees');
    });

    it('객체형 degrees가 비유한수면 OPTION_INVALID (option: rotate.degrees)', () => {
      expectError(
        () => validateTransformOptions({ rotate: { degrees: Number.NEGATIVE_INFINITY } }),
        'OPTION_INVALID',
        'rotate.degrees'
      );
    });

    it('expand가 boolean이 아니면 OPTION_INVALID (option: rotate.expand)', () => {
      expectError(
        () => validateTransformOptions({ rotate: { degrees: 45, expand: 'clip' as unknown as boolean } }),
        'OPTION_INVALID',
        'rotate.expand'
      );
    });

    it('음수·360 초과 각도는 허용한다', () => {
      expect(() => validateTransformOptions({ rotate: -90 })).not.toThrow();
      expect(() => validateTransformOptions({ rotate: 725 })).not.toThrow();
    });
  });

  describe('flip', () => {
    it('boolean이 아닌 축 값은 OPTION_INVALID', () => {
      expectError(
        () => validateTransformOptions({ flip: { horizontal: 1 as unknown as boolean } }),
        'OPTION_INVALID',
        'flip.horizontal'
      );
      expectError(
        () => validateTransformOptions({ flip: { vertical: 'yes' as unknown as boolean } }),
        'OPTION_INVALID',
        'flip.vertical'
      );
    });
  });
});

describe('normalizeDegrees — [0, 360) 정규화', () => {
  it.each([
    [0, 0],
    [90, 90],
    [360, 0],
    [-90, 270],
    [725, 5],
    [-0, 0],
  ])('%d → %d', (input, expected) => {
    expect(normalizeDegrees(input)).toBe(expected);
    expect(Object.is(normalizeDegrees(input), -0)).toBe(false);
  });
});

describe('normalizeTransformOptions — 내부 형태 정규화', () => {
  it('빈 객체는 전부 기본값이다', () => {
    expect(normalizeTransformOptions({})).toEqual({
      crop: null,
      flipX: false,
      flipY: false,
      degrees: 0,
      expand: true,
    });
  });

  it('rotate 숫자 축약형은 expand 객체와 같다', () => {
    expect(normalizeTransformOptions({ rotate: 90 })).toEqual(normalizeTransformOptions({ rotate: { degrees: 90 } }));
    expect(normalizeTransformOptions({ rotate: 90 }).expand).toBe(true);
  });

  it('rotate -90은 270으로 정규화한다', () => {
    expect(normalizeTransformOptions({ rotate: -90 }).degrees).toBe(270);
  });

  it('expand false를 보존한다', () => {
    expect(normalizeTransformOptions({ rotate: { degrees: 30, expand: false } }).expand).toBe(false);
  });

  it('crop 네 값을 정수로 반올림한다', () => {
    expect(normalizeTransformOptions({ crop: { x: 10.4, y: 20.6, width: 99.5, height: 50.2 } }).crop).toEqual({
      x: 10,
      y: 21,
      width: 100,
      height: 50,
    });
  });

  it('flip 축을 boolean 플래그로 편다', () => {
    expect(normalizeTransformOptions({ flip: { horizontal: true } })).toMatchObject({ flipX: true, flipY: false });
    expect(normalizeTransformOptions({ flip: { vertical: true } })).toMatchObject({ flipX: false, flipY: true });
  });
});
