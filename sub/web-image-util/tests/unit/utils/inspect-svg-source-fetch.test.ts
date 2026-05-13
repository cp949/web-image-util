import { afterEach, describe, expect, it, vi } from 'vitest';
import { inspectSvgSource } from '../../../src/utils/inspect-svg-source';

describe('inspectSvgSource() — fetch: "never" 모드', () => {
  it('.svg 확장자 URL → kind이 "svg"이고 source.url이 마스킹되고 fetch-disabled-by-option이 있으며 fetch 정보가 채워진다', async () => {
    const result = await inspectSvgSource('https://example.com/foo.svg', { fetch: 'never' });
    expect(result.kind).toBe('svg');
    expect(result.source.url).toBe('https://example.com/foo.svg');
    expect(result.findings.some((f) => f.code === 'fetch-disabled-by-option')).toBe(true);
    expect(result.fetch).toEqual({ mode: 'never', performed: false, status: null });
  });

  it('.png 확장자 URL → kind이 "not-svg-source"이고 finding source-kind-unsupported가 있다', async () => {
    const result = await inspectSvgSource('https://example.com/foo.png', { fetch: 'never' });
    expect(result.kind).toBe('not-svg-source');
    expect(result.findings.some((f) => f.code === 'source-kind-unsupported')).toBe(true);
  });

  it('javascript: URL → finding fetch-protocol-disallowed 또는 fetch-blocked-policy가 있다', async () => {
    const result = await inspectSvgSource('javascript:alert(1)' as unknown as string);
    const blockFindings = result.findings.filter(
      (f) => f.code === 'fetch-protocol-disallowed' || f.code === 'fetch-blocked-policy'
    );
    expect(blockFindings.length).toBeGreaterThan(0);
  });

  it('query/fragment가 있는 URL → source.url에 query/fragment가 없다', async () => {
    const result = await inspectSvgSource('https://h.example/path/to/foo.svg?token=SECRET#frag', { fetch: 'never' });
    expect(result.source.url).toBe('https://h.example/path/to/foo.svg');
    const json = JSON.stringify(result);
    expect(json).not.toContain('SECRET');
    expect(json).not.toContain('frag');
  });

  it('fetch: 옵션 미지정 시 기본 never 모드로 동작해 svg가 null이다', async () => {
    const result = await inspectSvgSource('https://example.com/icon.svg');
    expect(result.svg).toBeNull();
    expect(result.fetch?.mode).toBe('never');
  });
});

describe('inspectSvgSource() — fetch: "metadata" 모드', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('HEAD 200 + SVG MIME → kind이 "svg"이고 fetch.performed가 true이며 consumed가 false이다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 200,
          headers: { 'Content-Type': 'image/svg+xml' },
        })
      )
    );
    const result = await inspectSvgSource('https://example.com/foo.svg', { fetch: 'metadata' });
    expect(result.kind).toBe('svg');
    expect(result.fetch?.performed).toBe(true);
    expect(result.fetch?.status).toBe(200);
    expect(result.source.consumed).toBe(false);
  });

  it('HEAD 404 응답 → finding fetch-status-error가 있다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 404,
          headers: {},
        })
      )
    );
    const result = await inspectSvgSource('https://example.com/foo.svg', { fetch: 'metadata' });
    expect(result.findings.some((f) => f.code === 'fetch-status-error')).toBe(true);
  });
});

describe('inspectSvgSource() — fetch: "body" 모드', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('SVG 본문 응답 → kind이 "svg"이고 svg.valid가 true이며 consumed가 true이고 body-consumed-once가 있다', async () => {
    const VALID_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(VALID_SVG, {
          status: 200,
          headers: { 'Content-Type': 'image/svg+xml' },
        })
      )
    );
    const result = await inspectSvgSource('https://example.com/foo.svg', { fetch: 'body' });
    expect(result.kind).toBe('svg');
    expect(result.svg?.valid).toBe(true);
    expect(result.source.consumed).toBe(true);
    expect(result.findings.some((f) => f.code === 'body-consumed-once')).toBe(true);
  });

  it('Content-Length가 byteLimit 초과 → finding byte-limit-exceeded이고 kind이 "unknown"이다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('a'.repeat(500), {
          status: 200,
          headers: {
            'Content-Type': 'image/svg+xml',
            'Content-Length': '500',
          },
        })
      )
    );
    const result = await inspectSvgSource('https://example.com/foo.svg', { fetch: 'body', byteLimit: 100 });
    expect(result.findings.some((f) => f.code === 'byte-limit-exceeded')).toBe(true);
    expect(result.kind).toBe('unknown');
  });
});
