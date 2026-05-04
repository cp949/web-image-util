/**
 * 원격 URL fetch 기반 이미지 메타데이터 수집.
 *
 * SSRF 가드(허용 protocol 검증), 본문 크기 상한, abort/timeout 등 외부 입력에 적용해야 할
 * 안전 조치를 모두 이 모듈에 모아 둔다. 응답 본문에서 포맷을 결정하는 로직(`fetchImageFormat`)도
 * 응답 prefix 처리와 강하게 결합되어 있어 함께 둔다.
 *
 * 보안 모델은 [SVG-SECURITY.md]의 외부 입력 처리 원칙을 따른다.
 */

import { ImageFormats, ImageProcessError } from '../../types';
import { isInlineSvg } from '../svg-detection';
import { formatFromBytes, formatFromMimeType } from './format-detection';
import type {
  FetchImageFormatOptions,
  FetchImageSourceBlobOptions,
  FetchImageSourceBlobResult,
  ImageInfo,
} from './types';

const DEFAULT_FORMAT_SNIFF_BYTES = 4096;
const DEFAULT_FETCH_SOURCE_PROTOCOLS = ['http:', 'https:'];

/** 문자열 소스가 fetch로 조회 가능한 형태인지 판정한다. */
function canFetchStringSource(source: string): boolean {
  const trimmed = source.trim();
  const lower = trimmed.toLowerCase();

  if (trimmed.length === 0 || lower.startsWith('data:') || isInlineSvg(trimmed)) {
    return false;
  }

  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('blob:') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../')
  );
}

/** Response 본문 앞부분만 읽어 포맷 스니핑에 필요한 바이트를 반환한다. */
async function readResponsePrefix(response: Response, bytes: number): Promise<Uint8Array> {
  const byteLimit = Math.max(0, bytes);
  if (byteLimit === 0) {
    return new Uint8Array();
  }

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer, 0, Math.min(buffer.byteLength, byteLimit));
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let shouldCancelReader = false;

  try {
    while (totalBytes < byteLimit) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const remainingBytes = byteLimit - totalBytes;
      const chunk = value.byteLength > remainingBytes ? value.slice(0, remainingBytes) : value;
      chunks.push(chunk);
      totalBytes += chunk.byteLength;

      if (value.byteLength > remainingBytes) {
        shouldCancelReader = true;
        break;
      }
    }

    if (totalBytes >= byteLimit) {
      shouldCancelReader = true;
    }

    if (shouldCancelReader) {
      try {
        await reader.cancel();
      } catch {
        // 스트림 정리 실패는 이미 읽은 prefix 기반 포맷 판정을 무효화하지 않는다.
      }
    }
  } finally {
    reader.releaseLock();
  }

  const prefix = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    prefix.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return prefix;
}

/** 응답 MIME과 본문 앞부분을 조합해 실제 이미지 포맷을 판정한다. */
function formatFromResponsePrefix(bytes: Uint8Array, contentType: string): ImageInfo['format'] {
  const byteFormat = formatFromBytes(bytes);
  if (byteFormat !== 'unknown') {
    return byteFormat;
  }

  const text = new TextDecoder().decode(bytes);
  if (isInlineSvg(text)) {
    return ImageFormats.SVG;
  }

  return formatFromMimeType(contentType);
}

function assertFetchSourceProtocol(source: string, allowedProtocols: string[]): void {
  let url: URL;

  try {
    url = new URL(source);
  } catch (error) {
    throw new ImageProcessError(`Invalid URL: ${source}`, 'INVALID_SOURCE', { cause: error, details: { source } });
  }

  if (!allowedProtocols.includes(url.protocol)) {
    throw new ImageProcessError(`Protocol not allowed: ${url.protocol}`, 'INVALID_SOURCE', { details: { source } });
  }
}

function createFetchSourceAbortController(
  timeoutMs: number | undefined,
  abortSignal: AbortSignal | undefined
): { signal?: AbortSignal; cleanup: () => void } {
  if ((timeoutMs === undefined || timeoutMs === 0) && !abortSignal) {
    return { cleanup: () => {} };
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let isCleanedUp = false;

  const abort = () => controller.abort();
  const cleanup = () => {
    if (isCleanedUp) {
      return;
    }

    isCleanedUp = true;

    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }

    abortSignal?.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', cleanup);
  };

  if (abortSignal) {
    if (abortSignal.aborted) {
      controller.abort();
    } else {
      abortSignal.addEventListener('abort', abort, { once: true });
    }
  }

  if (timeoutMs !== undefined && timeoutMs > 0) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  controller.signal.addEventListener('abort', cleanup, { once: true });

  return { signal: controller.signal, cleanup };
}

function sanitizeFetchSourceOptions(
  fetchOptions: FetchImageSourceBlobOptions['fetchOptions'] | undefined
): Omit<RequestInit, 'body' | 'method' | 'signal'> {
  if (!fetchOptions) return {};

  const { body: _body, method: _method, signal: _signal, ...safeOptions } = fetchOptions as RequestInit;
  return safeOptions;
}

function throwSourceBytesExceeded(actualBytes: number, maxBytes: number, label: string): never {
  throw new ImageProcessError(
    `${label} response size (${actualBytes} bytes) exceeds the maximum allowed (${maxBytes} bytes)`,
    'SOURCE_BYTES_EXCEEDED',
    { details: { actualBytes, maxBytes, label } }
  );
}

function wrapFetchSourceBodyReadError(error: unknown): never {
  if (error instanceof ImageProcessError && error.code === 'SOURCE_BYTES_EXCEEDED') {
    throw error;
  }

  throw new ImageProcessError('Failed to read image URL response body', 'SOURCE_LOAD_FAILED', {
    cause: error,
    details: { kind: 'response-body' },
  });
}

