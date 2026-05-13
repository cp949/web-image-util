/**
 * createFetchAbortHandle의 폴백 타이머 및 리스너 누수 차단 회귀 테스트.
 *
 * AbortSignal.timeout / AbortSignal.any 가 없는 환경을 강제 진입시켜
 * fetch 완료 후 타이머와 이벤트 리스너가 올바르게 정리되는지 검증한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { convertToImageElement } from '../../../src/core/source-converter';

// SVG fetch 응답에 사용할 최소 유효 SVG 문자열
const MINIMAL_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';

/**
 * image/svg+xml 타입의 Response 픽스처를 생성한다.
 *
 * 본문은 fake ReadableStream으로 제공한다. 진짜 Response + Blob 본문은 환경별로
 * 디코딩 동작이 미묘하게 달라 jsdom에서 `isInlineSvg` 검증을 통과하지 못하기 때문이다.
 * 이 테스트의 단정 대상은 SVG 디코딩이 아니라 dispose/타이머 정리라서 fake 본문으로 충분하다.
 */
function makeSvgResponse(): Response {
  return makeObservedSvgResponse(() => {});
}

/**
 * 본문 읽기 시점을 관찰할 수 있는 SVG Response 유사 객체를 생성한다.
 */
function makeObservedSvgResponse(onRead: () => void): Response {
  const encoder = new TextEncoder();
  const chunks = [encoder.encode(MINIMAL_SVG)];

  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'image/svg+xml' }),
    body: {
      getReader: () => ({
        read: vi.fn(async () => {
          onRead();
          const value = chunks.shift();
          return value ? { done: false, value } : { done: true, value: undefined };
        }),
        cancel: vi.fn(),
        releaseLock: vi.fn(),
      }),
    },
  } as unknown as Response;
}

describe('FetchAbortHandle 폴백 타이머 및 리스너 정리', () => {
  let originalTimeout: (typeof AbortSignal)['timeout'] | undefined;
  let originalAny: (typeof AbortSignal)['any'] | undefined;

  beforeEach(() => {
    // AbortSignal.timeout 폴백 경로를 강제 진입하기 위해 제거한다.
    originalTimeout = AbortSignal.timeout;
    (AbortSignal as any).timeout = undefined;

    // SVG 디코딩을 우회해 테스트를 단순하게 유지한다.
    (globalThis as any)._SVG_MOCK_MODE = true;

    vi.useFakeTimers();
  });

  afterEach(() => {
    (AbortSignal as any).timeout = originalTimeout;
    if (originalAny !== undefined) {
      (AbortSignal as any).any = originalAny;
    }
    delete (globalThis as any)._SVG_MOCK_MODE;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('요청 성공 후 dispose가 폴백 타이머를 정리한다', async () => {
    // clearTimeout 호출 여부를 추적한다.
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeSvgResponse());

    // abortSignal 없이 timeoutMs만 설정 → 폴백 타이머 경로로 진입
    // fetchTimeoutMs 옵션은 InternalSourceConverterOptions에서만 사용하므로 타입 단언으로 전달
    await convertToImageElement('https://example.com/icon.svg', {
      fetchTimeoutMs: 5000,
    } as any);

    // fetch 완료 후 dispose가 호출되어 clearTimeout이 실행되어야 한다.
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('원격 SVG 응답 본문을 읽은 뒤 폴백 타이머를 정리한다', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeObservedSvgResponse(() => {
        expect(clearTimeoutSpy).not.toHaveBeenCalled();
      })
    );

    await convertToImageElement('https://example.com/icon.svg', {
      fetchTimeoutMs: 5000,
    } as any);

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('요청 실패 시 finally에서 dispose가 호출되어 타이머가 정리된다', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('network error'));

    await expect(
      convertToImageElement('https://example.com/icon.svg', {
        fetchTimeoutMs: 5000,
      } as any)
    ).rejects.toThrow();

    // 에러 경로에서도 clearTimeout이 실행되어야 한다.
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('사용자 abort 경로에서도 폴백 타이머를 정리한다', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const userController = new AbortController();
    // fetch가 AbortError를 던지도록 mock한다.
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new DOMException('aborted by user', 'AbortError'));
    userController.abort();

    await expect(
      convertToImageElement('https://example.com/icon.svg', {
        fetchTimeoutMs: 5000,
        abortSignal: userController.signal,
      } as any)
    ).rejects.toThrow();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('AbortSignal.any도 없는 환경에서 fetch 완료 후 외부 signal listener를 제거한다', async () => {
    // AbortSignal.any 폴백 경로를 강제 진입한다.
    originalAny = AbortSignal.any;
    (AbortSignal as any).any = undefined;

    const removeEventListenerSpy = vi.spyOn(AbortSignal.prototype, 'removeEventListener');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeSvgResponse());

    const userController = new AbortController();

    // userSignal이 있어야 수동 결합 경로(AbortSignal.any 폴백)가 동작한다.
    await convertToImageElement('https://example.com/icon.svg', {
      fetchTimeoutMs: 5000,
      abortSignal: userController.signal,
    } as any);

    // dispose 시 addEventListener로 등록된 리스너가 제거되어야 한다.
    expect(removeEventListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function));
  });
});
