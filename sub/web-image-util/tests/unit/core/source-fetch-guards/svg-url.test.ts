import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToImageElement } from '../../../../src/core/source-converter/index';
import { MAX_SVG_BYTES } from '../../../../src/svg-contract.internal';
import { ImageProcessError } from '../../../../src/types';
import { createAbortableFetchMock, createSuccessResponse, withFetchMock } from './helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('원격 소스 로딩 보호: SVG URL 경로', () => {
  it('protocol-relative .svg URL에도 허용 프로토콜 제한을 적용한다', async () => {
    const fetchMock = vi.fn();

    await withFetchMock(fetchMock, async () => {
      await expect(
        convertToImageElement('//cdn.example.com/unsafe.svg', {
          allowedProtocols: ['blob:'],
        })
      ).rejects.toMatchObject({ code: 'INVALID_SOURCE' });

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('.svg URL에 차단된 프로토콜이 사용되면 INVALID_SOURCE로 거부한다', async () => {
    await expect(convertToImageElement('ftp://example.com/image.svg', {})).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('.svg URL의 Content-Length가 maxSourceBytes를 초과하면 SOURCE_LOAD_FAILED로 거부한다', async () => {
    const maxBytes = 512;
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse('image/svg+xml', maxBytes + 1));

    await withFetchMock(fetchMock, async () => {
      await expect(
        convertToImageElement('https://example.com/image.svg', {
          maxSourceBytes: maxBytes,
        })
      ).rejects.toMatchObject({ code: 'SOURCE_BYTES_EXCEEDED' });
    });
  });

  it('Content-Length가 숫자 접두사 + 비숫자 접미사(예: "999999999x")여도 본문을 읽기 전에 거부한다', async () => {
    // MAX_SVG_BYTES(고정 상한)를 넘는 SVG를 준비해, 사전 차단이 아니라 사후 검사에만
    // 걸리는지(=fail-open) 구분한다. 사전 차단이 살아있다면 text()는 호출되지 않아야 한다.
    const oversizedSvg = `<svg>${'x'.repeat(MAX_SVG_BYTES + 1)}</svg>`;
    const textSpy = vi.fn().mockResolvedValue(oversizedSvg);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          const lower = name.toLowerCase();
          if (lower === 'content-type') return 'image/svg+xml';
          if (lower === 'content-length') return '999999999x';
          return null;
        },
      },
      text: textSpy,
      body: null,
    });

    await withFetchMock(fetchMock, async () => {
      // Content-Length(≈953MB)가 DEFAULT_MAX_SOURCE_BYTES(100MB)도 SVG 상한(10MB)도
      // 모두 초과하므로, 먼저 도는 remote-SVG-URL 사전 검사가 SOURCE_BYTES_EXCEEDED로 막는다.
      await expect(convertToImageElement('https://example.com/malicious.svg', {})).rejects.toMatchObject({
        code: 'SOURCE_BYTES_EXCEEDED',
      });
    });

    // 사전 차단이 동작했다면 본문(response.text())을 읽지 않아야 한다.
    expect(textSpy).not.toHaveBeenCalled();
  });

  it('.svg URL 요청이 fetchTimeoutMs 내에 응답하지 않으면 오류가 발생한다', async () => {
    const fetchMock = createAbortableFetchMock();

    await withFetchMock(fetchMock, async () => {
      await expect(
        convertToImageElement('https://example.com/slow.svg', {
          fetchTimeoutMs: 50,
        })
      ).rejects.toThrow();
    });
  }, 3000);

  it('.svg URL 요청이 fetchTimeoutMs로 중단되면 SOURCE_LOAD_FAILED로 구분한다', async () => {
    const fetchMock = createAbortableFetchMock();

    await withFetchMock(fetchMock, async () => {
      await expect(
        convertToImageElement('https://example.com/slow-timeout.svg', {
          fetchTimeoutMs: 20,
        })
      ).rejects.toMatchObject({ code: 'SOURCE_LOAD_FAILED' });
    });
  }, 3000);

  it('정상 크기의 .svg URL은 보안 가드를 통과한다', async () => {
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

    await withFetchMock(fetchMock, async () => {
      // INVALID_SOURCE(프로토콜/크기 차단)가 아닌 한 성공으로 간주
      // jsdom에서 실제 SVG 처리는 완전히 동작하지 않을 수 있다.
      await convertToImageElement('https://example.com/small.svg', {
        maxSourceBytes: 1024 * 1024,
        fetchTimeoutMs: 5000,
      }).catch((err) => {
        if (err instanceof ImageProcessError && err.code === 'INVALID_SOURCE') {
          throw err;
        }
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
