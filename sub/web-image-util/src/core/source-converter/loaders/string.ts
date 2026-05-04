/**
 * 문자열 입력(Inline SVG, Data URL, HTTP URL, 파일 경로 등)을 HTMLImageElement로
 * 변환하는 라우팅 모듈이다.
 *
 * detect 결과에 따라 SVG 처리기 또는 URL 로더로 분기한다.
 */

import { ImageProcessError } from '../../../types';
import { isInlineSvg } from '../../../utils/svg-detection';
import { detectSourceType } from '../detect';
import {
  DEFAULT_ALLOWED_PROTOCOLS,
  DEFAULT_MAX_SOURCE_BYTES,
  type InternalSourceConverterOptions,
  resolveFetchTimeoutMs,
  resolvePassthroughMode,
  resolveSvgSanitizerMode,
} from '../options';
import { isDataUrlSvg, parseSvgFromDataUrl } from '../svg/data-url';
import { convertSvgToElement } from '../svg/loader';
import { readVerifiedSvgResponse } from '../svg/safety';
import { checkResponseSize, createFetchAbortHandle } from '../url/fetch-guards';
import { loadBlobUrl, loadImageFromUrl } from '../url/loader';
import {
  checkAllowedProtocol,
  isAbortLikeError,
  isProtocolRelativeUrl,
  isSvgResourcePath,
  normalizePolicyUrl,
} from '../url/policy';

