import { readdirSync } from 'node:fs';
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
// path/mime 헬퍼는 공개 barrel에 노출되지 않는 내부 parser이므로 모듈에서 직접 import한다.
import {
  isSvgDataUrl,
  isXmlMimeType,
  normalizeMimeType,
  parseDataUrlMimeType,
} from '../../../src/utils/source-utils/mime.internal';
import { getFormatFromPath, getPathnameWithoutSuffix } from '../../../src/utils/source-utils/path.internal';

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

    it('공개 배럴과 공개 타입을 제외한 구현 파일은 internal 파일명을 사용한다', () => {
      const allowedPublicFiles = new Set(['index.ts', 'types.ts']);
      const sourceUtilsDir = `${process.cwd()}/src/utils/source-utils`;
      const implementationFiles = readdirSync(sourceUtilsDir).filter(
        (fileName) => fileName.endsWith('.ts') && !allowedPublicFiles.has(fileName)
      );

      expect(implementationFiles.filter((fileName) => !fileName.endsWith('.internal.ts'))).toEqual([]);
    });
  });
});

describe('path parser', () => {
  describe('getPathnameWithoutSuffix', () => {
    it('절대 URL은 쿼리/해시를 제외한 pathname을 반환한다', () => {
      expect(getPathnameWithoutSuffix('https://example.com/dir/photo.png?v=1#frag')).toBe('/dir/photo.png');
      expect(getPathnameWithoutSuffix('https://example.com/')).toBe('/');
    });

    it('protocol-relative URL은 base를 적용해 pathname을 추출한다', () => {
      expect(getPathnameWithoutSuffix('//cdn.example.com/assets/icon.webp?cache=1')).toBe('/assets/icon.webp');
    });

    it('URL 파싱이 실패하면 해시/쿼리를 직접 잘라낸 원문을 반환한다', () => {
      expect(getPathnameWithoutSuffix('./assets/photo.png?v=1#frag')).toBe('./assets/photo.png');
      expect(getPathnameWithoutSuffix('relative/file.webp#section')).toBe('relative/file.webp');
      expect(getPathnameWithoutSuffix('plain.jpg')).toBe('plain.jpg');
    });

    it('빈 문자열은 그대로 반환한다', () => {
      expect(getPathnameWithoutSuffix('')).toBe('');
    });
  });

  describe('getFormatFromPath', () => {
    it('알려진 확장자를 ImageFormat으로 매핑한다', () => {
      expect(getFormatFromPath('photo.png')).toBe('png');
      expect(getFormatFromPath('photo.jpg')).toBe('jpg');
      expect(getFormatFromPath('photo.jpeg')).toBe('jpeg');
      expect(getFormatFromPath('icon.svg')).toBe('svg');
      expect(getFormatFromPath('anim.gif')).toBe('gif');
      expect(getFormatFromPath('pic.webp')).toBe('webp');
      expect(getFormatFromPath('pic.avif')).toBe('avif');
    });

    it('대문자 확장자는 소문자로 정규화해 매핑한다', () => {
      expect(getFormatFromPath('https://example.com/PHOTO.PNG?x=1')).toBe('png');
      expect(getFormatFromPath('./Vector.SVG#frag')).toBe('svg');
    });

    it('쿼리/해시가 붙은 URL도 마지막 확장자를 본다', () => {
      expect(getFormatFromPath('https://example.com/dir.with.dot/photo.webp?download=true')).toBe('webp');
    });

    it('알 수 없는 확장자는 unknown으로 반환한다', () => {
      expect(getFormatFromPath('archive.zip')).toBe('unknown');
      expect(getFormatFromPath('https://example.com/file.bmp')).toBe('unknown');
    });

    it('확장자가 없으면 unknown으로 반환한다', () => {
      expect(getFormatFromPath('/assets/noext')).toBe('unknown');
      expect(getFormatFromPath('https://example.com/dir/')).toBe('unknown');
      expect(getFormatFromPath('')).toBe('unknown');
    });

    it('복수 dot 경로는 마지막 확장자만 인식한다', () => {
      expect(getFormatFromPath('my.photo.backup.png')).toBe('png');
      expect(getFormatFromPath('my.photo.tar.gz')).toBe('unknown');
    });
  });
});

describe('mime parser', () => {
  describe('isSvgDataUrl', () => {
    it('SVG data URL 헤더만 true로 판정한다', () => {
      expect(isSvgDataUrl('data:image/svg+xml,%3Csvg%3E')).toBe(true);
      expect(isSvgDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(true);
      expect(isSvgDataUrl('DATA:IMAGE/SVG+XML,%3Csvg%3E')).toBe(true);
      expect(isSvgDataUrl('data:image/svg+xml')).toBe(true);
    });

    it('비SVG data URL과 유사 prefix는 false로 판정한다', () => {
      expect(isSvgDataUrl('data:image/png;base64,AAAA')).toBe(false);
      expect(isSvgDataUrl('data:image/svg+xmlfoo,%3Csvg%3E')).toBe(false);
      expect(isSvgDataUrl('https://example.com/icon.svg')).toBe(false);
      expect(isSvgDataUrl('')).toBe(false);
    });
  });

  describe('parseDataUrlMimeType', () => {
    it('data URL이 아니면 undefined를 반환한다', () => {
      expect(parseDataUrlMimeType('https://example.com/photo.png')).toBeUndefined();
      expect(parseDataUrlMimeType('')).toBeUndefined();
    });

    it('파라미터와 base64 마커를 제외한 MIME 토큰을 반환한다', () => {
      expect(parseDataUrlMimeType('data:image/png;base64,AAAA')).toBe('image/png');
      expect(parseDataUrlMimeType('data:image/svg+xml;charset=utf-8,%3Csvg%3E')).toBe('image/svg+xml');
      expect(parseDataUrlMimeType('DATA:Image/PNG;base64,AAAA')).toBe('image/png');
    });

    it('콤마가 없는 헤더도 MIME 토큰을 추출한다', () => {
      expect(parseDataUrlMimeType('data:image/webp')).toBe('image/webp');
    });

    it('MIME이 비어 있으면 undefined를 반환한다', () => {
      expect(parseDataUrlMimeType('data:,payload')).toBeUndefined();
      expect(parseDataUrlMimeType('data:;base64,AAAA')).toBeUndefined();
    });
  });

  describe('normalizeMimeType', () => {
    it('소문자/공백 제거 정규형으로 변환한다', () => {
      expect(normalizeMimeType('  Image/PNG  ')).toBe('image/png');
      expect(normalizeMimeType('TEXT/XML;charset=utf-8')).toBe('text/xml');
      expect(normalizeMimeType('')).toBe('');
    });
  });

  describe('isXmlMimeType', () => {
    it('XML 계열 MIME만 true로 판정한다', () => {
      expect(isXmlMimeType('text/xml')).toBe(true);
      expect(isXmlMimeType('application/xml')).toBe(true);
      expect(isXmlMimeType('image/svg+xml')).toBe(true);
      expect(isXmlMimeType('application/rss+xml')).toBe(true);
    });

    it('비XML MIME은 false로 판정한다', () => {
      expect(isXmlMimeType('image/png')).toBe(false);
      expect(isXmlMimeType('text/html')).toBe(false);
      expect(isXmlMimeType('')).toBe(false);
    });
  });
});
