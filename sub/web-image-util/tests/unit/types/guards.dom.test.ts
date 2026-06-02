/**
 * DOM·바이너리 런타임 타입 가드의 true/false 분기를 단정한다.
 */

import { describe, expect, it } from 'vitest';
import {
  isArrayBuffer,
  isBlob,
  isCanvasElement,
  isFile,
  isHTMLCanvasElement,
  isHTMLImageElement,
  isImageElement,
  isUint8Array,
} from '../../../src/types/guards';

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
