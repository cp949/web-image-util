/**
 * HTTP/HTTPS URL과 Blob URL에서 HTMLImageElement를 로드하는 경로다.
 *
 * Content-Type 우선 판정 후 필요할 때만 본문을 읽어 SVG 여부를 재확인하며,
 * 모든 fetch 호출은 AbortHandle과 응답 크기 가드를 통해 이루어진다.
 */

import { ImageProcessError } from '../../../types';
import { productionLog } from '../../../utils/debug.internal';
import { decodeImageFromBlob, decodeImageFromUrl } from '../../../utils/image-decode.internal';
import { readBlobAsText } from '../../../utils/source-utils/blob-io.internal';
import { isXmlMimeType, normalizeMimeType } from '../../../utils/source-utils/mime.internal';
import { inspectBlobMetadata, sniffBlobSvgIfCandidate } from '../../../utils/source-utils/source-facts.internal';
import { isInlineSvg } from '../../../utils/svg-detection';
import { hasInternalSvgMetadataHint } from '../detect.internal';
import {
  buildSvgRenderOptions,
  DEFAULT_ALLOWED_PROTOCOLS,
  DEFAULT_MAX_SOURCE_BYTES,
  type InternalSourceConverterOptions,
  resolveFetchTimeoutMs,
} from '../options.internal';
import { convertSvgToElement } from '../svg/loader.internal';
import { readCheckedTextResponse, readVerifiedSvgResponse } from '../svg/safety.internal';
import { createFetchAbortHandle, readCheckedBlobResponse } from './fetch-guards.internal';
import {
  checkAllowedProtocol,
  hasExplicitUrlScheme,
  isAbortLikeError,
  isProtocolRelativeUrl,
  normalizePolicyUrl,
} from './policy.internal';

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

    let blob: Blob;
    try {
      // Blob URL도 fetch 응답을 통해 MIME 타입과 실제 콘텐츠를 함께 확인한다.
      const response = await fetch(blobUrl, handle.signal ? { signal: handle.signal } : undefined);

      const maxBytes = options?.maxSourceBytes !== undefined ? options.maxSourceBytes : DEFAULT_MAX_SOURCE_BYTES;

      if (!response.ok) {
        throw new ImageProcessError(`Failed to load Blob URL: ${response.status}`, 'SOURCE_LOAD_FAILED');
      }

      ({ blob } = await readCheckedBlobResponse(response, maxBytes, 'Blob URL'));
    } finally {
      handle.dispose();
    }

    // 직접 Blob 입력과 같은 내부 판정 술어를 쓴다. fetch 응답 Blob에는 파일명이 없어
    // 파일명 힌트는 항상 'unknown'이지만, 조건을 여기서 다시 조립하면 정책이 갈린다.
    const facts = inspectBlobMetadata(blob);
    const isSvg = hasInternalSvgMetadataHint(facts) || (await sniffBlobSvgIfCandidate(blob, facts));
    if (isSvg) {
      const svgContent = await readBlobAsText(blob);
      return convertSvgToElement(svgContent, undefined, undefined, buildSvgRenderOptions(options));
    }

    // SVG가 아니면 일반 이미지 로딩 경로를 사용한다.
    return decodeImageFromBlob(blob, {
      errorCode: 'SOURCE_LOAD_FAILED',
      message: `Failed to load Blob URL image: ${blobUrl}`,
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
 *
 * @param transport 상위 판정이 정한 전송 형태다. **기본값을 두지 않는다** —
 *   `'remote'`만 fetch 검증(Content-Type 판정·응답 크기 가드)을 거치므로,
 *   기본값이 있으면 새 호출자가 인자를 빠뜨렸을 때 원격 URL이 조용히 검증을 건너뛴다.
 *   필수 매개변수로 두면 그 실수가 컴파일 타임에 드러난다.
 */
export async function loadImageFromUrl(
  url: string,
  crossOrigin: string | undefined,
  options: InternalSourceConverterOptions | undefined,
  transport: 'remote' | 'direct'
): Promise<HTMLImageElement> {
  const loadImageElementDirectly = () =>
    decodeImageFromUrl(url, {
      errorCode: 'SOURCE_LOAD_FAILED',
      message: `Failed to load image: ${url}`,
      crossOrigin,
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
    if (transport === 'remote') {
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

        const contentType = normalizeMimeType(response.headers.get('content-type') ?? '');

        // 1차 판정: Content-Type 기반 SVG 감지
        const isSvgMime = contentType === 'image/svg+xml';

        // 2차 판정: XML 계열 MIME은 본문을 확인해 실제 SVG인지 본다.
        const isXmlMime = isXmlMimeType(contentType);

        if (isSvgMime || isXmlMime) {
          if (isSvgMime) {
            const responseText = await readVerifiedSvgResponse(response, 'remote SVG response');
            return convertSvgToElement(responseText, undefined, undefined, buildSvgRenderOptions(options));
          }

          const { text: responseText } = await readCheckedTextResponse(response, 'remote XML response');
          // XML MIME 응답은 실제 SVG 루트가 확인된 경우에만 SVG로 처리한다.
          const isActualSvg = isXmlMime && isInlineSvg(responseText);
          if (isActualSvg) {
            return convertSvgToElement(responseText, undefined, undefined, buildSvgRenderOptions(options));
          }

          // SVG가 아닌 XML 응답은 이미 본문을 읽었으므로, 같은 Response를 다시 소비하지 말고
          // 브라우저 기본 이미지 로딩 경로로 바로 폴백한다.
          return loadImageElementDirectly();
        }

        const { blob: responseBlob } = await readCheckedBlobResponse(response, maxBytes, 'URL');
        // await를 붙이지 않는다. 원본 코드와 같은 제어 흐름을 유지하기 위해서다.
        //
        // 아래 catch는 ImageProcessError를 먼저 재던지므로 디코드 실패가 폴백으로 새지는 않는다.
        // 그래도 await를 붙이면 두 가지가 달라진다. 첫째, `finally`의 handle.dispose()가 디코드가
        // 끝난 뒤로 밀려 타임아웃 타이머와 abort 리스너가 디코드 구간 내내 살아 있게 된다.
        // 둘째, decodeImageFromBlob이 ImageProcessError가 아닌 오류를 흘리게 되는 날
        // await 버전은 그것을 조용한 직접 로드 폴백으로 삼켜 fail-open이 된다.
        return decodeImageFromBlob(responseBlob, {
          errorCode: 'SOURCE_LOAD_FAILED',
          message: `Failed to load image: ${url}`,
        });
      } catch (fetchError) {
        if (fetchError instanceof ImageProcessError) {
          throw fetchError;
        }
        // 사용자가 취소했거나 타임아웃된 요청은 보안/제어 정책의 일부이므로
        // 브라우저 기본 이미지 로딩으로 우회하지 않는다.
        if (handle.signal?.aborted || isAbortLikeError(fetchError)) {
          throw new ImageProcessError('Remote image load was aborted', 'SOURCE_LOAD_FAILED', {
            cause: fetchError,
            details: { url, kind: 'aborted' },
          });
        }
        // 비-SVG URL은 기존 방식대로 직접 로드로 폴백한다.
        //
        // 여기에 있던 `.svg` 경로 fail-closed 차단은 제거했다. 상위 판정이 `.svg` 힌트를 가진 URL을
        // `'svg-url'`/`'svg-path'`로 분류해 `fetchVerifiedSvgText()` 경로로 보내므로, 이 함수에는
        // 포맷 힌트가 SVG가 아닌 URL만 도달한다. 판정 결과를 원문으로 되짚는 재판정을 없애기 위한 삭제이며,
        // 라우팅 규칙이 바뀌면 이 전제가 깨진다는 점에 주의한다.
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
