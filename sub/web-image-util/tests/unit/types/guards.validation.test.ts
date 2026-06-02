/**
 * resize/format/quality/dimension 값 검증 가드의 true/false 분기를 단정한다.
 */

import { describe, expect, it } from 'vitest';
import {
  isOutputFormat,
  isValidBackgroundColor,
  isValidDimension,
  isValidImageFormat,
  isValidQuality,
  isValidResizeFit,
  isValidResizePosition,
} from '../../../src/types/guards';

describe('isValidResizeFit', () => {
  it('유효한 fit 값들 → true', () => {
    for (const fit of ['cover', 'contain', 'fill', 'maxFit', 'minFit']) {
      expect(isValidResizeFit(fit)).toBe(true);
    }
  });

  it('유효하지 않은 문자열/null → false', () => {
    expect(isValidResizeFit('stretch')).toBe(false);
    expect(isValidResizeFit('')).toBe(false);
    expect(isValidResizeFit(null)).toBe(false);
  });
});

describe('isValidResizePosition', () => {
  it('문자열 위치 값들 → true', () => {
    for (const pos of ['center', 'centre', 'top', 'right', 'bottom', 'left', 'top left', 'bottom right']) {
      expect(isValidResizePosition(pos)).toBe(true);
    }
  });

  it('숫자 위치 (0-100 범위) → true', () => {
    expect(isValidResizePosition(0)).toBe(true);
    expect(isValidResizePosition(50)).toBe(true);
    expect(isValidResizePosition(100)).toBe(true);
  });

  it('객체 {x, y} 형식 (0-100 범위) → true', () => {
    expect(isValidResizePosition({ x: 25, y: 75 })).toBe(true);
    expect(isValidResizePosition({ x: 0, y: 0 })).toBe(true);
  });

  it('범위 밖 숫자 → false', () => {
    expect(isValidResizePosition(-1)).toBe(false);
    expect(isValidResizePosition(101)).toBe(false);
  });

  it('유효하지 않은 문자열 → false', () => {
    expect(isValidResizePosition('middle')).toBe(false);
  });

  it('{x, y} 외 여분 키 포함 객체 → false', () => {
    expect(isValidResizePosition({ x: 50, y: 50, z: 0 })).toBe(false);
  });

  it('객체 {x, y} x 또는 y가 0-100 범위 밖 → false', () => {
    expect(isValidResizePosition({ x: 200, y: 50 })).toBe(false);
    expect(isValidResizePosition({ x: 50, y: -1 })).toBe(false);
    expect(isValidResizePosition({ x: -1, y: 101 })).toBe(false);
  });

  it('키가 하나만 있는 객체 → false', () => {
    expect(isValidResizePosition({ x: 50 })).toBe(false);
    expect(isValidResizePosition({ y: 50 })).toBe(false);
  });

  it('null/undefined → false', () => {
    expect(isValidResizePosition(null)).toBe(false);
    expect(isValidResizePosition(undefined)).toBe(false);
  });
});

describe('isValidBackgroundColor', () => {
  it('CSS 색상 문자열 (hex, rgb, hsl, named) → true', () => {
    expect(isValidBackgroundColor('#ffffff')).toBe(true);
    expect(isValidBackgroundColor('#fff')).toBe(true);
    expect(isValidBackgroundColor('rgb(255,0,0)')).toBe(true);
    expect(isValidBackgroundColor('rgba(0,0,0,0.5)')).toBe(true);
    expect(isValidBackgroundColor('hsl(0,100%,50%)')).toBe(true);
    expect(isValidBackgroundColor('red')).toBe(true);
  });

  it('"transparent" → true', () => {
    expect(isValidBackgroundColor('transparent')).toBe(true);
  });

  it('RGB 객체 {r, g, b} (0-255 정수) → true', () => {
    expect(isValidBackgroundColor({ r: 255, g: 0, b: 0 })).toBe(true);
    expect(isValidBackgroundColor({ r: 0, g: 0, b: 0 })).toBe(true);
  });

  it('RGB 객체 + alpha (0-1) → true', () => {
    expect(isValidBackgroundColor({ r: 0, g: 128, b: 255, alpha: 0.5 })).toBe(true);
    expect(isValidBackgroundColor({ r: 0, g: 0, b: 0, alpha: 0 })).toBe(true);
    expect(isValidBackgroundColor({ r: 255, g: 255, b: 255, alpha: 1 })).toBe(true);
  });

  it('RGB 객체 + alpha 범위 밖 → false', () => {
    expect(isValidBackgroundColor({ r: 0, g: 0, b: 0, alpha: 1.5 })).toBe(false);
    expect(isValidBackgroundColor({ r: 0, g: 0, b: 0, alpha: -0.1 })).toBe(false);
  });

  it('RGB 범위 밖 정수 → false', () => {
    expect(isValidBackgroundColor({ r: 256, g: 0, b: 0 })).toBe(false);
    expect(isValidBackgroundColor({ r: -1, g: 0, b: 0 })).toBe(false);
  });

  it('빈 문자열/null/숫자 → false', () => {
    expect(isValidBackgroundColor('')).toBe(false);
    expect(isValidBackgroundColor(null)).toBe(false);
    expect(isValidBackgroundColor(42)).toBe(false);
  });

  it('비어있지 않으나 CSS 색상 패턴 불일치 문자열 → false', () => {
    // CSS_COLOR_REGEX는 [a-z]로 끝나 문자 시작 문자열은 named color로 허용하므로
    // 숫자나 특수문자로 시작하는 문자열만 false를 반환한다
    expect(isValidBackgroundColor('123456')).toBe(false);
    expect(isValidBackgroundColor('!important')).toBe(false);
  });
});

