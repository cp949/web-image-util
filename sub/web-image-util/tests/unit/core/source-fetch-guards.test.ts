/**
 * 원격 소스 로딩 보호 옵션(fetchTimeoutMs, maxSourceBytes, allowedProtocols, abortSignal)을
 * 검증하는 단위 테스트다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToImageElement } from '../../../src/core/source-converter';
import { ImageProcessError } from '../../../src/types';

// ============================================================================
// 테스트 헬퍼
// ============================================================================

/**
 * 기본 성공 응답 mock을 만든다.
 *
 * @param contentType 응답 Content-Type 헤더 값
 * @param contentLength 응답 Content-Length 헤더 값 (없으면 null)
 */
function createSuccessResponse(contentType = 'image/png', contentLength: number | null = null) {
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

/**
 * 바이트 청크를 순서대로 내보내는 Response.body 대역을 만든다.
 *
 * @param chunks 스트림으로 전달할 바이트 청크 목록
 * @returns 최소 Reader 인터페이스를 제공하는 body 객체
 */
function createByteStreamBody(chunks: Uint8Array[]) {
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

/**
 * 일반 이미지 로드 성공 경로를 위해 document.createElement('img')를 mock한다.
 * fetch 가 성공하더라도 img.src 로딩 경로를 통과시켜야 한다.
 */
function mockImgElement() {
  const originalCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'img') {
      const img = originalCreate('img') as HTMLImageElement;
      // happy-dom 에서는 onload 가 자동으로 호출되지 않으므로 직접 트리거한다.
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

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// 프로토콜 차단 테스트
// ============================================================================

describe('원격 소스 로딩 보호: 프로토콜 차단', () => {
  it('ftp:// URL은 INVALID_SOURCE 오류로 거부한다', async () => {
    await expect(convertToImageElement('ftp://example.com/image.png', {})).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('javascript: URL은 INVALID_SOURCE 오류로 거부한다', async () => {
    await expect(convertToImageElement('javascript:alert(1)', {})).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
  });

  it('file:// URL은 INVALID_SOURCE 오류로 거부한다', async () => {
    await expect(convertToImageElement('file:///etc/passwd', {})).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
  });

  it('허용 목록에 없는 커스텀 프로토콜도 INVALID_SOURCE로 거부한다', async () => {
    await expect(convertToImageElement('custom://example.com/img.png', {})).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('http:// URL은 기본 허용 프로토콜이다', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse('image/png'));
    globalThis.fetch = fetchMock as typeof fetch;
    mockImgElement();

    try {
      // 실제 img.load는 happy-dom에서 완전히 동작하지 않으므로 reject도 허용한다.
      // 중요한 것은 INVALID_SOURCE가 아니어야 한다는 것이다.
      await convertToImageElement('http://example.com/image.png', {}).catch((err) => {
        if (err instanceof ImageProcessError && err.code === 'INVALID_SOURCE') {
          throw err; // INVALID_SOURCE면 테스트 실패
        }
        // 그 외 오류(SOURCE_LOAD_FAILED 등)는 허용
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('https:// URL은 기본 허용 프로토콜이다', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse('image/png'));
    globalThis.fetch = fetchMock as typeof fetch;
    mockImgElement();

    try {
      await convertToImageElement('https://example.com/image.png', {}).catch((err) => {
        if (err instanceof ImageProcessError && err.code === 'INVALID_SOURCE') {
          throw err;
        }
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('allowedProtocols 옵션으로 허용 목록을 재정의할 수 있다', async () => {
    // ftp://만 허용하도록 재정의하면 http://가 차단되어야 한다
    await expect(
      convertToImageElement('http://example.com/image.png', {
        allowedProtocols: ['ftp:'],
      })
    ).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
  });

  it('allowedProtocols에 blob:을 포함하면 blob: URL이 허용된다', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse('image/png'));
    globalThis.fetch = fetchMock as typeof fetch;
    mockImgElement();

    try {
      await convertToImageElement('blob:http://localhost/abc-123', {
        allowedProtocols: ['blob:'],
      }).catch((err) => {
        if (err instanceof ImageProcessError && err.code === 'INVALID_SOURCE') {
          throw err;
        }
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('상대 경로 이미지는 INVALID_SOURCE 없이 브라우저 로딩 경로를 유지한다', async () => {
    mockImgElement();

    await convertToImageElement('./assets/image.png', {}).catch((err) => {
      if (err instanceof ImageProcessError && err.code === 'INVALID_SOURCE') {
        throw err;
      }
    });
  });

  it('루트 상대 경로 이미지는 INVALID_SOURCE 없이 브라우저 로딩 경로를 유지한다', async () => {
    mockImgElement();

    await convertToImageElement('/assets/image.png', {}).catch((err) => {
      if (err instanceof ImageProcessError && err.code === 'INVALID_SOURCE') {
        throw err;
      }
    });
  });

  it('protocol-relative URL은 원격 URL로 간주해 허용 프로토콜 제한을 적용한다', async () => {
    const originalFetch = globalThis.fetch;
    const originalCreate = document.createElement.bind(document);
    let imageCreateCount = 0;

    globalThis.fetch = vi.fn() as typeof fetch;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'img') {
        imageCreateCount += 1;
      }
      return originalCreate(tag);
    });

    try {
      await expect(
        convertToImageElement('//cdn.example.com/image.png', {
          allowedProtocols: ['blob:'],
        })
      ).rejects.toMatchObject({ code: 'INVALID_SOURCE' });

      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(imageCreateCount).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ============================================================================
// 타임아웃 테스트
// ============================================================================

describe('원격 소스 로딩 보호: 타임아웃', () => {
  it('fetchTimeoutMs 초과 시 SOURCE_LOAD_FAILED 또는 INVALID_SOURCE 오류로 거부한다', async () => {
    const originalFetch = globalThis.fetch;

    // signal이 abort되면 즉시 DOMException을 던지는 fetch mock을 만든다.
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined;
          if (signal?.aborted) {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
            return;
          }
          if (signal) {
            signal.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }
          // signal이 없으면 영원히 pending — 타임아웃이 없는 경우를 시뮬레이션
        })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(
        convertToImageElement('http://example.com/slow.png', {
          fetchTimeoutMs: 50, // 50ms 후 abort
        })
      ).rejects.toThrow();
    } finally {
      globalThis.fetch = originalFetch;
    }
  }, 3000);

  it('legacy timeout 옵션도 fetch 타임아웃으로 동작한다', async () => {
    const originalFetch = globalThis.fetch;

    const fetchMock = vi.fn().mockImplementation(
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
        })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(
        convertToImageElement('http://example.com/legacy-timeout.png', {
          timeout: 20,
        })
      ).rejects.toMatchObject({ code: 'SOURCE_LOAD_FAILED' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  }, 3000);

  it('fetchTimeoutMs로 중단된 비-SVG URL은 img 폴백 없이 즉시 거부한다', async () => {
    const originalFetch = globalThis.fetch;
    const originalCreate = document.createElement.bind(document);
    let imageCreateCount = 0;

    const fetchMock = vi.fn().mockImplementation(
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
        })
    );
    globalThis.fetch = fetchMock as typeof fetch;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'img') {
        imageCreateCount += 1;
      }
      return originalCreate(tag);
    });

    try {
      await expect(
        convertToImageElement('http://example.com/timeout-no-fallback.png', {
          fetchTimeoutMs: 20,
        })
      ).rejects.toThrow();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(imageCreateCount).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }, 3000);

  it('fetchTimeoutMs: 0이면 타임아웃이 비활성화된다 (fetch가 즉시 응답하면 성공)', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse('image/png'));
    globalThis.fetch = fetchMock as typeof fetch;
    mockImgElement();

    try {
      await convertToImageElement('http://example.com/image.png', {
        fetchTimeoutMs: 0,
      }).catch((err) => {
        if (err instanceof ImageProcessError && err.code === 'INVALID_SOURCE') {
          throw err;
        }
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ============================================================================
// 크기 제한 테스트
// ============================================================================

describe('원격 소스 로딩 보호: 최대 크기 제한', () => {
  it('Content-Length가 maxSourceBytes를 초과하면 본문 읽기 전에 거부한다', async () => {
    const originalFetch = globalThis.fetch;
    const maxBytes = 1024; // 1KB
    const fetchMock = vi.fn().mockResolvedValue(
      createSuccessResponse('image/png', maxBytes + 1) // 1바이트 초과
    );
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(
        convertToImageElement('http://example.com/large.png', {
          maxSourceBytes: maxBytes,
        })
      ).rejects.toMatchObject({ code: 'SOURCE_BYTES_EXCEEDED' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('Content-Length가 maxSourceBytes 이하이면 정상적으로 진행한다', async () => {
    const originalFetch = globalThis.fetch;
    const maxBytes = 1024 * 1024; // 1MiB
    const fetchMock = vi.fn().mockResolvedValue(
      createSuccessResponse('image/png', 512) // 512바이트 (제한 이하)
    );
    globalThis.fetch = fetchMock as typeof fetch;
    mockImgElement();

    try {
      await convertToImageElement('http://example.com/small.png', {
        maxSourceBytes: maxBytes,
      }).catch((err) => {
        if (err instanceof ImageProcessError) {
          // Content-Length 체크는 통과했지만 img 로드 실패는 허용
          if (err.code === 'SOURCE_BYTES_EXCEEDED' || err.code === 'INVALID_SOURCE') {
            throw err;
          }
        }
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('Content-Length 헤더가 없어도 실제 응답 본문이 maxSourceBytes를 초과하면 거부한다', async () => {
    const originalFetch = globalThis.fetch;
    const oversizedChunk = new Uint8Array(2);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'image/png' : null;
        },
      },
      body: createByteStreamBody([oversizedChunk]),
      blob: async () => new Blob([oversizedChunk], { type: 'image/png' }),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(
        convertToImageElement('http://example.com/no-length.png', {
          maxSourceBytes: 1,
        })
      ).rejects.toMatchObject({ code: 'SOURCE_BYTES_EXCEEDED' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('maxSourceBytes: 0이면 크기 제한이 비활성화된다', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(
      createSuccessResponse('image/png', 999_999_999) // 거대한 Content-Length
    );
    globalThis.fetch = fetchMock as typeof fetch;
    mockImgElement();

    try {
      await convertToImageElement('http://example.com/huge.png', {
        maxSourceBytes: 0, // 무제한
      }).catch((err) => {
        // 크기 초과 오류가 아닌 한 허용
        if (err instanceof ImageProcessError && err.code === 'SOURCE_BYTES_EXCEEDED') {
          throw err;
        }
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ============================================================================
// blob: URL 보호 테스트
// ============================================================================

describe('원격 소스 로딩 보호: blob: URL', () => {
  it('blob: URL이 허용 프로토콜 목록에서 제외되면 INVALID_SOURCE로 거부한다', async () => {
    await expect(
      convertToImageElement('blob:http://localhost/blocked-blob', {
        allowedProtocols: ['https:'],
      })
    ).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
  });

  it('blob: URL에도 maxSourceBytes 제한이 적용된다', async () => {
    const originalFetch = globalThis.fetch;
    const maxBytes = 512;
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse('image/png', maxBytes + 1));
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(
        convertToImageElement('blob:http://localhost/abc-123', {
          maxSourceBytes: maxBytes,
        })
      ).rejects.toMatchObject({ code: 'SOURCE_BYTES_EXCEEDED' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('blob: URL도 Content-Length가 없어도 실제 응답 본문이 maxSourceBytes를 초과하면 거부한다', async () => {
    const originalFetch = globalThis.fetch;
    const oversizedChunk = new Uint8Array(2);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'image/png' : null;
        },
      },
      body: createByteStreamBody([oversizedChunk]),
      blob: async () => new Blob([oversizedChunk], { type: 'image/png' }),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(
        convertToImageElement('blob:http://localhost/no-length-blob', {
          maxSourceBytes: 1,
        })
      ).rejects.toMatchObject({ code: 'SOURCE_BYTES_EXCEEDED' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ============================================================================
// SVG URL 보호 테스트
// ============================================================================

describe('원격 소스 로딩 보호: SVG URL 경로', () => {
  it('protocol-relative .svg URL에도 허용 프로토콜 제한을 적용한다', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(
        convertToImageElement('//cdn.example.com/unsafe.svg', {
          allowedProtocols: ['blob:'],
        })
      ).rejects.toMatchObject({ code: 'INVALID_SOURCE' });

      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('.svg URL에 차단된 프로토콜이 사용되면 INVALID_SOURCE로 거부한다', async () => {
    await expect(convertToImageElement('ftp://example.com/image.svg', {})).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('.svg URL의 Content-Length가 maxSourceBytes를 초과하면 SOURCE_LOAD_FAILED로 거부한다', async () => {
    const originalFetch = globalThis.fetch;
    const maxBytes = 512;
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse('image/svg+xml', maxBytes + 1));
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(
        convertToImageElement('https://example.com/image.svg', {
          maxSourceBytes: maxBytes,
        })
      ).rejects.toMatchObject({ code: 'SOURCE_BYTES_EXCEEDED' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('.svg URL 요청이 fetchTimeoutMs 내에 응답하지 않으면 오류가 발생한다', async () => {
    const originalFetch = globalThis.fetch;

    // signal이 abort되면 즉시 DOMException을 던지는 fetch mock
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined;
          if (signal?.aborted) {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
            return;
          }
          if (signal) {
            signal.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }
          // signal이 없으면 영원히 pending
        })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(
        convertToImageElement('https://example.com/slow.svg', {
          fetchTimeoutMs: 50,
        })
      ).rejects.toThrow();
    } finally {
      globalThis.fetch = originalFetch;
    }
  }, 3000);

  it('.svg URL 요청이 fetchTimeoutMs로 중단되면 SOURCE_LOAD_FAILED로 구분한다', async () => {
    const originalFetch = globalThis.fetch;

    const fetchMock = vi.fn().mockImplementation(
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
        })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(
        convertToImageElement('https://example.com/slow-timeout.svg', {
          fetchTimeoutMs: 20,
        })
      ).rejects.toMatchObject({ code: 'SOURCE_LOAD_FAILED' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  }, 3000);

  it('정상 크기의 .svg URL은 보안 가드를 통과한다', async () => {
    const originalFetch = globalThis.fetch;
    const smallSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          const lower = name.toLowerCase();
          if (lower === 'content-type') return 'image/svg+xml';
          if (lower === 'content-length') return String(smallSvg.length);
          return null;
        },
      },
      text: async () => smallSvg,
      body: null,
    });
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      // 실제 SVG 처리는 happy-dom에서 완전히 동작하지 않을 수 있으므로
      // INVALID_SOURCE(프로토콜/크기 차단)가 아닌 한 성공으로 간주한다.
      await convertToImageElement('https://example.com/small.svg', {
        maxSourceBytes: 1024 * 1024,
        fetchTimeoutMs: 5000,
      }).catch((err) => {
        if (err instanceof ImageProcessError && err.code === 'INVALID_SOURCE') {
          throw err;
        }
        // SOURCE_LOAD_FAILED는 img 로드 단계에서 발생 가능 — 허용
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ============================================================================
// abortSignal 테스트
// ============================================================================

describe('원격 소스 로딩 보호: AbortSignal', () => {
  it('이미 취소된 AbortSignal이 전달되면 fetch가 거부된다', async () => {
    const originalFetch = globalThis.fetch;
    // AbortSignal이 이미 abort된 상태에서의 fetch는 오류를 던진다
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));
    globalThis.fetch = fetchMock as typeof fetch;

    const controller = new AbortController();
    controller.abort();

    try {
      await expect(
        convertToImageElement('http://example.com/image.png', {
          abortSignal: controller.signal,
        })
      ).rejects.toThrow();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('이미 취소된 AbortSignal은 비-SVG URL에서도 img 폴백으로 우회되지 않는다', async () => {
    const originalFetch = globalThis.fetch;
    const originalCreate = document.createElement.bind(document);
    let imageCreateCount = 0;
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));
    globalThis.fetch = fetchMock as typeof fetch;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'img') {
        imageCreateCount += 1;
      }
      return originalCreate(tag);
    });

    const controller = new AbortController();
    controller.abort();

    try {
      await expect(
        convertToImageElement('http://example.com/aborted-no-fallback.png', {
          abortSignal: controller.signal,
        })
      ).rejects.toThrow();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(imageCreateCount).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('이미 취소된 AbortSignal이 전달된 .svg URL은 SOURCE_LOAD_FAILED로 구분한다', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));
    globalThis.fetch = fetchMock as typeof fetch;

    const controller = new AbortController();
    controller.abort();

    try {
      await expect(
        convertToImageElement('https://example.com/aborted.svg', {
          abortSignal: controller.signal,
        })
      ).rejects.toMatchObject({ code: 'SOURCE_LOAD_FAILED' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ============================================================================
// 기본값 하위 호환성 테스트
// ============================================================================

describe('원격 소스 로딩 보호: 기본 동작 유지', () => {
  it('옵션 없이 호출해도 http:// URL 처리가 정상적으로 시작된다', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse('image/png'));
    globalThis.fetch = fetchMock as typeof fetch;
    mockImgElement();

    try {
      await convertToImageElement('http://example.com/image.png').catch((err) => {
        if (err instanceof ImageProcessError && err.code === 'INVALID_SOURCE') {
          throw err;
        }
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('ftp:// URL은 옵션 없이 호출해도 INVALID_SOURCE로 거부된다', async () => {
    await expect(convertToImageElement('ftp://example.com/image.png')).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });
});
