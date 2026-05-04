import { describe, expect, it, vi } from 'vitest';
import { ImageProcessError } from '../../../../src';
import { fetchImageSourceBlob } from '../../../../src/utils';

describe('fetchImageSourceBlob', () => {
  it('fetch만 수행하고 Blob metadata를 반환한다', async () => {
    const originalFetch = globalThis.fetch;
    const body = new Uint8Array([1, 2, 3]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': '3',
        },
      })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const result = await fetchImageSourceBlob('https://example.com/image', {
        fetchOptions: { credentials: 'omit', mode: 'cors' },
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/image',
        expect.objectContaining({
          method: 'GET',
          credentials: 'omit',
          mode: 'cors',
        })
      );
      expect(result.bytes).toBe(3);
      expect(result.contentType).toBe('image/png');
      expect(result.url).toBe('https://example.com/image');
      expect(result.status).toBe(200);
      expect(result.blob.type).toBe('image/png');
      await expect(result.blob.arrayBuffer()).resolves.toHaveProperty('byteLength', 3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('cast로 들어온 fetchOptions method/body/signal을 무시한다', async () => {
    const originalFetch = globalThis.fetch;
    const otherController = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1]), {
        headers: { 'content-type': 'image/png' },
      })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await fetchImageSourceBlob('https://example.com/image', {
        fetchOptions: {
          method: 'POST',
          body: 'x',
          signal: otherController.signal,
          credentials: 'omit',
        } as RequestInit,
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe('GET');
      expect(init.credentials).toBe('omit');
      expect(init).not.toHaveProperty('body');
      expect(init).not.toHaveProperty('signal');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('허용되지 않은 protocol을 fetch 전에 거부한다', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(fetchImageSourceBlob('data:image/png;base64,abc')).rejects.toMatchObject({
        code: 'INVALID_SOURCE',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('Content-Length가 maxBytes를 초과하면 본문 읽기 전에 거부한다', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('too large', {
        headers: { 'content-length': '9', 'content-type': 'image/png' },
      })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(fetchImageSourceBlob('https://example.com/image', { maxBytes: 8 })).rejects.toMatchObject({
        code: 'SOURCE_BYTES_EXCEEDED',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('Content-Length 초과 시 body stream을 cancel한다', async () => {
    const originalFetch = globalThis.fetch;
    const cancelMock = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3, 4]));
      },
      cancel: cancelMock,
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(stream, {
        headers: { 'content-length': '9', 'content-type': 'image/png' },
      })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(fetchImageSourceBlob('https://example.com/image', { maxBytes: 8 })).rejects.toMatchObject({
        code: 'SOURCE_BYTES_EXCEEDED',
      });
      expect(cancelMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('stream 누적 byte가 maxBytes를 초과하면 reader를 cancel한다', async () => {
    const originalFetch = globalThis.fetch;
    const cancelMock = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3, 4]));
      },
      cancel: cancelMock,
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(stream, { headers: { 'content-type': 'image/png' } }));
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(fetchImageSourceBlob('https://example.com/image', { maxBytes: 3 })).rejects.toMatchObject({
        code: 'SOURCE_BYTES_EXCEEDED',
      });
      expect(cancelMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('stream 초과 시 cancel 실패가 발생해도 SOURCE_BYTES_EXCEEDED를 유지한다', async () => {
    const originalFetch = globalThis.fetch;
    const cancelMock = vi.fn().mockRejectedValue(new Error('cancel failed'));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3, 4]));
      },
      cancel: cancelMock,
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(stream, { headers: { 'content-type': 'image/png' } }));
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(fetchImageSourceBlob('https://example.com/image', { maxBytes: 3 })).rejects.toMatchObject({
        code: 'SOURCE_BYTES_EXCEEDED',
      });
      expect(cancelMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('stream 본문 읽기 실패를 SOURCE_LOAD_FAILED로 반환한다', async () => {
    const originalFetch = globalThis.fetch;
    const stream = new ReadableStream<Uint8Array>({
      pull() {
        throw new Error('read failed');
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(stream, { headers: { 'content-type': 'image/png' } }));
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(fetchImageSourceBlob('https://example.com/image')).rejects.toMatchObject({
        code: 'SOURCE_LOAD_FAILED',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('no-stream blob 읽기 실패를 SOURCE_LOAD_FAILED로 반환한다', async () => {
    const originalFetch = globalThis.fetch;
    const responseLike = {
      body: null,
      ok: true,
      headers: new Headers({ 'content-type': 'image/png' }),
      status: 200,
      url: 'https://cdn.example.com/image',
      blob: vi.fn().mockRejectedValue(new Error('blob failed')),
    };
    const fetchMock = vi.fn().mockResolvedValue(responseLike);
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(fetchImageSourceBlob('https://example.com/image')).rejects.toMatchObject({
        code: 'SOURCE_LOAD_FAILED',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('성공 후 timeout timer를 정리한다', async () => {
    const originalFetch = globalThis.fetch;
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([1])));
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await fetchImageSourceBlob('https://example.com/image', { timeoutMs: 1000 });
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
      vi.useRealTimers();
    }
  });

  it('성공 후 caller abort listener를 제거한다', async () => {
    const originalFetch = globalThis.fetch;
    const controller = new AbortController();
    const addEventListenerSpy = vi.spyOn(controller.signal, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(controller.signal, 'removeEventListener');
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([1])));
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await fetchImageSourceBlob('https://example.com/image', { abortSignal: controller.signal });

      const abortListenerCall = addEventListenerSpy.mock.calls.find(([type]) => type === 'abort');
      expect(abortListenerCall).toBeDefined();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('abort', abortListenerCall?.[1]);
    } finally {
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
      globalThis.fetch = originalFetch;
    }
  });

  it('timeout으로 중단된 fetch를 SOURCE_LOAD_FAILED로 반환한다', async () => {
    const originalFetch = globalThis.fetch;
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), {
            once: true,
          });
        })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const promise = fetchImageSourceBlob('https://example.com/image', { timeoutMs: 1000 });
      const assertion = expect(promise).rejects.toMatchObject({ code: 'SOURCE_LOAD_FAILED' });
      await vi.advanceTimersByTimeAsync(1000);
      await assertion;
      expect(fetchMock).toHaveBeenCalledWith('https://example.com/image', expect.objectContaining({ method: 'GET' }));
    } finally {
      globalThis.fetch = originalFetch;
      vi.useRealTimers();
    }
  });

  it('HTTP 실패를 SOURCE_LOAD_FAILED로 반환한다', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(new Response('missing', { status: 404 }));
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(fetchImageSourceBlob('https://example.com/missing')).rejects.toBeInstanceOf(ImageProcessError);
      await expect(fetchImageSourceBlob('https://example.com/missing')).rejects.toMatchObject({
        code: 'SOURCE_LOAD_FAILED',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
