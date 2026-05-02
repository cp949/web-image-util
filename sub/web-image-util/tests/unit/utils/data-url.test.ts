import { describe, expect, it } from 'vitest';
import { blobToDataURL, dataURLToBlob, estimateDataURLSize, isDataURLString } from '../../../src/utils';

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

  it('Data URL의 원본 바이트 크기를 추정한다', () => {
    expect(estimateDataURLSize('data:text/plain;base64,aGVsbG8=')).toBe(5);
    expect(estimateDataURLSize('data:image/svg+xml,%3Csvg%3E%3C/svg%3E')).toBe(11);
  });

  it('잘못된 Data URL은 명확한 오류를 던진다', () => {
    expect(() => dataURLToBlob('not-data-url')).toThrow('유효한 Data URL이 아닙니다');
    expect(() => estimateDataURLSize('not-data-url')).toThrow('유효한 Data URL이 아닙니다');
  });
});
