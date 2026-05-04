/**
 * HTTP/HTTPS URL과 Blob URL에서 HTMLImageElement를 로드하는 경로다.
 *
 * Content-Type 우선 판정 후 필요할 때만 본문을 읽어 SVG 여부를 재확인하며,
 * 모든 fetch 호출은 AbortHandle과 응답 크기 가드를 통해 이루어진다.
 */

import { ImageProcessError } from '../../../types';
import { productionLog } from '../../../utils/debug';
import { isInlineSvg } from '../../../utils/svg-detection';
import {
  DEFAULT_ALLOWED_PROTOCOLS,
  DEFAULT_MAX_SOURCE_BYTES,
  type InternalSourceConverterOptions,
  resolveFetchTimeoutMs,
  resolvePassthroughMode,
  resolveSvgSanitizerMode,
} from '../options';
import { sniffSvgFromBlob } from '../svg/data-url';
import { convertSvgToElement } from '../svg/loader';
import { readCheckedTextResponse, readVerifiedSvgResponse } from '../svg/safety';
import { createFetchAbortHandle, readCheckedBlobResponse } from './fetch-guards';
import {
  checkAllowedProtocol,
  hasExplicitUrlScheme,
  isAbortLikeError,
  isProtocolRelativeUrl,
  isSvgResourcePath,
  normalizePolicyUrl,
} from './policy';

/**
 * Blob URL 응답을 읽어 HTMLImageElement로 변환한다.
 *
 * MIME 타입과 실제 본문을 함께 확인해 SVG를 이중 검증한다.
 */
export async function loadBlobUrl(
  blobUrl: string,
  options?: InternalSourceConverterOptions
): Promise<HTMLImageElement> {
  try {
    // 프로토콜 허용 여부를 먼저 확인한다.
    const allowedProtocols = options?.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;
    checkAllowedProtocol(blobUrl, allowedProtocols);

    // fetch 타임아웃과 AbortSignal을 결합한다.
    const timeoutMs = resolveFetchTimeoutMs(options);
    const handle = createFetchAbortHandle(timeoutMs, options?.abortSignal);

    let contentType: string;
    let blob: Blob;
    try {
      // Blob URL도 fetch 응답을 통해 MIME 타입과 실제 콘텐츠를 함께 확인한다.
      const response = await fetch(blobUrl, handle.signal ? { signal: handle.signal } : undefined);

      const maxBytes = options?.maxSourceBytes !== undefined ? options.maxSourceBytes : DEFAULT_MAX_SOURCE_BYTES;

      if (!response.ok) {
        throw new ImageProcessError(`Failed to load Blob URL: ${response.status}`, 'SOURCE_LOAD_FAILED');
      }

      contentType = response.headers.get('content-type')?.toLowerCase() || '';
      blob = await readCheckedBlobResponse(response, maxBytes, 'Blob URL');
    } finally {
      handle.dispose();
    }

    // 1차 판정: Content-Type 기반 SVG 감지
    const isSvgMime = contentType.includes('image/svg+xml');

    // 2차 판정: MIME이 비었거나 XML 계열일 때 본문 스니핑
    const isEmptyMime = !contentType;
    const isXmlMime = contentType.includes('text/xml') || contentType.includes('application/xml');

    if (isSvgMime || isEmptyMime || isXmlMime) {
      const isSvgContent = await sniffSvgFromBlob(blob);

      // MIME 또는 본문 스니핑 중 하나라도 SVG로 확인되면 SVG 경로로 처리한다.
      if (isSvgMime || isSvgContent) {
        const svgContent = await blob.text();
        return convertSvgToElement(svgContent, undefined, undefined, {
          quality: 'auto',
          passthroughMode: resolvePassthroughMode(options),
          sanitizerMode: resolveSvgSanitizerMode(options),
        });
      }
    }

    // SVG가 아니면 일반 이미지 로딩 경로를 사용한다.
    return new Promise((resolve, reject) => {
      const img = document.createElement('img');
      const objectUrl = URL.createObjectURL(blob);
      // Promise 결정 시 핸들러를 해제하고 Blob URL을 정리한다.
      const cleanup = () => {
        img.onload = null;
        img.onerror = null;
        URL.revokeObjectURL(objectUrl);
      };
      img.onload = () => {
        cleanup();
        resolve(img);
      };
      img.onerror = () => {
        cleanup();
        reject(new ImageProcessError(`Failed to load Blob URL image: ${blobUrl}`, 'SOURCE_LOAD_FAILED'));
      };
      img.src = objectUrl;
    });
  } catch (error) {
    if (error instanceof ImageProcessError) {
      throw error;
    }
    throw new ImageProcessError('Error occurred while processing Blob URL', 'SOURCE_LOAD_FAILED', { cause: error });
  }
}

/**
 * URL 응답을 읽어 HTMLImageElement로 변환한다.
 *
 * 원격 응답은 Content-Type 우선 판정 후, 필요할 때만 본문을 읽어 SVG 여부를 재확인한다.
 */
