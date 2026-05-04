import { vi } from 'vitest';

export function createSuccessResponse(contentType = 'image/png', contentLength: number | null = null) {
  return {
    ok: true,
    headers: {
      get(name: string) {
        const lower = name.toLowerCase();
        if (lower === 'content-type') return contentType;
        if (lower === 'content-length') return contentLength !== null ? String(contentLength) : null;
        return null;
      },
    },
    blob: async () => new Blob([], { type: contentType }),
    text: async () => '',
    body: null,
  };
}

export function createByteStreamBody(chunks: Uint8Array[]) {
  return {
    getReader() {
      let index = 0;
      return {
        async read() {
          if (index >= chunks.length) {
            return { done: true, value: undefined };
          }
          const value = chunks[index];
          index += 1;
          return { done: false, value };
        },
        async cancel() {},
        releaseLock() {},
      };
    },
  };
}

// happy-dom에서는 onload가 자동으로 호출되지 않으므로 직접 트리거한다.
export function mockImgElement() {
  const originalCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'img') {
      const img = originalCreate('img') as HTMLImageElement;
      setTimeout(() => {
        if (img.onload) {
          (img.onload as EventListener)(new Event('load'));
        }
      }, 0);
      return img;
    }
    return originalCreate(tag);
  });
}

// abort signal에 반응하는 fetch mock — 타임아웃/AbortSignal 테스트에서 공통으로 사용
export function createAbortableFetchMock() {
  return vi.fn().mockImplementation(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (signal?.aborted) {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
          return;
        }
        signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
        // signal 없으면 영원히 pending
      })
  );
}

// globalThis.fetch 교체·복원을 try/finally로 보장한다.
export async function withFetchMock(
  mock: ReturnType<typeof vi.fn>,
  fn: () => Promise<void>
): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = mock as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = original;
  }
}