/** 문자열 기반 입력을 HTMLImageElement로 변환한다. */
export async function convertStringToElement(
  source: string,
  options?: InternalSourceConverterOptions
): Promise<HTMLImageElement> {
  const sourceType = detectSourceType(source);

  switch (sourceType) {
    case 'svg':
      // 인라인 SVG, SVG Data URL, SVG URL을 각각 안전한 경로로 처리한다.
      // SVG Data URL은 먼저 문자열로 복원한 뒤 공통 SVG 처리기로 넘긴다.
      if (isDataUrlSvg(source.trim())) {
        const allowedProtocols = options?.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;
        checkAllowedProtocol(source.trim(), allowedProtocols);
        const svgContent = parseSvgFromDataUrl(source);
        return convertSvgToElement(svgContent, undefined, undefined, {
          quality: 'auto',
          crossOrigin: options?.crossOrigin,
          passthroughMode: resolvePassthroughMode(options),
          sanitizerMode: resolveSvgSanitizerMode(options),
        });
      }
      // 인라인 SVG 문자열은 경로 판정보다 먼저 공통 처리기로 보낸다.
      if (isInlineSvg(source)) {
        return convertSvgToElement(source, undefined, undefined, {
          quality: 'auto',
          crossOrigin: options?.crossOrigin,
          passthroughMode: resolvePassthroughMode(options),
          sanitizerMode: resolveSvgSanitizerMode(options),
        });
      }
      // 원격 SVG URL은 응답 본문을 검증한 뒤에만 로드한다.
      if (
        source.trim().startsWith('http://') ||
        source.trim().startsWith('https://') ||
        isProtocolRelativeUrl(source)
      ) {
        // 프로토콜 허용 여부를 fetch 전에 확인한다.
        const allowedProtocols = options?.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;
        checkAllowedProtocol(normalizePolicyUrl(source), allowedProtocols);

        // fetch 타임아웃과 AbortSignal을 결합한다.
        const timeoutMs = resolveFetchTimeoutMs(options);
        const handle = createFetchAbortHandle(timeoutMs, options?.abortSignal);
        const maxBytes = options?.maxSourceBytes !== undefined ? options.maxSourceBytes : DEFAULT_MAX_SOURCE_BYTES;

        let svgContent: string;
        try {
          // 원격 SVG fetch 실패 시 직접 로드로 넘기지 않고 차단한다 (fail-closed)
          const response = await fetch(source, handle.signal ? { signal: handle.signal } : undefined);
          if (!response.ok) {
            throw new ImageProcessError(`Failed to load SVG URL: ${response.status}`, 'SOURCE_LOAD_FAILED');
          }

          // 응답 크기가 최대 허용 바이트를 초과하면 차단한다.
          checkResponseSize(response, maxBytes, '원격 SVG URL');

          svgContent = await readVerifiedSvgResponse(response, '원격 SVG 응답');
        } catch (fetchError) {
          if (handle.signal?.aborted || isAbortLikeError(fetchError)) {
            throw new ImageProcessError('원격 SVG 로딩이 중단되었습니다', 'SOURCE_LOAD_FAILED', fetchError as Error);
          }
          if (fetchError instanceof ImageProcessError) {
            throw fetchError;
          }
          throw new ImageProcessError('SVG URL을 안전하게 확인할 수 없어 로드를 차단합니다', 'INVALID_SOURCE');
        } finally {
          handle.dispose();
        }

        return convertSvgToElement(svgContent, undefined, undefined, {
          quality: 'auto',
          crossOrigin: options?.crossOrigin,
          passthroughMode: resolvePassthroughMode(options),
          sanitizerMode: resolveSvgSanitizerMode(options),
        });
      }
      // 로컬 경로처럼 보이는 SVG도 fetch 응답을 검증한 뒤 처리한다.
      if (isSvgResourcePath(source.trim())) {
        // 프로토콜 허용 여부를 fetch 전에 확인한다 (URL 형식인 경우만).
        const allowedProtocols = options?.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;
        try {
          checkAllowedProtocol(source, allowedProtocols);
        } catch (protocolError) {
          // URL 파싱 자체가 실패하는 상대 경로는 허용하되, 명시적으로 차단된 프로토콜은 거부한다.
          if (protocolError instanceof ImageProcessError && protocolError.code === 'INVALID_SOURCE') {
            // URL 파싱 실패(상대 경로)는 통과시키고, 프로토콜 차단만 전파한다.
            const isProtocolBlocked = protocolError.message.includes('허용되지 않는 프로토콜');
            if (isProtocolBlocked) throw protocolError;
          }
        }

        // fetch 타임아웃과 AbortSignal을 결합한다.
        const timeoutMs = resolveFetchTimeoutMs(options);
        const handle = createFetchAbortHandle(timeoutMs, options?.abortSignal);
        const maxBytes = options?.maxSourceBytes !== undefined ? options.maxSourceBytes : DEFAULT_MAX_SOURCE_BYTES;

        let svgContent: string;
        try {
          // 로컬 SVG 경로 fetch 실패 시 안전하게 차단한다
          const response = await fetch(source, handle.signal ? { signal: handle.signal } : undefined);
          if (!response.ok) {
            throw new ImageProcessError(`Failed to load SVG file: ${response.status}`, 'SOURCE_LOAD_FAILED');
          }

          // 응답 크기가 최대 허용 바이트를 초과하면 차단한다.
          checkResponseSize(response, maxBytes, 'SVG 리소스 경로');

          svgContent = await readVerifiedSvgResponse(response, '원격 SVG 응답');
        } catch (fetchError) {
          if (handle.signal?.aborted || isAbortLikeError(fetchError)) {
            throw new ImageProcessError('원격 SVG 로딩이 중단되었습니다', 'SOURCE_LOAD_FAILED', fetchError as Error);
          }
          if (fetchError instanceof ImageProcessError) {
            throw fetchError;
          }
          throw new ImageProcessError('SVG URL을 안전하게 확인할 수 없어 로드를 차단합니다', 'INVALID_SOURCE');
        } finally {
          handle.dispose();
        }

        return convertSvgToElement(svgContent, undefined, undefined, {
          quality: 'auto',
          crossOrigin: options?.crossOrigin,
          passthroughMode: resolvePassthroughMode(options),
          sanitizerMode: resolveSvgSanitizerMode(options),
        });
      }
      // 일반 문자열 SVG는 즉시 공통 처리기로 보낸다.
      return convertSvgToElement(source, undefined, undefined, {
        quality: 'auto',
        crossOrigin: options?.crossOrigin,
        passthroughMode: resolvePassthroughMode(options),
        sanitizerMode: resolveSvgSanitizerMode(options),
      });
    case 'dataurl':
    case 'url':
    case 'path':
      return loadImageFromUrl(source, options?.crossOrigin, options);
    case 'bloburl':
      return loadBlobUrl(source, options);
    default:
      throw new ImageProcessError(`Cannot convert string source: ${sourceType}`, 'INVALID_SOURCE');
  }
}
