/**
 * 원격 URL fetch 기반 이미지 메타데이터 수집.
 *
 * SSRF 가드(허용 protocol 검증), 본문 크기 상한, abort/timeout은 공유 가드 module
 * (core/source-converter/url)이 소유한다. 두 공개 함수는 모두 그 가드를 소비하며,
 * 이 모듈이 직접 소유하는 것은 포맷 판정 규칙과 스니핑 예산뿐이다.
 *
 * 보안 모델은 [SVG-SECURITY.md]의 외부 입력 처리 원칙을 따른다.
 */

import { DEFAULT_ALLOWED_PROTOCOLS, DEFAULT_FETCH_TIMEOUT_MS } from '../../core/source-converter/options.internal';
import {
  createFetchAbortHandle,
  readCheckedBlobResponse,
  readTruncatedResponsePrefix,
} from '../../core/source-converter/url/fetch-guards.internal';
import {
  checkAllowedProtocol,
  hasExplicitUrlScheme,
  isProtocolRelativeUrl,
  normalizePolicyUrl,
} from '../../core/source-converter/url/policy.internal';
import { ImageFormats, ImageProcessError } from '../../types';
import { classifyStringSource } from '../source-utils/source-facts.internal';
import { isInlineSvg } from '../svg-detection';
import { formatFromBytes, formatFromMimeType } from './format-detection.internal';
import type {
  FetchImageFormatOptions,
  FetchImageSourceBlobOptions,
  FetchImageSourceBlobResult,
  ImageInfo,
} from './types';

const DEFAULT_FORMAT_SNIFF_BYTES = 4096;

/**
 * 포맷 스니핑이 읽을 수 있는 최대 바이트 수 (64KiB).
 *
 * 바이너리 시그니처 판정에는 앞 12바이트면 충분하다. SVG 루트가 긴 전치부 뒤에 있으면
 * 스니핑하지 못할 수 있지만, 원격 본문을 제한 없이 읽지 않도록 이 예산을 우선한다.
 */
const MAX_SNIFF_BYTES = 64 * 1024;

const DEFAULT_FETCH_SOURCE_PROTOCOLS = ['http:', 'https:'];

/** 브라우저가 현재 문서를 기준으로 해석하는 자산 경로인지 판정한다. */
function isBrowserAssetPath(source: string): boolean {
  return source.startsWith('/') || source.startsWith('./') || source.startsWith('../');
}

/** 문자열 소스가 fetch로 조회 가능한 형태인지 판정한다. */
function canFetchStringSource(source: string): boolean {
  const { transport } = classifyStringSource(source);

  switch (transport) {
    case 'http':
    case 'protocol-relative':
    case 'blob-url':
      return true;
    case 'path':
      // facts는 'image-id'와 '/assets/image'를 모두 path로 준다. 둘을 가르는
      // 경로 형태 판정은 이 모듈의 정책이므로 facts 모듈로 올리지 않는다.
      return isBrowserAssetPath(source.trim());
    case 'inline':
    case 'data-url':
      return false;
  }
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

function sanitizeFetchSourceOptions(
  fetchOptions: FetchImageSourceBlobOptions['fetchOptions'] | undefined
): Omit<RequestInit, 'body' | 'method' | 'signal'> {
  if (!fetchOptions) return {};

  const { body: _body, method: _method, signal: _signal, ...safeOptions } = fetchOptions as RequestInit;
  return safeOptions;
}

/** 본문 읽기 실패를 이미지 소스 도메인 오류로 감싼다. */
function wrapFetchSourceBodyReadError(error: unknown): never {
  throw new ImageProcessError('Failed to read image URL response body', 'SOURCE_LOAD_FAILED', {
    cause: error,
    details: { kind: 'response-body' },
  });
}

/**
 * URL 또는 브라우저 경로 응답을 fetch해 실제 이미지 포맷을 판정한다.
 *
 * @description 확장자 힌트는 사용하지 않고 응답의 Content-Type과 앞부분 바이트/SVG 텍스트 루트를 확인한다.
 * fetch 대상이 아니거나 응답을 읽을 수 없거나 포맷을 알 수 없으면 `unknown`을 반환한다.
 *
 * - 명시적 스킴이나 protocol-relative 입력만 protocol 허용 여부를 검사한다. 상대 경로는
 *   브라우저 자산 로딩 경로를 유지한다.
 * - 기본 타임아웃은 30초다. `timeoutMs: 0`으로 끄거나 `abortSignal`로 직접 중단할 수 있다.
 * - `sniffBytes`는 64KiB를 넘겨 지정해도 64KiB까지만 읽는다.
 * - 정책 위반, 네트워크 실패, 중단을 포함한 모든 실패는 예외 대신 `unknown`으로 수렴한다.
 */
export async function fetchImageFormat(
  source: string,
  options: FetchImageFormatOptions = {}
): Promise<ImageInfo['format']> {
  if (!canFetchStringSource(source)) {
    return 'unknown';
  }

  const url = source.trim();
  const byteLimit = Math.min(options.sniffBytes ?? DEFAULT_FORMAT_SNIFF_BYTES, MAX_SNIFF_BYTES);
  let handle: ReturnType<typeof createFetchAbortHandle> | undefined;

  try {
    // AbortSignal 생성 자체가 실패해도 공개 계약에 따라 unknown으로 수렴시킨다.
    handle = createFetchAbortHandle(options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS, options.abortSignal);

    // 명시적 스킴이 있는 입력만 protocol을 검사한다 — url/loader.internal과 같은 규칙이다.
    if (hasExplicitUrlScheme(url) || isProtocolRelativeUrl(url)) {
      checkAllowedProtocol(normalizePolicyUrl(url), DEFAULT_ALLOWED_PROTOCOLS);
    }

    const response = await fetch(url, {
      ...sanitizeFetchSourceOptions(options.fetchOptions),
      method: 'GET',
      ...(handle.signal ? { signal: handle.signal } : {}),
    });

    if (!response.ok) {
      return 'unknown';
    }

    const contentType = response.headers.get('content-type') ?? '';
    const prefix = await readTruncatedResponsePrefix(response, byteLimit);

    return formatFromResponsePrefix(prefix, contentType);
  } catch {
    return 'unknown';
  } finally {
    handle?.dispose();
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

  checkAllowedProtocol(url, allowedProtocols);

  const handle = createFetchAbortHandle(options.timeoutMs ?? 0, options.abortSignal);

  try {
    const response = await fetch(url, {
      ...sanitizeFetchSourceOptions(options.fetchOptions),
      method: 'GET',
      ...(handle.signal ? { signal: handle.signal } : {}),
    });

    if (!response.ok) {
      throw new ImageProcessError(`Failed to load URL: ${response.status}`, 'SOURCE_LOAD_FAILED');
    }

    const contentType = response.headers.get('content-type') ?? '';
    const { blob, bytes } = await readCheckedBlobResponse(response, maxBytes, 'image URL', {
      wrapReadError: wrapFetchSourceBodyReadError,
    });

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
    handle.dispose();
  }
}
