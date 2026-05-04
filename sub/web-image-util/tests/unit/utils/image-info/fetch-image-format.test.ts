import { describe, expect, it, vi } from 'vitest';
import { fetchImageFormat } from '../../../../src/utils';

describe('fetchImageFormat', () => {
  it('확장자가 없는 URL의 응답 바이트를 읽어 실제 래스터 포맷을 반환한다', async () => {
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

  it('확장자가 없는 URL의 SVG 응답을 텍스트 루트로 스니핑한다', async () => {
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

  it('확장자가 있는 URL도 응답 바이트로 실제 포맷을 반환한다', async () => {
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
});