describe('isValidImageFormat', () => {
  it('유효한 포맷 문자열들 → true', () => {
    for (const fmt of ['jpeg', 'jpg', 'png', 'webp', 'avif', 'gif', 'svg']) {
      expect(isValidImageFormat(fmt)).toBe(true);
    }
  });

  it('대소문자 무관 → true', () => {
    expect(isValidImageFormat('JPEG')).toBe(true);
    expect(isValidImageFormat('PNG')).toBe(true);
  });

  it('유효하지 않은 포맷 → false', () => {
    expect(isValidImageFormat('bmp')).toBe(false);
    expect(isValidImageFormat('tiff')).toBe(false);
  });

  it('빈 문자열/null → false', () => {
    expect(isValidImageFormat('')).toBe(false);
    expect(isValidImageFormat(null)).toBe(false);
  });
});

describe('isOutputFormat', () => {
  it('출력 가능한 포맷들 → true', () => {
    expect(isOutputFormat('jpeg')).toBe(true);
    expect(isOutputFormat('png')).toBe(true);
    expect(isOutputFormat('webp')).toBe(true);
  });

  it('출력 불가 포맷(avif, gif, svg 등) → false', () => {
    expect(isOutputFormat('avif')).toBe(false);
    expect(isOutputFormat('gif')).toBe(false);
    expect(isOutputFormat('svg')).toBe(false);
  });

  it('대문자/혼합 대소문자 → true (toLowerCase 정규화)', () => {
    expect(isOutputFormat('PNG')).toBe(true);
    expect(isOutputFormat('JPEG')).toBe(true);
    expect(isOutputFormat('WebP')).toBe(true);
  });

  it('빈 문자열/null → false', () => {
    expect(isOutputFormat('')).toBe(false);
    expect(isOutputFormat(null)).toBe(false);
  });
});

describe('isValidQuality', () => {
  it('0.0~1.0 범위 숫자 → true', () => {
    expect(isValidQuality(0)).toBe(true);
    expect(isValidQuality(0.5)).toBe(true);
    expect(isValidQuality(1)).toBe(true);
    expect(isValidQuality(0.85)).toBe(true);
  });

  it('범위 밖 숫자 → false', () => {
    expect(isValidQuality(-0.1)).toBe(false);
    expect(isValidQuality(1.1)).toBe(false);
  });

  it('NaN/null/문자열 → false', () => {
    expect(isValidQuality(Number.NaN)).toBe(false);
    expect(isValidQuality(null)).toBe(false);
    expect(isValidQuality('0.5')).toBe(false);
  });
});

describe('isValidDimension', () => {
  it('양수 정수 → true', () => {
    expect(isValidDimension(1)).toBe(true);
    expect(isValidDimension(100)).toBe(true);
    expect(isValidDimension(4096)).toBe(true);
  });

  it('0/음수/소수/NaN → false', () => {
    expect(isValidDimension(0)).toBe(false);
    expect(isValidDimension(-1)).toBe(false);
    expect(isValidDimension(1.5)).toBe(false);
    expect(isValidDimension(Number.NaN)).toBe(false);
  });

  it('null/문자열 → false', () => {
    expect(isValidDimension(null)).toBe(false);
    expect(isValidDimension('100')).toBe(false);
  });
});
