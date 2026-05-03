import { describe, expect, it } from 'vitest';
import {
  blobToDataURL,
  dataURLToBlob,
  decodeSvgDataURL,
  estimateDataURLPayloadByteLength,
  estimateDataURLSize,
  isDataURLString,
} from '../../../src/utils';

describe('data URL utilities', () => {
  it('Data URL 문자열을 판정한다', () => {
    expect(isDataURLString('data:image/png;base64,abc')).toBe(true);
    expect(isDataURLString('  data:image/svg+xml,%3Csvg%3E%3C/svg%3E')).toBe(true);
    expect(isDataURLString('https://example.com/image.png')).toBe(false);
    expect(isDataURLString(null)).toBe(false);
  });

  it('Blob을 Data URL로 변환한다', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });

    await expect(blobToDataURL(blob)).resolves.toBe('data:text/plain;base64,aGVsbG8=');
  });

  it('base64 Data URL을 Blob으로 변환한다', async () => {
    const blob = dataURLToBlob('data:text/plain;base64,aGVsbG8=');

    await expect(blob.text()).resolves.toBe('hello');
    expect(blob.type).toBe('text/plain');
  });

  it('percent-encoded Data URL을 Blob으로 변환한다', async () => {
    const blob = dataURLToBlob('data:image/svg+xml,%3Csvg%3E%3C/svg%3E');

    await expect(blob.text()).resolves.toBe('<svg></svg>');
    expect(blob.type).toBe('image/svg+xml');
  });

  it('byte-oriented percent-encoded Data URL을 Blob으로 변환한다', async () => {
    const blob = dataURLToBlob('data:application/octet-stream,%FF');
    const bytes = new Uint8Array(await blob.arrayBuffer());

    expect(blob.type).toBe('application/octet-stream');
    expect(blob.size).toBe(1);
    expect(bytes[0]).toBe(255);
  });

  it('Data URL의 원본 바이트 크기를 추정한다', () => {
    expect(estimateDataURLSize('data:text/plain;base64,aGVsbG8=')).toBe(5);
    expect(estimateDataURLSize('data:image/svg+xml,%3Csvg%3E%3C/svg%3E')).toBe(11);
    expect(estimateDataURLSize('data:application/octet-stream,%FF')).toBe(1);
  });

  it('Data URL payload byte length를 payload materialize 없이 계산한다', () => {
    expect(estimateDataURLPayloadByteLength('data:text/plain;base64,aGVsbG8=')).toBe(5);
    expect(estimateDataURLPayloadByteLength('data:image/svg+xml,%3Csvg%3E%3C/svg%3E')).toBe(11);
    expect(estimateDataURLPayloadByteLength('data:text/plain,%ED%95%9C글')).toBe(6);
  });

  it('SVG Data URL을 동기적으로 UTF-8 text로 decode한다', () => {
    expect(decodeSvgDataURL('data:image/svg+xml,%3Csvg%3E%3C/svg%3E')).toEqual({
      mimeType: 'image/svg+xml',
      text: '<svg></svg>',
      isBase64: false,
    });

    expect(decodeSvgDataURL('DATA:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toEqual({
      mimeType: 'image/svg+xml',
      text: '<svg></svg>',
      isBase64: true,
    });
  });

  it('SVG Data URL decode는 non-SVG와 malformed payload를 거부한다', () => {
    expect(() => decodeSvgDataURL('data:text/plain,%3Csvg%3E%3C/svg%3E')).toThrow('유효한 SVG Data URL이 아닙니다');
    expect(() => decodeSvgDataURL('data:image/svg+xml,%GG')).toThrow('유효한 SVG Data URL이 아닙니다');
    expect(() => decodeSvgDataURL('data:image/svg+xml,%3Cdiv%3E%3C/div%3E')).toThrow(
      '유효한 SVG Data URL이 아닙니다'
    );
  });

  it('Data URL scheme은 기본적으로 대소문자를 구분하지 않는다', () => {
    expect(estimateDataURLPayloadByteLength('DATA:text/plain;base64,aGk=')).toBe(2);
    expect(estimateDataURLPayloadByteLength('DaTa:text/plain;base64,aGk=')).toBe(2);
    expect(() =>
      estimateDataURLPayloadByteLength('DATA:text/plain;base64,aGk=', { caseSensitiveScheme: true })
    ).toThrow('유효한 Data URL이 아닙니다');
    expect(
      estimateDataURLPayloadByteLength('DATA:text/plain;base64,aGk=', {
        caseSensitiveScheme: true,
        invalid: 'null',
      })
    ).toBeNull();
  });

  it('base64 payload byte length 추정은 decode path를 호출하지 않는다', () => {
    const originalAtob = globalThis.atob;
    globalThis.atob = () => {
      throw new Error('atob should not be called');
    };

    try {
      expect(estimateDataURLPayloadByteLength('data:text/plain;base64,aGVsbG8=')).toBe(5);
    } finally {
      globalThis.atob = originalAtob;
    }
  });

  it('invalid 옵션이 null이면 malformed Data URL에서 null을 반환한다', () => {
    expect(estimateDataURLPayloadByteLength('not-data-url', { invalid: 'null' })).toBeNull();
    expect(estimateDataURLPayloadByteLength('data:text/plain,%', { invalid: 'null' })).toBeNull();
    expect(() => estimateDataURLPayloadByteLength('data:text/plain,%')).toThrow('유효한 Data URL이 아닙니다');
  });

  it('malformed base64 alphabet과 padding은 payload byte length 추정에서 거부한다', () => {
    expect(() => estimateDataURLPayloadByteLength('data:text/plain;base64,@@@@')).toThrow('유효한 Data URL이 아닙니다');
    expect(() => estimateDataURLPayloadByteLength('data:text/plain;base64,a===')).toThrow('유효한 Data URL이 아닙니다');
    expect(() => estimateDataURLPayloadByteLength('data:text/plain;base64,a=b=')).toThrow('유효한 Data URL이 아닙니다');
    expect(() => estimateDataURLPayloadByteLength('data:text/plain;base64,a=')).toThrow('유효한 Data URL이 아닙니다');
    expect(() => estimateDataURLPayloadByteLength('data:text/plain;base64,aGVs\u00A0bG8=')).toThrow(
      '유효한 Data URL이 아닙니다'
    );
  });

  it('invalid 옵션이 null이면 malformed base64에서 null을 반환한다', () => {
    expect(estimateDataURLPayloadByteLength('data:text/plain;base64,@@@@', { invalid: 'null' })).toBeNull();
    expect(estimateDataURLPayloadByteLength('data:text/plain;base64,a===', { invalid: 'null' })).toBeNull();
    expect(estimateDataURLPayloadByteLength('data:text/plain;base64,a=b=', { invalid: 'null' })).toBeNull();
    expect(estimateDataURLPayloadByteLength('data:text/plain;base64,a=', { invalid: 'null' })).toBeNull();
    expect(estimateDataURLPayloadByteLength('data:text/plain;base64,aGVs\u00A0bG8=', { invalid: 'null' })).toBeNull();
  });

  it('잘못된 Data URL은 명확한 오류를 던진다', () => {
    expect(() => dataURLToBlob('not-data-url')).toThrow('유효한 Data URL이 아닙니다');
    expect(() => estimateDataURLSize('not-data-url')).toThrow('유효한 Data URL이 아닙니다');
    expect(() => dataURLToBlob('data:text/plain,%GG')).toThrow('유효한 Data URL이 아닙니다');
    expect(() => estimateDataURLSize('data:text/plain,%')).toThrow('유효한 Data URL이 아닙니다');
  });
});
