/**
 * 출력 옵션 검증과 assert 함수의 true/false·throw 분기를 단정한다.
 */

import { describe, expect, it } from 'vitest';
import {
  assertImageSource,
  assertPositiveInteger,
  assertQuality,
  validateOutputOptions,
} from '../../../src/types/guards';

describe('validateOutputOptions', () => {
  it('빈 옵션 → isValid true, errors/warnings 비어있음', () => {
    const result = validateOutputOptions({});
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('유효한 옵션 → isValid true', () => {
    const result = validateOutputOptions({ format: 'webp', quality: 0.8 });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('유효하지 않은 format → isValid false, errors에 메시지 포함', () => {
    const result = validateOutputOptions({ format: 'bmp' });
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/format/);
  });

  it('quality 범위 밖 (음수) → isValid false, errors에 메시지 포함', () => {
    const result = validateOutputOptions({ quality: -0.1 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('quality'))).toBe(true);
  });

  it('quality 범위 밖 (1 초과) → isValid false', () => {
    const result = validateOutputOptions({ quality: 1.5 });
    expect(result.isValid).toBe(false);
  });

  it('유효하지 않은 fallbackFormat → isValid false', () => {
    const result = validateOutputOptions({ fallbackFormat: 'tiff' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('fallbackFormat'))).toBe(true);
  });

  it('quality < 0.1 → 경고 메시지 포함', () => {
    const result = validateOutputOptions({ quality: 0.05 });
    expect(result.isValid).toBe(true); // 에러가 아닌 경고
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('format === "png" && quality < 1.0 → PNG 손실 없음 경고 포함', () => {
    const result = validateOutputOptions({ format: 'png', quality: 0.8 });
    expect(result.isValid).toBe(true);
    expect(result.warnings.some((w) => w.includes('PNG') || w.includes('lossless'))).toBe(true);
  });

  it('반환된 ValidationResult는 불변(errors/warnings 수정 불가)', () => {
    const result = validateOutputOptions({});
    expect(() => {
      (result.errors as string[]).push('tamper');
    }).toThrow();
  });
});

describe('assertImageSource', () => {
  it('유효한 소스 → throw 없음', () => {
    expect(() => assertImageSource('data:image/png;base64,abc')).not.toThrow();
    expect(() => assertImageSource(new Blob(['']))).not.toThrow();
    expect(() => assertImageSource('https://example.com/img.png')).not.toThrow();
  });

  it('유효하지 않은 소스 → TypeError', () => {
    expect(() => assertImageSource(null)).toThrow(TypeError);
    expect(() => assertImageSource(42)).toThrow(TypeError);
    expect(() => assertImageSource('')).toThrow(TypeError);
  });

  it('paramName을 지정하면 에러 메시지에 포함된다', () => {
    expect(() => assertImageSource(null, 'inputImage')).toThrow(/inputImage/);
  });
});

describe('assertPositiveInteger', () => {
  it('양수 정수 → throw 없음', () => {
    expect(() => assertPositiveInteger(1)).not.toThrow();
    expect(() => assertPositiveInteger(200)).not.toThrow();
  });

  it('0/음수/소수/null → TypeError', () => {
    expect(() => assertPositiveInteger(0)).toThrow(TypeError);
    expect(() => assertPositiveInteger(-5)).toThrow(TypeError);
    expect(() => assertPositiveInteger(1.5)).toThrow(TypeError);
    expect(() => assertPositiveInteger(null)).toThrow(TypeError);
  });

  it('paramName을 지정하면 에러 메시지에 포함된다', () => {
    expect(() => assertPositiveInteger(0, 'width')).toThrow(/width/);
  });
});

describe('assertQuality', () => {
  it('0~1 범위 숫자 → throw 없음', () => {
    expect(() => assertQuality(0)).not.toThrow();
    expect(() => assertQuality(0.5)).not.toThrow();
    expect(() => assertQuality(1)).not.toThrow();
  });

  it('범위 밖 숫자/null/문자열 → TypeError', () => {
    expect(() => assertQuality(-0.1)).toThrow(TypeError);
    expect(() => assertQuality(1.1)).toThrow(TypeError);
    expect(() => assertQuality(null)).toThrow(TypeError);
    expect(() => assertQuality('0.5')).toThrow(TypeError);
  });

  it('paramName을 지정하면 에러 메시지에 포함된다', () => {
    expect(() => assertQuality(2, 'outputQuality')).toThrow(/outputQuality/);
  });
});
