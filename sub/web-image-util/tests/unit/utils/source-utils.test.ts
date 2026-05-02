import { describe, expect, it, vi } from 'vitest';

import {
  detectImageSourceInfo as detectImageSourceInfoFromRoot,
  detectImageSourceType as detectImageSourceTypeFromRoot,
} from '../../../src';
import {
  detectImageSourceInfo,
  detectImageSourceType,
  detectImageStringSourceInfo,
  detectImageStringSourceType,
} from '../../../src/utils';

describe('source utilities', () => {
  describe('detectImageStringSourceType', () => {
    it('문자열 소스 타입을 가볍게 판정한다', () => {
      expect(detectImageStringSourceType('<svg viewBox="0 0 1 1"></svg>')).toBe('inline-svg');
      expect(detectImageStringSourceType('data:image/svg+xml,%3Csvg%3E%3C/svg%3E')).toBe('svg-data-url');
      expect(detectImageStringSourceType('DATA:image/svg+xml,%3Csvg%3E%3C/svg%3E')).toBe('svg-data-url');
      expect(detectImageStringSourceType('data:image/png;base64,AAAA')).toBe('data-url');
      expect(detectImageStringSourceType('DaTa:image/png;base64,AAAA')).toBe('data-url');
      expect(detectImageStringSourceType('https://example.com/photo.png')).toBe('http-url');
      expect(detectImageStringSourceType('http://example.com/photo.png')).toBe('http-url');
      expect(detectImageStringSourceType('HTTPS://example.com/photo.png')).toBe('http-url');
      expect(detectImageStringSourceType('//cdn.example.com/photo.webp')).toBe('protocol-relative-url');
      expect(detectImageStringSourceType('blob:https://example.com/123')).toBe('blob-url');
      expect(detectImageStringSourceType('BLOB:https://example.com/123')).toBe('blob-url');
      expect(detectImageStringSourceType('/assets/icon.svg?version=1')).toBe('svg-path');
      expect(detectImageStringSourceType('./assets/photo.png')).toBe('path');
      expect(detectImageStringSourceType('')).toBe('path');
      expect(detectImageStringSourceType('   ')).toBe('path');
    });
  });

  describe('detectImageStringSourceInfo', () => {
    it('Data URL의 MIME 타입과 이미지 포맷을 동기적으로 판정한다', () => {
      expect(detectImageStringSourceInfo('data:image/png;base64,AAAA')).toEqual({
        type: 'data-url',
        family: 'string',
        mimeType: 'image/png',
        format: 'png',
        isSvg: false,
        isUrl: false,
        isDataUrl: true,
        isBlobUrl: false,
      });

      expect(detectImageStringSourceInfo('data:image/svg+xml,%3Csvg%3E%3C/svg%3E')).toMatchObject({
        type: 'svg-data-url',
        mimeType: 'image/svg+xml',
        format: 'svg',
        isSvg: true,
        isDataUrl: true,
      });

      expect(detectImageStringSourceInfo('DATA:image/png;base64,AAAA')).toMatchObject({
        type: 'data-url',
        mimeType: 'image/png',
        format: 'png',
        isDataUrl: true,
      });
    });

    it('URL과 경로의 확장자에서 이미지 포맷을 추론한다', () => {
      expect(detectImageStringSourceInfo('https://example.com/photo.webp?x=1')).toMatchObject({
        type: 'http-url',
        format: 'webp',
        isUrl: true,
      });

      expect(detectImageStringSourceInfo('HTTPS://example.com/photo.webp?x=1')).toMatchObject({
        type: 'http-url',
        format: 'webp',
        isUrl: true,
      });

      expect(detectImageStringSourceInfo('https://example.com/vector.svg?x=1')).toMatchObject({
        type: 'http-url',
        format: 'svg',
        isSvg: true,
      });

      expect(detectImageStringSourceInfo('/assets/icon.svg#hash')).toMatchObject({
        type: 'svg-path',
        format: 'svg',
        isSvg: true,
        isUrl: false,
      });

      expect(detectImageStringSourceInfo('/assets/file')).toMatchObject({
        type: 'path',
        format: 'unknown',
      });

      expect(detectImageStringSourceInfo('BLOB:https://example.com/123')).toMatchObject({
        type: 'blob-url',
        isBlobUrl: true,
      });

      expect(detectImageStringSourceInfo('blob:https://example.com/icon.svg')).toMatchObject({
        type: 'blob-url',
        format: 'unknown',
        isSvg: false,
        isBlobUrl: true,
      });
    });
  });

  describe('detectImageSourceType', () => {
    it('비문자열 소스 타입을 외부 읽기 없이 판정한다', () => {
      const canvas = document.createElement('canvas');
      const image = document.createElement('img');
      const pngBlob = new Blob(['png'], { type: 'image/png' });
      const svgBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
      const svgFile = new File(['not-sniffed'], 'icon.svg', { type: '' });
      const pngTextSpy = vi.spyOn(pngBlob, 'text');
      const svgTextSpy = vi.spyOn(svgBlob, 'text');

      expect(detectImageSourceType(image)).toBe('element');
      expect(detectImageSourceType(canvas)).toBe('canvas');
      expect(detectImageSourceType(pngBlob)).toBe('blob');
      expect(detectImageSourceType(svgBlob)).toBe('svg-blob');
      expect(detectImageSourceType(svgFile)).toBe('svg-blob');
      expect(detectImageSourceType(new ArrayBuffer(8))).toBe('array-buffer');
      expect(detectImageSourceType(new Uint8Array([1, 2, 3]))).toBe('uint8-array');
      expect(detectImageSourceType('blob:https://example.com/123')).toBe('blob-url');
      expect(pngTextSpy).not.toHaveBeenCalled();
      expect(svgTextSpy).not.toHaveBeenCalled();
    });
  });

  describe('detectImageSourceInfo', () => {
    it('Blob MIME 타입과 파일명에서 포맷 정보를 반환한다', async () => {
      await expect(detectImageSourceInfo(new Blob(['mock'], { type: 'image/webp' }))).resolves.toMatchObject({
        type: 'blob',
        family: 'blob',
        mimeType: 'image/webp',
        format: 'webp',
        isSvg: false,
        isUrl: false,
      });

      await expect(detectImageSourceInfo(new File(['mock'], 'icon.svg', { type: '' }))).resolves.toMatchObject({
        type: 'svg-blob',
        family: 'blob',
        format: 'svg',
        isSvg: true,
      });
    });

    it('MIME이 없는 Blob은 옵션에 따라 SVG 본문을 스니핑한다', async () => {
      const blob = new Blob(['<?xml version="1.0"?><svg viewBox="0 0 1 1"></svg>'], { type: '' });

      await expect(detectImageSourceInfo(blob)).resolves.toMatchObject({
        type: 'svg-blob',
        family: 'blob',
        format: 'svg',
        isSvg: true,
      });

      await expect(detectImageSourceInfo(blob, { sniffSvgBlob: false })).resolves.toMatchObject({
        type: 'blob',
        family: 'blob',
        format: 'unknown',
        isSvg: false,
      });
    });

    it('HTTP URL은 fetch 없이 확장자만으로 포맷을 추론한다', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      await expect(detectImageSourceInfo('https://example.com/icon.svg?cache=1')).resolves.toMatchObject({
        type: 'http-url',
        family: 'string',
        format: 'svg',
        isSvg: true,
        isUrl: true,
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('exports', () => {
    it('utils 엔트리와 루트 엔트리에서 공개 함수를 사용할 수 있다', async () => {
      expect(detectImageStringSourceType('/icon.svg')).toBe('svg-path');
      expect(detectImageSourceTypeFromRoot('/photo.png')).toBe('path');
      await expect(detectImageSourceInfoFromRoot('/icon.svg')).resolves.toMatchObject({ type: 'svg-path' });
    });
  });
});
