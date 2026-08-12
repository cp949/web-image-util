import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleUrlSvgSourceFetch } from '../../../src/utils/inspect-svg-source/fetch-source.internal';

describe('handleUrlSvgSourceFetch()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('BOM이 붙은 스트림 본문의 bytes는 수신한 원시 바이트 수를 보고한다', async () => {
    // TextDecoder가 BOM을 제거하므로, 디코드한 문자열을 재인코딩해 세면 3바이트가 사라진다.
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';
    const bodyBytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(svg)]);

    const response = {
      ok: true,
      status: 200,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bodyBytes);
          controller.close();
        },
      }),
      headers: new Headers({ 'Content-Type': 'image/svg+xml' }),
    } as unknown as Response;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

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

    expect(result.bytes).toBe(bodyBytes.byteLength);
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

  it('스트림 없는 본문이 byteLimit을 초과하면 측정한 actualBytes를 보존한다', async () => {
    const response = {
      ok: true,
      status: 200,
      body: null,
      headers: new Headers({ 'Content-Type': 'image/svg+xml' }),
      text: vi.fn().mockResolvedValue('a'.repeat(101)),
    } as unknown as Response;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    const result = await handleUrlSvgSourceFetch({
      source: 'https://example.com/icon.svg',
      mime: null,
      extension: 'svg',
      bytes: null,
      kind: 'svg',
      findings: [],
      options: { fetch: 'body' },
      byteLimit: 100,
    });

    expect(result.findings.find((finding) => finding.code === 'svg-bytes-exceeded')?.details).toEqual({
      actualBytes: 101,
      maxBytes: 100,
    });
  });
});