export async function loadImageFromUrl(
  url: string,
  crossOrigin?: string,
  options?: InternalSourceConverterOptions
): Promise<HTMLImageElement> {
  const loadImageElementDirectly = () =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = document.createElement('img');

      if (crossOrigin) {
        img.crossOrigin = crossOrigin;
      }

      // Promise 결정 시 핸들러를 해제한다.
      const cleanup = () => {
        img.onload = null;
        img.onerror = null;
      };
      img.onload = () => {
        cleanup();
        resolve(img);
      };
      img.onerror = () => {
        cleanup();
        reject(new ImageProcessError(`Failed to load image: ${url}`, 'SOURCE_LOAD_FAILED'));
      };

      img.src = url;
    });

  try {
    // 명시적 URL 스킴이 있는 경우에만 프로토콜 허용 여부를 검사한다.
    // 상대 경로는 기존 브라우저 자산 로딩 경로를 유지한다.
    if (hasExplicitUrlScheme(url) || isProtocolRelativeUrl(url)) {
      const allowedProtocols = options?.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;
      checkAllowedProtocol(normalizePolicyUrl(url), allowedProtocols);
    }

    const maxBytes = options?.maxSourceBytes !== undefined ? options.maxSourceBytes : DEFAULT_MAX_SOURCE_BYTES;

    // HTTP/HTTPS URL은 우선 fetch로 MIME 타입과 본문을 확인한다.
    if (url.startsWith('http://') || url.startsWith('https://') || isProtocolRelativeUrl(url)) {
      // fetch 타임아웃과 AbortSignal을 fetch 분기 안에서 생성한다.
      const timeoutMs = resolveFetchTimeoutMs(options);
      const handle = createFetchAbortHandle(timeoutMs, options?.abortSignal);
      try {
        // 한 번의 GET 요청으로 Content-Type 확인과 실제 로딩을 함께 처리한다.
        const response = await fetch(url, {
          method: 'GET',
          mode: crossOrigin ? 'cors' : 'same-origin',
          ...(handle.signal ? { signal: handle.signal } : {}),
        });

        if (!response.ok) {
          throw new ImageProcessError(`Failed to load URL: ${response.status}`, 'SOURCE_LOAD_FAILED');
        }

        const contentType = response.headers.get('content-type')?.toLowerCase() || '';

        // 1차 판정: Content-Type 기반 SVG 감지
        const isSvgMime = contentType.includes('image/svg+xml');

        // 2차 판정: XML 계열 MIME은 본문을 확인해 실제 SVG인지 본다.
        const isXmlMime = contentType.includes('text/xml') || contentType.includes('application/xml');

        if (isSvgMime || isXmlMime) {
          if (isSvgMime) {
            const responseText = await readVerifiedSvgResponse(response, '원격 SVG 응답');
            return convertSvgToElement(responseText, undefined, undefined, {
              quality: 'auto',
              crossOrigin: options?.crossOrigin,
              passthroughMode: resolvePassthroughMode(options),
              sanitizerMode: resolveSvgSanitizerMode(options),
            });
          }

          const responseText = await readCheckedTextResponse(response, '원격 XML 응답');
          // XML MIME 응답은 실제 SVG 루트가 확인된 경우에만 SVG로 처리한다.
          const isActualSvg = isXmlMime && isInlineSvg(responseText);
          if (isActualSvg) {
            return convertSvgToElement(responseText, undefined, undefined, {
              quality: 'auto',
              crossOrigin: options?.crossOrigin,
              passthroughMode: resolvePassthroughMode(options),
              sanitizerMode: resolveSvgSanitizerMode(options),
            });
          }

          // SVG가 아닌 XML 응답은 이미 본문을 읽었으므로, 같은 Response를 다시 소비하지 말고
          // 브라우저 기본 이미지 로딩 경로로 바로 폴백한다.
          return loadImageElementDirectly();
        }

        const responseBlob = await readCheckedBlobResponse(response, maxBytes, 'URL');
        return new Promise((resolve, reject) => {
          const img = document.createElement('img');
          const objectUrl = URL.createObjectURL(responseBlob);

          // Promise 결정 시 핸들러를 해제하고 Blob URL을 정리한다.
          const cleanup = () => {
            img.onload = null;
            img.onerror = null;
            URL.revokeObjectURL(objectUrl);
          };
          img.onload = () => {
            cleanup();
            resolve(img);
          };
          img.onerror = () => {
            cleanup();
            reject(new ImageProcessError(`Failed to load image: ${url}`, 'SOURCE_LOAD_FAILED'));
          };

          img.src = objectUrl;
        });
      } catch (fetchError) {
        if (fetchError instanceof ImageProcessError) {
          throw fetchError;
        }
        // 사용자가 취소했거나 타임아웃된 요청은 보안/제어 정책의 일부이므로
        // 브라우저 기본 이미지 로딩으로 우회하지 않는다.
        if (handle.signal?.aborted || isAbortLikeError(fetchError)) {
          throw new ImageProcessError('원격 이미지 로딩이 중단되었습니다', 'SOURCE_LOAD_FAILED', { cause: fetchError });
        }
        // .svg URL은 fetch 실패 시 직접 로드로 넘기지 않고 차단한다 (fail-closed)
        if (isSvgResourcePath(url)) {
          throw new ImageProcessError('SVG URL을 안전하게 확인할 수 없어 로드를 차단합니다', 'INVALID_SOURCE');
        }
        // 비-SVG URL은 기존 방식대로 직접 로드로 폴백한다
        productionLog.warn('Failed to check Content-Type, fallback to default image loading:', fetchError);
      } finally {
        handle.dispose();
      }
    }

    // 최종 폴백은 브라우저 기본 이미지 로딩이다.
    return loadImageElementDirectly();
  } catch (error) {
    // ImageProcessError는 이미 적절한 메시지를 가지므로 그대로 다시 던진다
    if (error instanceof ImageProcessError) {
      throw error;
    }
    throw new ImageProcessError('Error occurred while loading URL image', 'SOURCE_LOAD_FAILED', { cause: error });
  }
}