async function checkFetchSourceContentLength(response: Response, maxBytes: number, label: string): Promise<void> {
  if (maxBytes === 0) return;

  const contentLengthHeader = response.headers.get('content-length');
  if (!contentLengthHeader) return;

  const contentLength = Number(contentLengthHeader);
  if (!Number.isFinite(contentLength)) return;

  if (contentLength > maxBytes) {
    if (response.body) {
      try {
        await response.body.cancel();
      } catch {
        // 크기 초과 오류가 공개 error code로 안정적으로 전달되도록 cancel 실패는 삼킨다.
      }
    }

    throwSourceBytesExceeded(contentLength, maxBytes, label);
  }
}

async function readFetchSourceBlob(
  response: Response,
  maxBytes: number,
  label: string
): Promise<{ blob: Blob; bytes: number }> {
  await checkFetchSourceContentLength(response, maxBytes, label);

  if (!response.body) {
    let blob: Blob;

    try {
      blob = await response.blob();
    } catch (error) {
      wrapFetchSourceBodyReadError(error);
    }

    if (maxBytes > 0 && blob.size > maxBytes) {
      throwSourceBytesExceeded(blob.size, maxBytes, label);
    }

    return { blob, bytes: blob.size };
  }

  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;

      if (maxBytes > 0 && totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // 크기 초과 오류가 public contract이므로 스트림 정리 실패가 이를 가리지 않게 한다.
        }

        throwSourceBytesExceeded(totalBytes, maxBytes, label);
      }

      chunks.push(new Uint8Array(value));
    }
  } catch (error) {
    wrapFetchSourceBodyReadError(error);
  } finally {
    reader.releaseLock();
  }

  const contentType = response.headers.get('content-type') ?? '';
  return {
    blob: new Blob(chunks, { type: contentType }),
    bytes: totalBytes,
  };
}

/**
 * URL 또는 브라우저 경로 응답을 fetch해 실제 이미지 포맷을 판정한다.
 *
 * @description 확장자 힌트는 사용하지 않고 응답의 Content-Type과 앞부분 바이트/SVG 텍스트 루트를 확인한다.
 * fetch 대상이 아니거나 응답을 읽을 수 없거나 포맷을 알 수 없으면 `unknown`을 반환한다.
 */
export async function fetchImageFormat(
  source: string,
  options: FetchImageFormatOptions = {}
): Promise<ImageInfo['format']> {
  if (!canFetchStringSource(source)) {
    return 'unknown';
  }

  try {
    const response = await fetch(source.trim(), {
      ...options.fetchOptions,
      method: 'GET',
    });

    if (!response.ok) {
      return 'unknown';
    }

    const contentType = response.headers.get('content-type') ?? '';
    const prefix = await readResponsePrefix(response, options.sniffBytes ?? DEFAULT_FORMAT_SNIFF_BYTES);

    return formatFromResponsePrefix(prefix, contentType);
  } catch {
    return 'unknown';
  }
}

/**
 * URL을 fetch만 수행해 이미지 Blob과 응답 메타데이터를 반환한다.
 *
 * - 기본 허용 protocol은 `http:`, `https:`이며 `allowedProtocols`로 좁히거나 확장할 수 있다.
 * - method는 항상 `GET`으로 강제된다. `fetchOptions`로 `credentials`, `mode`, `headers`, `referrerPolicy`, `cache` 등을 전달할 수 있고
 *   `body`/`method`/`signal`은 무시된다.
 * - `abortSignal`과 `timeoutMs`를 결합해 중단할 수 있다. 중단 시 image element fallback은 없다.
 * - `Content-Length`가 `maxBytes`를 초과하면 본문을 읽기 전에 `SOURCE_BYTES_EXCEEDED`로 거부한다.
 * - stream 누적 byte가 `maxBytes`를 초과하면 reader를 cancel하고 `SOURCE_BYTES_EXCEEDED`를 throw한다.
 * - 네트워크 실패와 HTTP 에러는 `SOURCE_LOAD_FAILED`, 잘못된 URL/허용되지 않은 protocol은 `INVALID_SOURCE`로 throw한다.
 *
 * @param source fetch할 이미지 URL
 * @param options 동작 옵션
 * @returns 응답 Blob과 메타데이터
 */
export async function fetchImageSourceBlob(
  source: string,
  options: FetchImageSourceBlobOptions = {}
): Promise<FetchImageSourceBlobResult> {
  const url = source.trim();
  const allowedProtocols = options.allowedProtocols ?? DEFAULT_FETCH_SOURCE_PROTOCOLS;
  const maxBytes = options.maxBytes ?? 100 * 1024 * 1024;

  assertFetchSourceProtocol(url, allowedProtocols);

  const { signal, cleanup } = createFetchSourceAbortController(options.timeoutMs, options.abortSignal);

  try {
    const response = await fetch(url, {
      ...sanitizeFetchSourceOptions(options.fetchOptions),
      method: 'GET',
      ...(signal ? { signal } : {}),
    });

    if (!response.ok) {
      throw new ImageProcessError(`Failed to load URL: ${response.status}`, 'SOURCE_LOAD_FAILED');
    }

    const contentType = response.headers.get('content-type') ?? '';
    const { blob, bytes } = await readFetchSourceBlob(response, maxBytes, 'image URL');

    return {
      blob,
      bytes,
      contentType,
      url,
      responseUrl: response.url || url,
      status: response.status,
    };
  } catch (error) {
    if (error instanceof ImageProcessError) {
      throw error;
    }

    throw new ImageProcessError('Failed to fetch image URL', 'SOURCE_LOAD_FAILED', {
      cause: error,
      details: { url, kind: 'fetch' },
    });
  } finally {
    cleanup();
  }
}
