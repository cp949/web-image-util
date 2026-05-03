import { describe, expect, it, vi } from 'vitest';
import { ImageProcessError } from '../../../src';
import {
  fetchImageFormat,
  fetchImageSourceBlob,
  getImageAspectRatio,
  getImageDimensions,
  getImageFormat,
  getImageInfo,
  getImageOrientation,
} from '../../../src/utils';

describe('image info utilities', () => {
  it('캔버스 치수는 이미지 변환 없이 캔버스 속성에서 바로 반환한다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const toDataURLSpy = vi.spyOn(canvas, 'toDataURL');

    await expect(getImageDimensions(canvas)).resolves.toEqual({ width: 320, height: 180 });
    expect(toDataURLSpy).not.toHaveBeenCalled();
  });

  it('SVG 문자열의 치수와 포맷을 한 번의 SVG 파싱 결과로 반환한다', async () => {
    const svg = '<svg width="240" height="135" xmlns="http://www.w3.org/2000/svg"></svg>';

    await expect(getImageInfo(svg)).resolves.toEqual({ width: 240, height: 135, format: 'svg' });
  });

  it('SVG Blob은 렌더링 목 경로로 떨어지지 않고 SVG 원본 치수를 반환한다', async () => {
    const svg = '<svg width="256" height="144" xmlns="http://www.w3.org/2000/svg"></svg>';
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const textSpy = vi.spyOn(blob, 'text');

    await expect(getImageInfo(blob)).resolves.toEqual({ width: 256, height: 144, format: 'svg' });
    expect(textSpy).toHaveBeenCalledTimes(1);
  });

  it('Blob MIME만으로 포맷을 단독 조회한다', async () => {
    const blob = new Blob(['mock'], { type: 'image/webp' });
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');

    await expect(getImageFormat(blob)).resolves.toBe('webp');
    expect(createObjectURLSpy).not.toHaveBeenCalled();
  });

  it('fetchImageFormat은 확장자가 없는 URL의 응답 바이트를 읽어 실제 래스터 포맷을 반환한다', async () => {
    const originalFetch = globalThis.fetch;
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(pngBytes, {
        headers: { 'content-type': 'application/octet-stream' },
      })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(fetchImageFormat('https://example.com/image')).resolves.toBe('png');
      expect(fetchMock).toHaveBeenCalledWith('https://example.com/image', expect.objectContaining({ method: 'GET' }));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('fetchImageFormat은 확장자가 없는 URL의 SVG 응답을 텍스트 루트로 스니핑한다', async () => {
    const originalFetch = globalThis.fetch;
    const svg = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(svg, {
        headers: { 'content-type': 'text/plain' },
      })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(fetchImageFormat('https://example.com/vector')).resolves.toBe('svg');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('getImageFormat은 확장자로 포맷을 알 수 있는 URL을 네트워크 요청 없이 반환한다', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(getImageFormat('https://example.com/photo.webp?cache=1')).resolves.toBe('webp');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('fetchImageFormat은 확장자가 있는 URL도 응답 바이트로 실제 포맷을 반환한다', async () => {
    const originalFetch = globalThis.fetch;
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(pngBytes, {
        headers: { 'content-type': 'application/octet-stream' },
      })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(fetchImageFormat('https://example.com/photo.webp')).resolves.toBe('png');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('fetch가 실패하면 예외 대신 unknown을 반환한다', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockRejectedValue(new Error('network failed'));
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(fetchImageFormat('https://example.com/image')).resolves.toBe('unknown');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('fetchImageSourceBlob은 fetch만 수행하고 Blob metadata를 반환한다', async () => {
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

  it('fetchImageSourceBlob은 cast로 들어온 fetchOptions method/body/signal을 무시한다', async () => {
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

  it('fetchImageSourceBlob은 허용되지 않은 protocol을 fetch 전에 거부한다', async () => {
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

  it('fetchImageSourceBlob은 Content-Length가 maxBytes를 초과하면 본문 읽기 전에 거부한다', async () => {
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

  it('fetchImageSourceBlob은 Content-Length 초과 시 body stream을 cancel한다', async () => {
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

  it('fetchImageSourceBlob은 stream 누적 byte가 maxBytes를 초과하면 reader를 cancel한다', async () => {
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

  it('fetchImageSourceBlob은 stream 초과 시 cancel 실패가 발생해도 SOURCE_BYTES_EXCEEDED를 유지한다', async () => {
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

  it('fetchImageSourceBlob은 stream 본문 읽기 실패를 SOURCE_LOAD_FAILED로 반환한다', async () => {
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

  it('fetchImageSourceBlob은 no-stream blob 읽기 실패를 SOURCE_LOAD_FAILED로 반환한다', async () => {
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

  it('fetchImageSourceBlob은 성공 후 timeout timer를 정리한다', async () => {
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

  it('fetchImageSourceBlob은 성공 후 caller abort listener를 제거한다', async () => {
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

  it('fetchImageSourceBlob은 timeout으로 중단된 fetch를 SOURCE_LOAD_FAILED로 반환한다', async () => {
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

  it('fetchImageSourceBlob은 HTTP 실패를 SOURCE_LOAD_FAILED로 반환한다', async () => {
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

  it('응답 상태가 실패이면 unknown을 반환한다', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(new Response('not found', { status: 404 }));
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(fetchImageFormat('https://example.com/missing')).resolves.toBe('unknown');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('prefix를 충분히 읽은 뒤 스트림 cancel이 실패해도 판정 결과를 반환한다', async () => {
    const originalFetch = globalThis.fetch;
    const cancelMock = vi.fn().mockRejectedValue(new Error('cancel failed'));
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(pngBytes);
      },
      cancel: cancelMock,
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(stream));
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(fetchImageFormat('https://example.com/image', { sniffBytes: 8 })).resolves.toBe('png');
      expect(cancelMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('확장자가 없는 bare 문자열은 URL로 간주하지 않고 fetch하지 않는다', async () => {
    const originalFetch = globalThis.fetch;
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(pngBytes));
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(fetchImageFormat('image-id')).resolves.toBe('unknown');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('명시적 URL과 브라우저 경로 문자열만 fetch 대상으로 처리한다', async () => {
    const originalFetch = globalThis.fetch;
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const fetchableSources = [
      'http://example.com/image',
      'https://example.com/image',
      'blob:https://example.com/image-id',
      '//cdn.example.com/image',
      '/assets/image',
      './assets/image',
      '../assets/image',
    ];
    const nonFetchableSources = [
      '',
      'data:image/png;base64,iVBORw0KGgo=',
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      'image-id',
    ];
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(pngBytes)));
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      for (const source of fetchableSources) {
        await expect(fetchImageFormat(source)).resolves.toBe('png');
      }

      expect(fetchMock).toHaveBeenCalledTimes(fetchableSources.length);
      for (const source of fetchableSources) {
        expect(fetchMock).toHaveBeenCalledWith(source, expect.objectContaining({ method: 'GET' }));
      }

      for (const source of nonFetchableSources) {
        await expect(fetchImageFormat(source)).resolves.toBe('unknown');
      }

      expect(fetchMock).toHaveBeenCalledTimes(fetchableSources.length);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('바이트와 SVG 스니핑으로 판정하지 못하면 Content-Type으로 포맷을 반환한다', async () => {
    const originalFetch = globalThis.fetch;
    const unknownBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(unknownBytes, {
        headers: { 'content-type': 'image/gif; charset=binary' },
      })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(fetchImageFormat('https://example.com/image')).resolves.toBe('gif');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('Blob 정보 조회는 MIME 포맷을 재사용하고 이미지 로딩을 중복하지 않는다', async () => {
    const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
    const textSpy = vi.spyOn(blob, 'text');
    const arrayBufferSpy = vi.spyOn(blob, 'arrayBuffer');

    await expect(getImageInfo(blob)).resolves.toEqual({ width: 100, height: 100, format: 'png' });
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(textSpy).not.toHaveBeenCalled();
    expect(arrayBufferSpy).not.toHaveBeenCalled();
  });

  it('치수만 조회할 때는 Blob 포맷 판정을 위한 추가 읽기를 하지 않는다', async () => {
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const textSpy = vi.spyOn(blob, 'text');
    const arrayBufferSpy = vi.spyOn(blob, 'arrayBuffer');

    await expect(getImageDimensions(blob)).resolves.toEqual({ width: 100, height: 100 });
    expect(textSpy).not.toHaveBeenCalled();
    expect(arrayBufferSpy).not.toHaveBeenCalled();
  });

  it('캔버스 이미지 비율을 반환한다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    await expect(getImageAspectRatio(canvas)).resolves.toBeCloseTo(16 / 9, 5);
  });

  it('이미지 방향을 landscape, portrait, square로 반환한다', async () => {
    const landscape = document.createElement('canvas');
    landscape.width = 320;
    landscape.height = 180;

    const portrait = document.createElement('canvas');
    portrait.width = 180;
    portrait.height = 320;

    const square = document.createElement('canvas');
    square.width = 200;
    square.height = 200;

    await expect(getImageOrientation(landscape)).resolves.toBe('landscape');
    await expect(getImageOrientation(portrait)).resolves.toBe('portrait');
    await expect(getImageOrientation(square)).resolves.toBe('square');
  });
});
