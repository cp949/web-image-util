/**
 * `fetchImageFormat`에 연결된 원격 본문 가드의 행동 테스트.
 * protocol 검사, 타임아웃/중단, 옵션 정리, 절단 읽기 예산을 공개 인터페이스에서 확인한다.
 */

import { describe, expect, it, vi } from 'vitest';
import { fetchImageFormat } from '../../../../src';
import { createAbortableFetchMock, createSuccessResponse, withFetchMock } from '../../../utils/fetch-helper';

/**
 * 고정 크기 청크의 읽기량과 취소 여부를 기록한다.
 * 절단 읽기가 상한에 도달한 시점에 스트림을 끊는지 확인할 때 사용한다.
 */
function createCountingStreamResponse(chunkSize: number, chunkCount: number) {
  const state = { readBytes: 0, cancelled: false };

  const response = {
    ok: true,
    headers: {
      get(name: string) {
        return name.toLowerCase() === 'content-type' ? 'application/octet-stream' : null;
      },
    },
    body: {
      getReader() {
        let index = 0;
        return {
          async read() {
            if (index >= chunkCount) {
              return { done: true, value: undefined };
            }
            index += 1;
            state.readBytes += chunkSize;
            return { done: false, value: new Uint8Array(chunkSize) };
          },
          async cancel() {
            state.cancelled = true;
          },
          releaseLock() {},
        };
      },
    },
  };

  return { response, state };
}

describe('fetchImageFormat 원격 본문 가드', () => {
  it('prefix를 충분히 읽은 뒤 스트림 cancel이 실패해도 판정 결과를 반환한다', async () => {
    const cancelMock = vi.fn().mockRejectedValue(new Error('cancel failed'));
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(pngBytes);
      },
      cancel: cancelMock,
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(stream));

    await withFetchMock(fetchMock, async () => {
      await expect(fetchImageFormat('https://example.com/image', { sniffBytes: 8 })).resolves.toBe('png');
      expect(cancelMock).toHaveBeenCalledTimes(1);
    });
  });

  it('잘못된 형식의 URL은 요청을 만들지 않고 unknown을 반환한다', async () => {
    const fetchMock = vi.fn();

    await withFetchMock(fetchMock, async () => {
      await expect(fetchImageFormat('http://')).resolves.toBe('unknown');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('타임아웃이 만료되면 unknown을 반환한다', async () => {
    const fetchMock = createAbortableFetchMock();

    await withFetchMock(fetchMock, async () => {
      await expect(fetchImageFormat('https://example.com/image', { timeoutMs: 5 })).resolves.toBe('unknown');
    });
  });

  it('유효하지 않은 timeoutMs가 AbortSignal 생성을 실패시켜도 unknown을 반환한다', async () => {
    const fetchMock = vi.fn();

    await withFetchMock(fetchMock, async () => {
      await expect(fetchImageFormat('https://example.com/image', { timeoutMs: 0.5 })).resolves.toBe('unknown');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('옵션을 주지 않아도 기본 타임아웃 signal을 fetch에 전달한다', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(pngBytes));

    await withFetchMock(fetchMock, async () => {
      await expect(fetchImageFormat('https://example.com/image')).resolves.toBe('png');
      expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    });
  });

  it('전달한 abortSignal로 중단하면 unknown을 반환한다', async () => {
    const controller = new AbortController();
    const fetchMock = createAbortableFetchMock();

    await withFetchMock(fetchMock, async () => {
      const pending = fetchImageFormat('https://example.com/image', {
        timeoutMs: 0,
        abortSignal: controller.signal,
      });
      controller.abort();

      await expect(pending).resolves.toBe('unknown');
    });
  });

  it('fetchOptions.signal은 무시하고 abortSignal 경로만 사용한다', async () => {
    const userController = new AbortController();
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(pngBytes));

    await withFetchMock(fetchMock, async () => {
      await expect(
        fetchImageFormat('https://example.com/image', {
          timeoutMs: 0,
          fetchOptions: { signal: userController.signal } as RequestInit,
        })
      ).resolves.toBe('png');
      expect(fetchMock.mock.calls[0][1].signal).toBeUndefined();
    });
  });

  it('sniffBytes를 상한보다 크게 지정해도 64KiB까지만 읽고 스트림을 끊는다', async () => {
    const chunkSize = 16 * 1024;
    const { response, state } = createCountingStreamResponse(chunkSize, 16);
    const fetchMock = vi.fn().mockResolvedValue(response);

    await withFetchMock(fetchMock, async () => {
      await expect(fetchImageFormat('https://example.com/image', { sniffBytes: 1_000_000_000 })).resolves.toBe(
        'unknown'
      );
    });

    expect(state.readBytes).toBe(64 * 1024);
    expect(state.cancelled).toBe(true);
  });

  it('본문 스트림이 없는 응답은 본문을 읽지 않는다', async () => {
    const arrayBufferMock = vi.fn();
    const response = { ...createSuccessResponse('application/octet-stream'), arrayBuffer: arrayBufferMock };
    const fetchMock = vi.fn().mockResolvedValue(response);

    await withFetchMock(fetchMock, async () => {
      await expect(fetchImageFormat('https://example.com/image')).resolves.toBe('unknown');
      expect(arrayBufferMock).not.toHaveBeenCalled();
    });
  });
});
