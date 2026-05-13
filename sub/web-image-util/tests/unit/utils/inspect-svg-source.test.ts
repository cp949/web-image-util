import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_SVG_BYTES } from '../../../src/core/source-converter/options';
import { ImageProcessError } from '../../../src/errors';
import { inspectSvgSource } from '../../../src/utils/inspect-svg-source';

describe('inspectSvgSource()', () => {
  describe('비-허용 입력 검증', () => {
    it('null 입력 시 ImageProcessError를 던진다', async () => {
      await expect(inspectSvgSource(null as any)).rejects.toBeInstanceOf(ImageProcessError);
    });

    it('null 입력 시 code가 SVG_SOURCE_INVALID이고 actualType이 "null"이다', async () => {
      await expect(inspectSvgSource(null as any)).rejects.toMatchObject({
        code: 'SVG_SOURCE_INVALID',
        details: { actualType: 'null' },
      });
    });

    it('undefined 입력 시 code가 SVG_SOURCE_INVALID이고 actualType이 "undefined"이다', async () => {
      await expect(inspectSvgSource(undefined as any)).rejects.toMatchObject({
        code: 'SVG_SOURCE_INVALID',
        details: { actualType: 'undefined' },
      });
    });

    it('숫자 입력 시 code가 SVG_SOURCE_INVALID이고 actualType이 "number"이다', async () => {
      await expect(inspectSvgSource(42 as any)).rejects.toMatchObject({
        code: 'SVG_SOURCE_INVALID',
        details: { actualType: 'number' },
      });
    });

    it('일반 객체 입력 시 code가 SVG_SOURCE_INVALID이고 actualType이 "object"이다', async () => {
      await expect(inspectSvgSource({} as any)).rejects.toMatchObject({
        code: 'SVG_SOURCE_INVALID',
        details: { actualType: 'object' },
      });
    });

    it('HTMLImageElement placeholder 객체 입력 시 code가 SVG_SOURCE_INVALID이다', async () => {
      const mockImg = { tagName: 'IMG', src: 'https://example.com/img.png' };
      await expect(inspectSvgSource(mockImg as any)).rejects.toMatchObject({
        code: 'SVG_SOURCE_INVALID',
        details: { actualType: 'object' },
      });
    });
  });

  describe('잘못된 options 검증', () => {
    const validInput = '<svg xmlns="http://www.w3.org/2000/svg"/>';

    it('options.fetch가 허용값 외일 때 OPTION_INVALID를 던진다', async () => {
      await expect(inspectSvgSource(validInput, { fetch: 'invalid' as any })).rejects.toMatchObject({
        code: 'OPTION_INVALID',
        details: { option: 'fetch' },
      });
    });

    it('options.byteLimit이 0일 때 OPTION_INVALID를 던진다', async () => {
      await expect(inspectSvgSource(validInput, { byteLimit: 0 })).rejects.toMatchObject({
        code: 'OPTION_INVALID',
        details: { option: 'byteLimit' },
      });
    });

    it('options.byteLimit이 음수일 때 OPTION_INVALID를 던진다', async () => {
      await expect(inspectSvgSource(validInput, { byteLimit: -1 })).rejects.toMatchObject({
        code: 'OPTION_INVALID',
        details: { option: 'byteLimit' },
      });
    });

    it('options.byteLimit이 MAX_SVG_BYTES + 1일 때 OPTION_INVALID를 던진다', async () => {
      await expect(inspectSvgSource(validInput, { byteLimit: MAX_SVG_BYTES + 1 })).rejects.toMatchObject({
        code: 'OPTION_INVALID',
        details: { option: 'byteLimit' },
      });
    });

    it('options.timeoutMs가 0일 때 OPTION_INVALID를 던진다', async () => {
      await expect(inspectSvgSource(validInput, { timeoutMs: 0 })).rejects.toMatchObject({
        code: 'OPTION_INVALID',
        details: { option: 'timeoutMs' },
      });
    });

    it('options.timeoutMs가 음수일 때 OPTION_INVALID를 던진다', async () => {
      await expect(inspectSvgSource(validInput, { timeoutMs: -1 })).rejects.toMatchObject({
        code: 'OPTION_INVALID',
        details: { option: 'timeoutMs' },
      });
    });

    it('options.timeoutMs가 비-정수(1.5)일 때 OPTION_INVALID를 던진다', async () => {
      await expect(inspectSvgSource(validInput, { timeoutMs: 1.5 })).rejects.toMatchObject({
        code: 'OPTION_INVALID',
        details: { option: 'timeoutMs' },
      });
    });

    it('options.signal이 AbortSignal이 아닌 문자열일 때 OPTION_INVALID를 던진다', async () => {
      await expect(inspectSvgSource(validInput, { signal: 'not-a-signal' as any })).rejects.toMatchObject({
        code: 'OPTION_INVALID',
        details: { option: 'signal' },
      });
    });
  });

  describe('정상 입력 — originalKind 판정', () => {
    it('inline SVG 문자열 입력 시 originalKind가 "string"이다', async () => {
      const result = await inspectSvgSource('<svg xmlns="http://www.w3.org/2000/svg"/>');
      expect(result.source.originalKind).toBe('string');
    });

    it('정상 string 입력 시 environment가 유효한 값이다', async () => {
      const result = await inspectSvgSource('<svg xmlns="http://www.w3.org/2000/svg"/>');
      expect(['browser', 'happy-dom', 'node', 'unknown']).toContain(result.environment);
    });

    it('Data URL 입력 시 originalKind가 "data-url"이다', async () => {
      const result = await inspectSvgSource('data:image/svg+xml;base64,PHN2Zy8+');
      expect(result.source.originalKind).toBe('data-url');
    });

    it('https URL 문자열 입력 시 originalKind가 "url-string"이다', async () => {
      const result = await inspectSvgSource('https://example.com/foo.svg');
      expect(result.source.originalKind).toBe('url-string');
    });

    it('URL 인스턴스 입력 시 originalKind가 "url-string"이다', async () => {
      const result = await inspectSvgSource(new URL('https://example.com/foo.svg'));
      expect(result.source.originalKind).toBe('url-string');
    });

    it('Blob 입력 시 originalKind가 "blob"이다', async () => {
      const blob = new Blob(['<svg/>'], { type: 'image/svg+xml' });
      const result = await inspectSvgSource(blob);
      expect(result.source.originalKind).toBe('blob');
    });

    it('File 입력 시 originalKind가 "file"이다', async () => {
      const file = new File(['<svg/>'], 'test.svg', { type: 'image/svg+xml' });
      const result = await inspectSvgSource(file);
      expect(result.source.originalKind).toBe('file');
    });
  });

  describe('환경 감지', () => {
    it('happy-dom 환경에서 environment가 "happy-dom"이다', async () => {
      const result = await inspectSvgSource('<svg xmlns="http://www.w3.org/2000/svg"/>');
      expect(result.environment).toBe('happy-dom');
    });
  });

  describe('MIME/확장자/Data URL/byte sniff 분기', () => {
    it('image/svg+xml MIME Blob → kind이 "svg"이고 mime이 "image/svg+xml"이다', async () => {
      const blob = new Blob(['<svg/>'], { type: 'image/svg+xml' });
      const result = await inspectSvgSource(blob);
      expect(result.kind).toBe('svg');
      expect(result.source.mime).toBe('image/svg+xml');
    });

    it('image/png MIME Blob → kind이 "not-svg-source"이다', async () => {
      const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
      const result = await inspectSvgSource(blob);
      expect(result.kind).toBe('not-svg-source');
    });

    it('.svg 확장자 + text/plain MIME File → kind이 "svg"이고 finding mime-mismatch가 있다', async () => {
      const file = new File(['<svg/>'], 'image.svg', { type: 'text/plain' });
      const result = await inspectSvgSource(file);
      expect(result.kind).toBe('svg');
      expect(result.findings.some((f) => f.code === 'mime-mismatch')).toBe(true);
    });

    it('image/svg+xml MIME + .png 확장자 File → kind이 "svg"이고 finding extension-mismatch가 있다', async () => {
      const file = new File(['<svg/>'], 'image.png', { type: 'image/svg+xml' });
      const result = await inspectSvgSource(file);
      expect(result.kind).toBe('svg');
      expect(result.findings.some((f) => f.code === 'extension-mismatch')).toBe(true);
    });

    it('SVG Data URL → kind이 "svg"이고 mime이 "image/svg+xml"이다', async () => {
      const result = await inspectSvgSource('data:image/svg+xml;base64,PHN2Zy8+');
      expect(result.kind).toBe('svg');
      expect(result.source.mime).toBe('image/svg+xml');
    });

    it('PNG Data URL → kind이 "not-svg-source"이다', async () => {
      const result = await inspectSvgSource(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg=='
      );
      expect(result.kind).toBe('not-svg-source');
    });

    it('inline SVG string → TASK-03 이후 본문 도출로 kind이 "svg"이다', async () => {
      const result = await inspectSvgSource('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
      expect(result.kind).toBe('svg');
    });

    it('byteLimit: 10 + 11바이트 비-SVG string → finding byte-limit-exceeded가 있고 kind이 "not-svg-source"이다', async () => {
      const result = await inspectSvgSource('hello world', { byteLimit: 10 });
      expect(result.findings.some((f) => f.code === 'byte-limit-exceeded')).toBe(true);
      expect(result.kind).toBe('not-svg-source');
    });
  });

  describe('본문 도출 — string / data-url / blob / file 경로', () => {
    const VALID_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';

    it('inline SVG string → kind이 "svg"이고 svg가 존재하며 valid가 true이고 consumed가 false이다', async () => {
      const result = await inspectSvgSource(VALID_SVG);
      expect(result.kind).toBe('svg');
      expect(result.svg).not.toBeNull();
      expect(result.svg?.valid).toBe(true);
      expect(result.source.consumed).toBe(false);
    });

    it('inline non-SVG string "<html></html>" → kind이 "not-svg-source"이고 svg.valid가 false이다', async () => {
      const result = await inspectSvgSource('<html></html>');
      expect(result.kind).toBe('not-svg-source');
      expect(result.svg?.valid).toBe(false);
    });

    it('SVG Data URL(charset) → kind이 "svg"이고 svg.valid가 true이고 consumed가 false이다', async () => {
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(VALID_SVG)}`;
      const result = await inspectSvgSource(dataUrl);
      expect(result.kind).toBe('svg');
      expect(result.svg?.valid).toBe(true);
      expect(result.source.consumed).toBe(false);
    });

    it('SVG Data URL base64 decode 실패 → finding "data-url-decode-failed"이 있고 kind이 "unknown"이다', async () => {
      const result = await inspectSvgSource('data:image/svg+xml;base64,!!!invalid!!!');
      expect(result.findings.some((f) => f.code === 'data-url-decode-failed')).toBe(true);
      expect(result.kind).toBe('unknown');
    });

    it('SVG MIME Blob 정상 본문 → kind이 "svg"이고 svg.valid가 true이고 consumed가 true이고 finding body-consumed-once가 있다', async () => {
      const blob = new Blob([VALID_SVG], { type: 'image/svg+xml' });
      const result = await inspectSvgSource(blob);
      expect(result.kind).toBe('svg');
      expect(result.svg?.valid).toBe(true);
      expect(result.source.consumed).toBe(true);
      expect(result.findings.some((f) => f.code === 'body-consumed-once')).toBe(true);
    });

    it('SVG MIME File 정상 본문 → kind이 "svg"이고 svg.valid가 true이고 consumed가 true이고 finding body-consumed-once가 있다', async () => {
      const file = new File([VALID_SVG], 'icon.svg', { type: 'image/svg+xml' });
      const result = await inspectSvgSource(file);
      expect(result.kind).toBe('svg');
      expect(result.svg?.valid).toBe(true);
      expect(result.source.consumed).toBe(true);
      expect(result.findings.some((f) => f.code === 'body-consumed-once')).toBe(true);
    });

    it('SVG MIME Blob 손상된 본문 "<not-svg>" → kind이 "svg"(MIME 기준)이고 svg.valid가 false이다', async () => {
      const blob = new Blob(['<not-svg>'], { type: 'image/svg+xml' });
      const result = await inspectSvgSource(blob);
      expect(result.kind).toBe('svg');
      expect(result.svg?.valid).toBe(false);
    });

    it('URL string 입력 → 본문 도출 시도 없이 svg가 null이다', async () => {
      const result = await inspectSvgSource('https://example.com/icon.svg');
      expect(result.svg).toBeNull();
    });
  });

  describe('Blob/File 본문 도출 byte 가드', () => {
    it('Blob.size가 byteLimit을 넘으면 .text() 호출 없이 finding byte-limit-exceeded가 있고 consumed가 false이다', async () => {
      const big = 'a'.repeat(2048);
      const blob = new Blob([big], { type: 'image/svg+xml' });
      let textCalls = 0;
      const original = blob.text.bind(blob);
      // .text() 호출 여부를 카운트한다 — 사전 가드가 작동하면 0이어야 한다.
      blob.text = (() => {
        textCalls += 1;
        return original();
      }) as Blob['text'];

      const result = await inspectSvgSource(blob, { byteLimit: 256 });

      expect(textCalls).toBe(0);
      expect(result.findings.some((f) => f.code === 'byte-limit-exceeded')).toBe(true);
      expect(result.source.consumed).toBe(false);
      expect(result.findings.some((f) => f.code === 'body-consumed-once')).toBe(false);
      expect(result.svg).toBeNull();
      expect(result.kind).toBe('unknown');
    });
  });

  describe('URL 입력 — fetch: "never" 모드', () => {
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

  describe('URL 입력 — fetch: "metadata" 모드', () => {
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

  describe('URL 입력 — fetch: "body" 모드', () => {
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

  describe('URL 입력 — abort / timeout', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('AbortError로 fetch 실패 시 finding fetch-aborted가 있고 throw 없이 report를 반환한다', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      const result = await inspectSvgSource('https://example.com/foo.svg', { fetch: 'body' });
      expect(result.findings.some((f) => f.code === 'fetch-aborted')).toBe(true);
    });

    it('TimeoutError로 fetch 실패 시 finding fetch-timeout이 있고 throw 없이 report를 반환한다', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('timeout'), { name: 'TimeoutError' })));
      const result = await inspectSvgSource('https://example.com/foo.svg', { fetch: 'body', timeoutMs: 1 });
      expect(result.findings.some((f) => f.code === 'fetch-timeout')).toBe(true);
    });

    it('네트워크 오류로 fetch 실패 시 finding fetch-failed가 있고 throw 없이 report를 반환한다', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
      const result = await inspectSvgSource('https://example.com/foo.svg', { fetch: 'body' });
      expect(result.findings.some((f) => f.code === 'fetch-failed')).toBe(true);
    });

    it('AbortError지만 signal.reason이 TimeoutError이면 fetch-timeout으로 분류한다', async () => {
      // 일부 런타임은 AbortSignal.timeout 발동 시 error.name='AbortError'를 던지고
      // 실제 사유는 signal.reason의 TimeoutError DOMException에 담는다.
      const controller = new AbortController();
      controller.abort(new DOMException('timed out', 'TimeoutError'));
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      const result = await inspectSvgSource('https://example.com/foo.svg', {
        fetch: 'body',
        signal: controller.signal,
      });
      expect(result.findings.some((f) => f.code === 'fetch-timeout')).toBe(true);
      expect(result.findings.some((f) => f.code === 'fetch-aborted')).toBe(false);
    });
  });

  describe('보고서 누출 방지 회귀', () => {
    /** report 객체의 모든 string 값을 재귀 순회해 수집하는 헬퍼. */
    function collectReportStrings(obj: unknown, results: string[] = []): string[] {
      if (typeof obj === 'string') {
        results.push(obj);
      } else if (Array.isArray(obj)) {
        for (const item of obj) collectReportStrings(item, results);
      } else if (obj !== null && typeof obj === 'object') {
        for (const value of Object.values(obj as Record<string, unknown>)) collectReportStrings(value, results);
      }
      return results;
    }

    const sentinelQueryToken = 'LEAKCANARY-QUERY-ISP-9XQ7';
    const sentinelFragmentToken = 'LEAKCANARY-FRAG-ISP-9XQ7';
    const sentinelDataUrlPayload = 'LEAKCANARY-DATAURL-ISP-9XQ7-PAYLOAD';
    const sentinelBlobBody = 'LEAKCANARY-BLOB-ISP-9XQ7-BODY';
    const sentinelHost = 'leakcanary-isp-host-9xq7.example.com';

    const sentinels = [
      sentinelQueryToken,
      sentinelFragmentToken,
      sentinelDataUrlPayload,
      sentinelBlobBody,
      sentinelHost,
      'LEAKCANARY-DATAURL-ISP', // sentinelDataUrlPayload 부분 문자열
      'LEAKCANARY-BLOB-ISP', // sentinelBlobBody 부분 문자열
    ];

    it('URL query/fragment sentinel이 report JSON에 포함되지 않는다', async () => {
      const urlInput = `https://inspect-test.example.com/path.svg?token=${sentinelQueryToken}#${sentinelFragmentToken}`;
      const result = await inspectSvgSource(urlInput, { fetch: 'never' });
      const json = JSON.stringify(result);
      for (const sentinel of sentinels) {
        expect(json, `sentinel "${sentinel}"이 report JSON에 포함됨`).not.toContain(sentinel);
      }
    });

    it('URL report의 모든 string 값에 sentinel substring이 없다', async () => {
      const urlInput = `https://inspect-test.example.com/path.svg?token=${sentinelQueryToken}#${sentinelFragmentToken}`;
      const result = await inspectSvgSource(urlInput, { fetch: 'never' });
      const strings = collectReportStrings(result);
      for (const sentinel of sentinels) {
        for (const str of strings) {
          expect(str, `report string "${str}"에 sentinel "${sentinel}" 포함`).not.toContain(sentinel);
        }
      }
    });

    it('Data URL base64 payload sentinel이 report JSON에 포함되지 않는다', async () => {
      const dataUrl = `data:image/svg+xml;base64,${sentinelDataUrlPayload}`;
      const result = await inspectSvgSource(dataUrl);
      const json = JSON.stringify(result);
      for (const sentinel of sentinels) {
        expect(json, `sentinel "${sentinel}"이 report JSON에 포함됨`).not.toContain(sentinel);
      }
    });

    it('Data URL report의 모든 string 값에 sentinel substring이 없다', async () => {
      const dataUrl = `data:image/svg+xml;base64,${sentinelDataUrlPayload}`;
      const result = await inspectSvgSource(dataUrl);
      const strings = collectReportStrings(result);
      for (const sentinel of sentinels) {
        for (const str of strings) {
          expect(str, `report string "${str}"에 sentinel "${sentinel}" 포함`).not.toContain(sentinel);
        }
      }
    });

    it('Blob sentinel 본문과 외부 URL이 report JSON에 포함되지 않는다', async () => {
      const blobSvg = `<svg xmlns="http://www.w3.org/2000/svg"><a href="https://${sentinelHost}/page">${sentinelBlobBody}</a></svg>`;
      const blob = new Blob([blobSvg], { type: 'image/svg+xml' });
      const result = await inspectSvgSource(blob);
      const json = JSON.stringify(result);
      for (const sentinel of sentinels) {
        expect(json, `sentinel "${sentinel}"이 report JSON에 포함됨`).not.toContain(sentinel);
      }
    });

    it('Blob report의 모든 string 값에 sentinel substring이 없다', async () => {
      const blobSvg = `<svg xmlns="http://www.w3.org/2000/svg"><a href="https://${sentinelHost}/page">${sentinelBlobBody}</a></svg>`;
      const blob = new Blob([blobSvg], { type: 'image/svg+xml' });
      const result = await inspectSvgSource(blob);
      const strings = collectReportStrings(result);
      for (const sentinel of sentinels) {
        for (const str of strings) {
          expect(str, `report string "${str}"에 sentinel "${sentinel}" 포함`).not.toContain(sentinel);
        }
      }
    });
  });

  describe('URL 마스킹 / 누출 방지', () => {
    it('Data URL의 base64 payload가 report JSON에 포함되지 않는다', async () => {
      const SENTINEL = 'SENTINEL_BASE64_PAYLOAD_XYZ';
      const dataUrl = `data:image/svg+xml;base64,${SENTINEL}`;
      const result = await inspectSvgSource(dataUrl);
      const json = JSON.stringify(result);
      expect(json).not.toContain(SENTINEL);
    });

    it('URL query token과 fragment가 report JSON에 포함되지 않는다', async () => {
      const result = await inspectSvgSource('https://h.example/path/to/foo.svg?token=MYTOKEN123#MYFRAG456', {
        fetch: 'never',
      });
      const json = JSON.stringify(result);
      expect(json).not.toContain('MYTOKEN123');
      expect(json).not.toContain('MYFRAG456');
    });

    it('URL 인스턴스 입력도 query/fragment가 마스킹된다', async () => {
      const url = new URL('https://cdn.example/icon.svg?sso=SSOTOKEN&x=1#anchor');
      const result = await inspectSvgSource(url, { fetch: 'never' });
      expect(result.source.url).toBe('https://cdn.example/icon.svg');
      const json = JSON.stringify(result);
      expect(json).not.toContain('SSOTOKEN');
    });
  });
});
