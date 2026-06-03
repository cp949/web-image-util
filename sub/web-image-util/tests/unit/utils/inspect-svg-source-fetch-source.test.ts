import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleUrlSvgSourceFetch } from '../../../src/utils/inspect-svg-source/fetch-source.internal';

describe('handleUrlSvgSourceFetch()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetch: never이면 fetch를 수행하지 않고 fetch-disabled-by-option을 반환한다', async () => {
    const result = await handleUrlSvgSourceFetch({
      source: 'https://example.com/icon.svg',
      mime: null,
      extension: 'svg',
      bytes: null,
      kind: 'svg',
      findings: [],
      options: { fetch: 'never' },
      byteLimit: 10_000,
    });

    expect(result.kind).toBe('svg');
    expect(result.fetchInfo).toEqual({ mode: 'never', performed: false, status: null });
    expect(result.findings.some((finding) => finding.code === 'fetch-disabled-by-option')).toBe(true);
  });

  it('metadata 모드는 HEAD 응답의 MIME과 Content-Length를 반영한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 200,
          headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Content-Length': '123',
          },
        })
      )
    );

    const result = await handleUrlSvgSourceFetch({
      source: 'https://example.com/icon.svg',
      mime: null,
      extension: 'svg',
      bytes: null,
      kind: 'svg',
      findings: [],
      options: { fetch: 'metadata' },
      byteLimit: 10_000,
    });

    expect(result.kind).toBe('svg');
    expect(result.mime).toBe('image/svg+xml');
    expect(result.bytes).toBe(123);
    expect(result.consumed).toBe(false);
    expect(result.fetchInfo).toEqual({ mode: 'metadata', performed: true, status: 200 });
  });

  it('body 모드는 GET 본문을 inspectSvg 리포트로 변환하고 consumed를 true로 반환한다', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(svg, {
          status: 200,
          headers: { 'Content-Type': 'image/svg+xml' },
        })
      )
    );

    const result = await handleUrlSvgSourceFetch({
      source: 'https://example.com/icon.svg',
      mime: null,
      extension: 'svg',
      bytes: null,
      kind: 'svg',
      findings: [],
      options: { fetch: 'body' },
      byteLimit: 10_000,
    });

    expect(result.kind).toBe('svg');
    expect(result.svgReport?.valid).toBe(true);
    expect(result.consumed).toBe(true);
    expect(result.findings.some((finding) => finding.code === 'body-consumed-once')).toBe(true);
    expect(result.fetchInfo).toEqual({ mode: 'body', performed: true, status: 200 });
  });
});
