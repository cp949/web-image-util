import { afterEach, describe, expect, it, vi } from 'vitest';
import { inspectSvgSource } from '../../../src/utils/inspect-svg-source';

describe('inspectSvgSource() — fetch 실패(abort / timeout / network)', () => {
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
