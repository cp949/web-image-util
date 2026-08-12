/**
 * 문자열/source 런타임 타입 가드의 true/false 분기를 단정한다.
 */

import { describe, expect, it } from 'vitest';
import { isDataURL, isHttpURL, isImageSource, isSVGString, isValidImageSource } from '../../../src/types/guards';

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

  it('자가 닫힘 <svg/> 루트 → true (닫힘 태그가 없어도 유효한 SVG)', () => {
    expect(isSVGString('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')).toBe(true);
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
