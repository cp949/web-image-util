import { describe, expect, it } from 'vitest';
import { detectMimeAndExtension } from '../../../src/utils/inspect-svg-source/mime-extension.internal';
import { decideSvgFromSniff } from '../../../src/utils/inspect-svg-source/sniff-decision.internal';
import { detectOriginalKind, estimateSourceBytes } from '../../../src/utils/inspect-svg-source/source-kind.internal';

describe('detectOriginalKind', () => {
  it('File 인스턴스는 Blob보다 먼저 "file"로 분류된다', () => {
    const file = new File(['<svg/>'], 'icon.svg', { type: 'image/svg+xml' });
    expect(detectOriginalKind(file)).toBe('file');
  });

  it('Blob 인스턴스는 "blob"으로 분류된다', () => {
    const blob = new Blob(['<svg/>'], { type: 'image/svg+xml' });
    expect(detectOriginalKind(blob)).toBe('blob');
  });

  it('URL 인스턴스는 "url-string"으로 분류된다', () => {
    const url = new URL('https://example.com/icon.svg');
    expect(detectOriginalKind(url)).toBe('url-string');
  });

  it('data: SVG 문자열은 "data-url"로 분류된다', () => {
    const dataUrl = 'data:image/svg+xml;base64,PHN2Zy8+';
    expect(detectOriginalKind(dataUrl)).toBe('data-url');
  });

  it('https:// URL 문자열은 "url-string"으로 분류된다', () => {
    expect(detectOriginalKind('https://example.com/icon.svg')).toBe('url-string');
  });

  it('SVG 마크업 문자열은 "string"으로 분류된다', () => {
    expect(detectOriginalKind('<svg/>')).toBe('string');
  });
});

describe('detectMimeAndExtension', () => {
  it('SVG MIME Blob은 mime=image/svg+xml, extension=null을 반환한다', () => {
    const blob = new Blob(['<svg/>'], { type: 'image/svg+xml' });
    expect(detectMimeAndExtension(blob, 'blob')).toEqual({ mime: 'image/svg+xml', extension: null });
  });

  it('.svg 확장자 File에 text/plain MIME이 있으면 mime=text/plain, extension=svg를 반환한다', () => {
    // File의 MIME(text/plain)과 확장자(.svg)가 불일치하는 경우 둘 다 그대로 반환한다.
    const file = new File(['<svg/>'], 'icon.svg', { type: 'text/plain' });
    expect(detectMimeAndExtension(file, 'file')).toEqual({ mime: 'text/plain', extension: 'svg' });
  });

  it('query/fragment가 포함된 URL도 pathname의 확장자만 추출한다', () => {
    // URL의 query(?v=1)와 fragment(#hash)는 확장자 추출 시 무시된다.
    const url = new URL('https://example.com/icon.svg?v=1#hash');
    const result = detectMimeAndExtension(url, 'url-string');
    expect(result.extension).toBe('svg');
  });

  it('protocol-relative URL도 정규화 후 pathname의 확장자를 추출한다', () => {
    const result = detectMimeAndExtension('//cdn.example.com/assets/icon.svg?token=SECRET#frag', 'url-string');
    expect(result.extension).toBe('svg');
  });
});

describe('decideSvgFromSniff', () => {
  it('SVG MIME이면 kind=svg를 반환한다', () => {
    const result = decideSvgFromSniff({
      originalKind: 'blob',
      mime: 'image/svg+xml',
      extension: null,
      bytes: 100,
      byteLimit: 10_000,
    });
    expect(result.kind).toBe('svg');
    expect(result.findings).toHaveLength(0);
  });

  it('PNG MIME이면 kind=not-svg-source를 반환한다', () => {
    const result = decideSvgFromSniff({
      originalKind: 'blob',
      mime: 'image/png',
      extension: null,
      bytes: 100,
      byteLimit: 10_000,
    });
    expect(result.kind).toBe('not-svg-source');
    expect(result.findings).toHaveLength(0);
  });

  it('.svg 확장자 + non-SVG MIME이면 kind=svg, finding=mime-mismatch를 반환한다', () => {
    const result = decideSvgFromSniff({
      originalKind: 'file',
      mime: 'text/plain',
      extension: 'svg',
      bytes: 100,
      byteLimit: 10_000,
    });
    expect(result.kind).toBe('svg');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].code).toBe('mime-mismatch');
  });

  it('SVG MIME + .png 확장자이면 kind=svg, finding=extension-mismatch를 반환한다', () => {
    const result = decideSvgFromSniff({
      originalKind: 'file',
      mime: 'image/svg+xml',
      extension: 'png',
      bytes: 100,
      byteLimit: 10_000,
    });
    expect(result.kind).toBe('svg');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].code).toBe('extension-mismatch');
  });

  it('byteLimit 초과 시 kind=unknown, finding=svg-bytes-exceeded를 반환한다', () => {
    const result = decideSvgFromSniff({
      originalKind: 'blob',
      mime: 'image/svg+xml',
      extension: null,
      bytes: 500,
      byteLimit: 100,
    });
    expect(result.kind).toBe('unknown');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].code).toBe('svg-bytes-exceeded');
    // 공유 계약 details — 세 진단 API가 같은 스키마로 보고한다.
    expect(result.findings[0].details).toEqual({ actualBytes: 500, maxBytes: 100 });
  });
});

describe('estimateSourceBytes', () => {
  it('Blob은 .size를 반환한다', () => {
    const blob = new Blob(['<svg/>']);
    // Blob.size는 UTF-8 바이트 수와 일치한다.
    expect(estimateSourceBytes(blob, 'blob')).toBe(blob.size);
  });

  it('File도 .size를 반환한다 (Blob 서브클래스 — 동일 분기)', () => {
    const file = new File(['<svg/>'], 'icon.svg', { type: 'image/svg+xml' });
    expect(estimateSourceBytes(file, 'file')).toBe(file.size);
  });

  it('ASCII 문자열은 문자 수와 동일한 UTF-8 바이트 수를 반환한다', () => {
    const str = '<svg/>';
    // ASCII 범위에서는 문자 1개 = 1바이트.
    expect(estimateSourceBytes(str, 'string')).toBe(str.length);
  });

  it('url-string은 null을 반환한다', () => {
    // URL은 원격 리소스이므로 byte 추정 불가.
    expect(estimateSourceBytes('https://example.com/icon.svg', 'url-string')).toBeNull();
  });
});

describe('decideSvgFromSniff()', () => {
  it('bytes가 null이면 byte 체크를 건너뛰고 MIME 기준으로 판정한다', () => {
    // url-string 경로에서 bytes는 null이다
    const result = decideSvgFromSniff({
      originalKind: 'url-string',
      mime: 'image/svg+xml',
      extension: null,
      bytes: null,
      byteLimit: 10,
    });
    expect(result.kind).toBe('svg');
    expect(result.findings).toHaveLength(0);
  });
});
