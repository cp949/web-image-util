import { describe, expect, it } from 'vitest';
import type { InspectSvgSourceFinding } from '../../../src/utils/inspect-svg-source';
import { deduplicateFindings, maskSourceUrl } from '../../../src/utils/inspect-svg-source/report-utils';

describe('maskSourceUrl()', () => {
  describe('URL query/fragment 제거', () => {
    it('http URL에서 query/fragment를 제거하고 origin+path만 반환한다', () => {
      const result = maskSourceUrl('https://example.com/path/to/icon.svg?token=SECRET&x=1#anchor', 'url-string');
      expect(result).toBe('https://example.com/path/to/icon.svg');
    });

    it('URL 인스턴스도 query/fragment를 제거한다', () => {
      const url = new URL('https://cdn.example/icon.svg?sso=TOKEN#frag');
      const result = maskSourceUrl(url, 'url-string');
      expect(result).toBe('https://cdn.example/icon.svg');
    });

    it('query/fragment 없는 URL은 origin+path 그대로 반환한다', () => {
      const result = maskSourceUrl('https://example.com/img.svg', 'url-string');
      expect(result).toBe('https://example.com/img.svg');
    });

    it('protocol-relative URL도 정규화하고 query/fragment를 제거한다', () => {
      const result = maskSourceUrl('//cdn.example.com/path/icon.svg?token=SECRET#frag', 'url-string');
      const expected = new URL('//cdn.example.com/path/icon.svg', globalThis.location?.href ?? 'http://localhost');
      expect(result).toBe(`${expected.origin}${expected.pathname}`);
      expect(result).not.toContain('SECRET');
      expect(result).not.toContain('frag');
    });
  });

  describe('Data URL payload 마스킹', () => {
    it('base64 Data URL payload를 [masked]로 대체한다', () => {
      const dataUrl = 'data:image/svg+xml;base64,PAYLOAD_SENTINEL_DATA';
      const result = maskSourceUrl(dataUrl, 'data-url');
      expect(result).toBe('data:image/svg+xml[;base64],[masked]');
    });

    it('Data URL payload가 report에 포함되지 않는다', () => {
      const SENTINEL = 'SENTINEL_PAYLOAD_XYZ';
      const dataUrl = `data:image/svg+xml;base64,${SENTINEL}`;
      const result = maskSourceUrl(dataUrl, 'data-url');
      expect(result).not.toContain(SENTINEL);
    });

    it('MIME 없는 Data URL도 마스킹된다', () => {
      const result = maskSourceUrl('data:,somedata', 'data-url');
      expect(result).toBe('data:[;base64],[masked]');
    });
  });

  describe('blob: URL', () => {
    it('blob: URL은 origin+pathname이 아닌 protocol+pathname으로 반환한다', () => {
      const result = maskSourceUrl('blob:https://example.com/uuid-1234-5678', 'url-string');
      expect(result).toBe('blob:https://example.com/uuid-1234-5678');
    });

    it('blob: URL의 query/fragment를 제거한다', () => {
      const result = maskSourceUrl('blob:https://example.com/uuid?q=secret#frag', 'url-string');
      expect(result).toBe('blob:https://example.com/uuid');
      expect(result).not.toContain('secret');
    });
  });

  describe('unsupported protocol 마스킹', () => {
    it('file: 프로토콜 URL은 protocol://[masked] 형태로 반환한다', () => {
      const result = maskSourceUrl('file:///etc/passwd', 'url-string');
      expect(result).toBe('file://[masked]');
    });

    it('ftp: 프로토콜 URL은 protocol://[masked] 형태로 반환한다', () => {
      const result = maskSourceUrl('ftp://secret.host/file.svg', 'url-string');
      expect(result).toBe('ftp://[masked]');
    });
  });

  describe('data: URL 인스턴스 — url-string kind로 오분류된 경우', () => {
    it('payload를 노출하지 않고 protocol://[masked] 형태를 반환한다', () => {
      const url = new URL('data:image/svg+xml,<svg><secret>payload123</secret></svg>');
      const result = maskSourceUrl(url, 'url-string');
      expect(result).toBe('data://[masked]');
      expect(result).not.toContain('payload123');
      expect(result).not.toContain('<svg');
    });
  });

  describe('null 반환 경우', () => {
    it('string originalKind는 null을 반환한다', () => {
      expect(maskSourceUrl('<svg/>', 'string')).toBeNull();
    });

    it('blob originalKind는 null을 반환한다', () => {
      const blob = new Blob(['<svg/>'], { type: 'image/svg+xml' });
      expect(maskSourceUrl(blob, 'blob')).toBeNull();
    });

    it('file originalKind는 null을 반환한다', () => {
      const file = new File(['<svg/>'], 'icon.svg', { type: 'image/svg+xml' });
      expect(maskSourceUrl(file, 'file')).toBeNull();
    });
  });
});

describe('deduplicateFindings()', () => {
  it('finding code 기준으로 중복을 제거한다', () => {
    const findings: InspectSvgSourceFinding[] = [
      { code: 'fetch-failed', message: '첫 번째' },
      { code: 'byte-limit-exceeded', message: '두 번째' },
      { code: 'fetch-failed', message: '중복 — 제거 대상' },
    ];
    const result = deduplicateFindings(findings);
    expect(result).toHaveLength(2);
    expect(result[0].code).toBe('fetch-failed');
    expect(result[1].code).toBe('byte-limit-exceeded');
  });

  it('첫 번째 등장 항목을 유지한다', () => {
    const findings: InspectSvgSourceFinding[] = [
      { code: 'fetch-failed', message: '원본 메시지' },
      { code: 'fetch-failed', message: '중복 메시지' },
    ];
    const result = deduplicateFindings(findings);
    expect(result[0].message).toBe('원본 메시지');
  });

  it('빈 배열은 빈 배열을 반환한다', () => {
    expect(deduplicateFindings([])).toEqual([]);
  });

  it('중복 없는 배열은 그대로 반환한다', () => {
    const findings: InspectSvgSourceFinding[] = [
      { code: 'fetch-failed', message: 'a' },
      { code: 'byte-limit-exceeded', message: 'b' },
      { code: 'mime-mismatch', message: 'c' },
    ];
    const result = deduplicateFindings(findings);
    expect(result).toHaveLength(3);
  });
});
