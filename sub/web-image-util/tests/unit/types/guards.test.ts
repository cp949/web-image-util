/**
 * 런타임 타입 가드와 검증/assert 함수의 true/false·throw 분기를 단정한다.
 */

import { describe, expect, it } from 'vitest';
import {
  assertImageSource,
  assertPositiveInteger,
  assertQuality,
  isArrayBuffer,
  isBlob,
  isCanvasElement,
  isDataURL,
  isFile,
  isHTMLCanvasElement,
  isHTMLImageElement,
  isHttpURL,
  isImageElement,
  isImageSource,
  isOutputFormat,
  isSVGString,
  isUint8Array,
  isValidBackgroundColor,
  isValidDimension,
  isValidImageFormat,
  isValidImageSource,
  isValidQuality,
  isValidResizeFit,
  isValidResizePosition,
  validateOutputOptions,
} from '../../../src/types/guards';

// ─── DOM 타입 가드 ─────────────────────────────────────────────────────────

describe('isImageElement', () => {
  it('HTMLImageElement → true', () => {
    expect(isImageElement(document.createElement('img'))).toBe(true);
  });

  it('HTMLCanvasElement → false', () => {
    expect(isImageElement(document.createElement('canvas'))).toBe(false);
  });

  it('null/undefined/string → false', () => {
    expect(isImageElement(null)).toBe(false);
    expect(isImageElement(undefined)).toBe(false);
    expect(isImageElement('img')).toBe(false);
  });
});

describe('isCanvasElement', () => {
  it('HTMLCanvasElement → true', () => {
    expect(isCanvasElement(document.createElement('canvas'))).toBe(true);
  });

  it('HTMLImageElement → false', () => {
    expect(isCanvasElement(document.createElement('img'))).toBe(false);
  });

  it('null/숫자 → false', () => {
    expect(isCanvasElement(null)).toBe(false);
    expect(isCanvasElement(42)).toBe(false);
  });
});

describe('isBlob', () => {
  it('Blob 인스턴스 → true', () => {
    expect(isBlob(new Blob(['data'], { type: 'image/png' }))).toBe(true);
  });

  it('File 인스턴스 → true (File은 Blob의 서브클래스)', () => {
    expect(isBlob(new File(['data'], 'img.png', { type: 'image/png' }))).toBe(true);
  });

  it('문자열/null → false', () => {
    expect(isBlob('blob')).toBe(false);
    expect(isBlob(null)).toBe(false);
  });
});

describe('isFile', () => {
  it('File 인스턴스 → true', () => {
    expect(isFile(new File(['data'], 'img.png', { type: 'image/png' }))).toBe(true);
  });

  it('Blob 인스턴스 → false (File이 아님)', () => {
    expect(isFile(new Blob(['data'], { type: 'image/png' }))).toBe(false);
  });

  it('null/undefined → false', () => {
    expect(isFile(null)).toBe(false);
    expect(isFile(undefined)).toBe(false);
  });
});

describe('isUint8Array', () => {
  it('Uint8Array 인스턴스 → true', () => {
    expect(isUint8Array(new Uint8Array([1, 2, 3]))).toBe(true);
  });

  it('ArrayBuffer/일반 배열 → false', () => {
    expect(isUint8Array(new ArrayBuffer(8))).toBe(false);
    expect(isUint8Array([1, 2, 3])).toBe(false);
  });
});

describe('isArrayBuffer', () => {
  it('ArrayBuffer 인스턴스 → true', () => {
    expect(isArrayBuffer(new ArrayBuffer(8))).toBe(true);
  });

  it('Uint8Array/null → false', () => {
    expect(isArrayBuffer(new Uint8Array(8))).toBe(false);
    expect(isArrayBuffer(null)).toBe(false);
  });
});

// ─── 별칭 export ──────────────────────────────────────────────────────────

describe('isHTMLImageElement / isHTMLCanvasElement 별칭', () => {
  it('isHTMLImageElement는 isImageElement와 동일하게 동작한다', () => {
    const img = document.createElement('img');
    expect(isHTMLImageElement(img)).toBe(isImageElement(img));
    expect(isHTMLImageElement(null)).toBe(isImageElement(null));
  });

  it('isHTMLCanvasElement는 isCanvasElement와 동일하게 동작한다', () => {
    const canvas = document.createElement('canvas');
    expect(isHTMLCanvasElement(canvas)).toBe(isCanvasElement(canvas));
    expect(isHTMLCanvasElement(null)).toBe(isCanvasElement(null));
  });
});

// ─── 문자열 타입 가드 ─────────────────────────────────────────────────────

describe('isDataURL', () => {
  it('data:image/ 로 시작하는 문자열 → true', () => {
    expect(isDataURL('data:image/png;base64,iVBOR==')).toBe(true);
    expect(isDataURL('data:image/jpeg;base64,/9j/')).toBe(true);
  });

  it('data:image/ 가 아닌 data URI → false', () => {
    expect(isDataURL('data:text/plain;base64,aGVsbG8=')).toBe(false);
  });

  it('http URL/빈 문자열/null → false', () => {
    expect(isDataURL('https://example.com/img.png')).toBe(false);
    expect(isDataURL('')).toBe(false);
    expect(isDataURL(null)).toBe(false);
  });
});

