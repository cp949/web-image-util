/**
 * 문자열 입력(Inline SVG, Data URL, HTTP URL, 파일 경로 등)을 HTMLImageElement로
 * 변환하는 라우팅 모듈이다.
 *
 * 소스 형태 판정은 `detect.internal`이 단독으로 수행하고, 이 모듈은 그 결과 union만 보고
 * 분기한다. 같은 술어를 다시 묻지 않으며, 분기 누락은 switch의 exhaustive 검사로 드러난다.
 */

import { ImageProcessError } from '../../../types';
import type { StringSourceType } from '../detect.internal';
import {
  buildSvgRenderOptions,
  DEFAULT_ALLOWED_PROTOCOLS,
  DEFAULT_MAX_SOURCE_BYTES,
  type InternalSourceConverterOptions,
  resolveFetchTimeoutMs,
} from '../options.internal';
import { parseSvgFromDataUrl } from '../svg/data-url.internal';
import { convertSvgToElement } from '../svg/loader.internal';
import { readVerifiedSvgResponse } from '../svg/safety.internal';
import { checkResponseSize, createFetchAbortHandle } from '../url/fetch-guards.internal';
import { loadBlobUrl, loadImageFromUrl } from '../url/loader.internal';
import { checkAllowedProtocol, isAbortLikeError, normalizePolicyUrl } from '../url/policy.internal';

/** 원격 SVG fetch 분기별로 달라지는 오류/진단 문구다. */
interface RemoteSvgLabels {
  /** 응답이 ok가 아닐 때 사용할 메시지 접두어 */
  notOk: string;
  /** 응답 크기 초과 진단에 사용할 소스 설명 */
  sizeContext: string;
}

/**
 * 원격 SVG 응답을 크기·본문 검증까지 마친 뒤 문자열로 읽는다.
 *
 * fetch 실패 시 브라우저 기본 이미지 로딩으로 우회하지 않고 차단한다 (fail-closed).
 *
 * @throws {ImageProcessError} 응답이 실패하거나, 중단되었거나, SVG로 검증되지 않으면
 */
async function fetchVerifiedSvgText(
  source: string,
  options: InternalSourceConverterOptions | undefined,
  labels: RemoteSvgLabels
): Promise<string> {
  // fetch 타임아웃과 AbortSignal을 결합한다.
  const timeoutMs = resolveFetchTimeoutMs(options);
  const handle = createFetchAbortHandle(timeoutMs, options?.abortSignal);
  const maxBytes = options?.maxSourceBytes !== undefined ? options.maxSourceBytes : DEFAULT_MAX_SOURCE_BYTES;

  try {
    const response = await fetch(source, handle.signal ? { signal: handle.signal } : undefined);
    if (!response.ok) {
      throw new ImageProcessError(`${labels.notOk}: ${response.status}`, 'SOURCE_LOAD_FAILED');
    }

    // 응답 크기가 최대 허용 바이트를 초과하면 차단한다.
    await checkResponseSize(response, maxBytes, labels.sizeContext);

    return await readVerifiedSvgResponse(response, 'remote SVG response');
  } catch (fetchError) {
    if (handle.signal?.aborted || isAbortLikeError(fetchError)) {
      throw new ImageProcessError('Remote image load was aborted', 'SOURCE_LOAD_FAILED', {
        cause: fetchError,
        details: { url: source, kind: 'aborted' },
      });
    }
    if (fetchError instanceof ImageProcessError) {
      throw fetchError;
    }
    throw new ImageProcessError('SVG URL could not be safely verified; load is blocked', 'INVALID_SOURCE', {
      details: { url: source },
    });
  } finally {
    handle.dispose();
  }
}

/**
 * 절대 URL 형태 소스의 프로토콜 허용 여부를 fetch 전에 확인한다.
 *
 * @throws {ImageProcessError} 허용 목록에 없는 프로토콜이거나 URL 파싱에 실패하면
 */
function checkAbsoluteUrlProtocol(source: string, options: InternalSourceConverterOptions | undefined): void {
  const allowedProtocols = options?.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;
  checkAllowedProtocol(normalizePolicyUrl(source), allowedProtocols);
}

/**
 * 경로 형태 소스의 프로토콜을 확인한다.
 *
 * URL 파싱 자체가 실패하는 상대 경로는 허용하되, 명시적으로 차단된 프로토콜은 거부한다.
 *
 * @throws {ImageProcessError} 허용 목록에 없는 프로토콜이면
 */
function checkResourcePathProtocol(source: string, options: InternalSourceConverterOptions | undefined): void {
  const allowedProtocols = options?.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;
  try {
    checkAllowedProtocol(source, allowedProtocols);
  } catch (protocolError) {
    if (protocolError instanceof ImageProcessError && protocolError.code === 'INVALID_SOURCE') {
      // URL 파싱 실패(상대 경로)는 통과시키고, 프로토콜 차단만 전파한다.
      const isProtocolBlocked = protocolError.message.includes('Protocol not allowed:');
      if (isProtocolBlocked) throw protocolError;
    }
  }
}

/** 문자열 기반 입력을 HTMLImageElement로 변환한다. */
export async function convertStringToElement(
  source: string,
  sourceType: StringSourceType,
  options?: InternalSourceConverterOptions
): Promise<HTMLImageElement> {
  switch (sourceType) {
    case 'svg-datauri': {
      // SVG Data URL은 먼저 문자열로 복원한 뒤 공통 SVG 처리기로 넘긴다.
      const allowedProtocols = options?.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;
      checkAllowedProtocol(source.trim(), allowedProtocols);
      const svgContent = parseSvgFromDataUrl(source);
      return convertSvgToElement(svgContent, undefined, undefined, buildSvgRenderOptions(options));
    }
    case 'svg-inline':
      // 인라인 SVG 문자열은 그대로 공통 처리기로 보낸다.
      return convertSvgToElement(source, undefined, undefined, buildSvgRenderOptions(options));
    case 'svg-url': {
      // 원격 SVG URL은 응답 본문을 검증한 뒤에만 로드한다.
      checkAbsoluteUrlProtocol(source, options);
      const svgContent = await fetchVerifiedSvgText(source, options, {
        notOk: 'Failed to load SVG URL',
        sizeContext: 'remote SVG URL',
      });
      return convertSvgToElement(svgContent, undefined, undefined, buildSvgRenderOptions(options));
    }
    case 'svg-path': {
      // 로컬 경로처럼 보이는 SVG도 fetch 응답을 검증한 뒤 처리한다.
      checkResourcePathProtocol(source, options);
      const svgContent = await fetchVerifiedSvgText(source, options, {
        notOk: 'Failed to load SVG file',
        sizeContext: 'SVG resource path',
      });
      return convertSvgToElement(svgContent, undefined, undefined, buildSvgRenderOptions(options));
    }
    case 'url':
      return loadImageFromUrl(source, options?.crossOrigin, options, 'remote');
    case 'dataurl':
    case 'path':
      return loadImageFromUrl(source, options?.crossOrigin, options, 'direct');
    case 'bloburl':
      return loadBlobUrl(source, options);
    default: {
      // 판정 union에 항목이 추가되면 여기서 컴파일 오류로 드러난다.
      const unhandledType: never = sourceType;
      throw new ImageProcessError(`Cannot convert string source: ${String(unhandledType)}`, 'INVALID_SOURCE');
    }
  }
}