describe('isHttpURL', () => {
  it('http:// 프로토콜 URL → true', () => {
    expect(isHttpURL('http://example.com/image.jpg')).toBe(true);
  });

  it('https:// 프로토콜 URL → true', () => {
    expect(isHttpURL('https://example.com/image.png')).toBe(true);
  });

  it('ftp:// 프로토콜 URL → false', () => {
    expect(isHttpURL('ftp://example.com/file.txt')).toBe(false);
  });

  it('Data URL → false', () => {
    expect(isHttpURL('data:image/png;base64,iVBOR==')).toBe(false);
  });

  it('malformed URL/빈 문자열/null → false', () => {
    expect(isHttpURL('not-a-url')).toBe(false);
    expect(isHttpURL('')).toBe(false);
    expect(isHttpURL(null)).toBe(false);
  });
});

describe('isSVGString', () => {
  it('<svg 로 시작하고 </svg> 포함 → true', () => {
    expect(isSVGString('<svg xmlns="http://www.w3.org/2000/svg"><circle r="40"/></svg>')).toBe(true);
  });

  it('<?xml 선언 후 <svg 태그 → true', () => {
    expect(isSVGString('<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBe(
      true
    );
  });

  it('</svg> 없는 문자열 → false', () => {
    expect(isSVGString('<svg xmlns="http://www.w3.org/2000/svg">')).toBe(false);
  });

  it('<svg 없는 XML → false (includes 가드에서 탈출)', () => {
    // <svg 부분문자열 자체가 없으므로 guards.ts:165에서 탈출
    expect(isSVGString('<?xml version="1.0"?><div></div>')).toBe(false);
  });

  it('<?xml 선언 뒤 첫 태그가 <svg 아닌 경우 → false (branch C: <?xml 파싱 로직 실행)', () => {
    // <svg와 </svg> 모두 포함하므로 guards.ts:165 통과, <?xml로 시작하므로 175번 진입
    // 선언 제거 후 <div로 시작 → guards.ts:177 startsWith('<svg') 실패 → false
    expect(isSVGString('<?xml version="1.0"?><div><svg></svg></div>')).toBe(false);
  });

  it('SVG가 다른 태그에 임베드된 경우 → false (branch D: return false 경로)', () => {
    // <svg와 </svg> 모두 포함하지만 <svg도 <?xml도 아닌 태그로 시작 → guards.ts:180 return false
    expect(isSVGString('<div><svg></svg></div>')).toBe(false);
  });

  it('일반 HTML 문자열 → false', () => {
    expect(isSVGString('<div>hello</div>')).toBe(false);
  });

  it('빈 문자열/null → false', () => {
    expect(isSVGString('')).toBe(false);
    expect(isSVGString(null)).toBe(false);
  });
});

// ─── 복합 타입 가드 ───────────────────────────────────────────────────────

describe('isValidImageSource', () => {
  it('HTMLImageElement → true', () => {
    expect(isValidImageSource(document.createElement('img'))).toBe(true);
  });

  it('Blob → true', () => {
    expect(isValidImageSource(new Blob([''], { type: 'image/png' }))).toBe(true);
  });

  it('Data URL → true', () => {
    expect(isValidImageSource('data:image/png;base64,abc')).toBe(true);
  });

  it('HTTP URL → true', () => {
    expect(isValidImageSource('https://example.com/img.png')).toBe(true);
  });

  it('SVG 문자열 → true', () => {
    expect(isValidImageSource('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBe(true);
  });

  it('임의 비어있지 않은 문자열(파일 경로 등) → true', () => {
    expect(isValidImageSource('/path/to/image.jpg')).toBe(true);
  });

  it('null/undefined/숫자 → false', () => {
    expect(isValidImageSource(null)).toBe(false);
    expect(isValidImageSource(undefined)).toBe(false);
    expect(isValidImageSource(42)).toBe(false);
  });

  it('빈 문자열 → false', () => {
    expect(isValidImageSource('')).toBe(false);
  });
});

describe('isImageSource', () => {
  it('HTMLImageElement → true', () => {
    expect(isImageSource(document.createElement('img'))).toBe(true);
  });

  it('HTMLCanvasElement → true', () => {
    expect(isImageSource(document.createElement('canvas'))).toBe(true);
  });

  it('Blob → true', () => {
    expect(isImageSource(new Blob(['']))).toBe(true);
  });

  it('ArrayBuffer → true', () => {
    expect(isImageSource(new ArrayBuffer(8))).toBe(true);
  });

  it('Uint8Array → true', () => {
    expect(isImageSource(new Uint8Array([1, 2, 3]))).toBe(true);
  });

  it('비어있지 않은 문자열 → true', () => {
    expect(isImageSource('some-path')).toBe(true);
  });

  it('null/숫자/빈 문자열 → false', () => {
    expect(isImageSource(null)).toBe(false);
    expect(isImageSource(42)).toBe(false);
    expect(isImageSource('')).toBe(false);
  });
});

// ─── 값 검증 가드 ─────────────────────────────────────────────────────────

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

// ─── validateOutputOptions ────────────────────────────────────────────────

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

// ─── assert* 함수 ─────────────────────────────────────────────────────────

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
