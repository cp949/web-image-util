/**
 * 다양한 입력 소스를 HTMLImageElement로 정규화하는 변환기다.
 */

import type { ImageSource, ProcessorOptions } from '../types';
import { ImageProcessError } from '../types';
import { debugLog, productionLog } from '../utils/debug';
import { enhanceSvgForBrowser } from '../utils/svg-compatibility';
import { extractSvgDimensions } from '../utils/svg-dimensions';
import { sanitizeSvg } from '../utils/svg-sanitizer';
import type { QualityLevel } from './svg-complexity-analyzer';
import { analyzeSvgComplexity } from './svg-complexity-analyzer';

/**
 * SVG 입력 최대 허용 바이트 수 (10MiB).
 * 실제 SVG 파일은 대부분 수백KB 이하이며,
 * 이 상한선은 정상 사용을 막지 않으면서 비정상적인 메모리 소모를 초기에 차단한다.
 */
const MAX_SVG_BYTES = 10 * 1024 * 1024;

/**
 * 기본 fetch 타임아웃 (30초).
 */
const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

/**
 * 기본 최대 소스 바이트 수 (100MiB).
 */
const DEFAULT_MAX_SOURCE_BYTES = 100 * 1024 * 1024;

/**
 * 기본 허용 프로토콜 목록.
 */
const DEFAULT_ALLOWED_PROTOCOLS = ['http:', 'https:', 'blob:', 'data:'];

/**
 * 원격 소스 로딩에 사용할 fetch 타임아웃 값을 계산한다.
 *
 * `fetchTimeoutMs`가 최우선이며, 하위 호환을 위해 `timeout`도 동일 의미로 받아들인다.
 *
 * @param options 프로세서 옵션
 * @returns 실제 적용할 타임아웃 값
 */
function resolveFetchTimeoutMs(options?: ProcessorOptions): number {
  if (options?.fetchTimeoutMs !== undefined) {
    return options.fetchTimeoutMs;
  }

  if (options?.timeout !== undefined) {
    return options.timeout;
  }

  return DEFAULT_FETCH_TIMEOUT_MS;
}

/**
 * 입력 문자열이 명시적 스킴을 가진 절대 URL인지 판정한다.
 *
 * 상대 경로(`./image.png`, `/assets/logo.png`)는 false를 반환해
 * 브라우저의 동일 출처 자산 로딩 경로를 유지한다.
 *
 * @param input 검사할 문자열
 * @returns 명시적 URL 스킴이 있으면 true
 */
function hasExplicitUrlScheme(input: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(input.trim());
}

/**
 * 입력 문자열이 protocol-relative URL(`//cdn.example.com/image.png`)인지 판정한다.
 *
 * @param input 검사할 문자열
 * @returns protocol-relative URL이면 true
 */
function isProtocolRelativeUrl(input: string): boolean {
  return input.trim().startsWith('//');
}

/**
 * fetch 실패가 사용자 취소 또는 타임아웃에 의한 중단인지 판정한다.
 *
 * @param error fetch에서 발생한 예외
 * @returns 중단 계열 오류면 true
 */
function isAbortLikeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const errorName = 'name' in error && typeof error.name === 'string' ? error.name : '';
  return errorName === 'AbortError' || errorName === 'TimeoutError';
}

/**
 * 정책 검사용 URL 문자열을 절대 URL로 정규화한다.
 *
 * protocol-relative URL은 현재 문서 위치를 기준으로 절대 URL로 바꾼다.
 *
 * @param input 원본 URL 문자열
 * @returns 정책 검사에 사용할 절대 URL 문자열
 */
function normalizePolicyUrl(input: string): string {
  if (!isProtocolRelativeUrl(input)) {
    return input;
  }

  const fallbackBase = 'http://localhost';
  const baseHref =
    typeof globalThis.location?.href === 'string' && globalThis.location.href.length > 0
      ? globalThis.location.href
      : fallbackBase;

  return new URL(input, baseHref).toString();
}

/**
 * URL 프로토콜이 허용 목록에 있는지 확인하고, 없으면 INVALID_SOURCE 오류를 던진다.
 *
 * @param url 검사할 URL 문자열
 * @param allowedProtocols 허용할 프로토콜 목록 (예: ['http:', 'https:', 'blob:'])
 */
function checkAllowedProtocol(url: string, allowedProtocols: string[]): void {
  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    // URL 파싱에 실패하면 잘못된 소스로 간주한다
    throw new ImageProcessError(`유효하지 않은 URL 형식입니다: ${url}`, 'INVALID_SOURCE');
  }

  if (!allowedProtocols.includes(protocol)) {
    throw new ImageProcessError(
      `허용되지 않는 프로토콜입니다: ${protocol}. 허용 목록: ${allowedProtocols.join(', ')}`,
      'INVALID_SOURCE'
    );
  }
}

/**
 * 타임아웃과 사용자 제공 AbortSignal을 결합한 AbortSignal을 반환한다.
 *
 * @param timeoutMs 타임아웃 밀리초. 0이면 타임아웃을 설정하지 않는다.
 * @param userSignal 사용자가 전달한 외부 AbortSignal (선택)
 * @returns 결합된 AbortSignal 또는 undefined
 */
function createFetchAbortSignal(timeoutMs: number, userSignal?: AbortSignal): AbortSignal | undefined {
  const signals: AbortSignal[] = [];

  if (timeoutMs > 0) {
    // AbortSignal.timeout이 지원되면 사용하고, 그렇지 않으면 직접 구현한다
    if (typeof AbortSignal.timeout === 'function') {
      signals.push(AbortSignal.timeout(timeoutMs));
    } else {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException('fetch timed out', 'TimeoutError')), timeoutMs);
      signals.push(controller.signal);
    }
  }

  if (userSignal) {
    signals.push(userSignal);
  }

  if (signals.length === 0) return undefined;
  if (signals.length === 1) return signals[0];

  // 여러 신호를 결합한다 — AbortSignal.any가 지원되면 사용한다
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(signals);
  }

  // 폴백: 수동으로 결합한다
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

/**
 * 응답 Content-Length 헤더가 최대 허용 크기를 초과하면 SOURCE_LOAD_FAILED 오류를 던진다.
 * Content-Length 헤더가 없으면 검사를 건너뛴다.
 *
 * @param response fetch 응답 객체
 * @param maxBytes 최대 허용 바이트 수. 0이면 무제한.
 * @param label 오류 메시지에 사용할 레이블
 */
function checkResponseSize(response: Response, maxBytes: number, label: string): void {
  if (maxBytes === 0) return;

  const contentLengthHeader = response.headers.get('content-length');
  if (!contentLengthHeader) return;

  const contentLength = Number(contentLengthHeader);
  if (!Number.isFinite(contentLength)) return;

  if (contentLength > maxBytes) {
    throw new ImageProcessError(
      `${label} 응답 크기(${contentLength} bytes)가 최대 허용 크기(${maxBytes} bytes)를 초과합니다`,
      'SOURCE_LOAD_FAILED'
    );
  }
}

/**
 * 원격 바이너리 응답 본문을 읽으면서 실제 바이트 수가 한도를 넘지 않는지 검증한다.
 *
 * @param response fetch 응답 객체
 * @param maxBytes 최대 허용 바이트 수. 0이면 무제한.
 * @param label 오류 메시지에 사용할 레이블
 * @returns 크기 검증을 통과한 Blob
 */
async function readCheckedBlobResponse(response: Response, maxBytes: number, label: string): Promise<Blob> {
  checkResponseSize(response, maxBytes, label);

  if (!response.body) {
    const blob = await response.blob();
    if (maxBytes > 0 && blob.size > maxBytes) {
      throw new ImageProcessError(
        `${label} 응답 크기(${blob.size} bytes)가 최대 허용 크기(${maxBytes} bytes)를 초과합니다`,
        'SOURCE_LOAD_FAILED'
      );
    }

    return blob;
  }

  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (maxBytes > 0 && totalBytes > maxBytes) {
        await reader.cancel();
        throw new ImageProcessError(
          `${label} 응답 크기(${totalBytes} bytes)가 최대 허용 크기(${maxBytes} bytes)를 초과합니다`,
          'SOURCE_LOAD_FAILED'
        );
      }

      chunks.push(new Uint8Array(value));
    }

    const contentType = response.headers.get('content-type') ?? '';
    return new Blob(chunks, { type: contentType });
  } finally {
    reader.releaseLock();
  }
}

/**
 * Base64 문자열의 디코딩 후 예상 크기를 계산한다.
 *
 * @param base64Content 패딩을 포함할 수 있는 Base64 본문
 * @returns 디코딩 후 예상 바이트 수
 */
function estimateBase64DecodedSize(base64Content: string): number {
  const normalized = base64Content.replace(/\s+/g, '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

/**
 * 문자열의 UTF-8 인코딩 바이트 수를 계산한다.
 *
 * @param value 크기를 계산할 문자열
 * @returns UTF-8 기준 바이트 수
 */
function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/**
 * URL 또는 경로 문자열이 SVG 리소스를 가리키는지 판정한다.
 *
 * @param input 검사할 URL 또는 경로 문자열
 * @returns SVG 확장자를 가리키면 true
 */
function isSvgResourcePath(input: string): boolean {
  try {
    const parsedUrl = new URL(input);
    return parsedUrl.pathname.toLowerCase().endsWith('.svg');
  } catch {
    const pathWithoutQueryOrHash = input.split('#', 1)[0]?.split('?', 1)[0] ?? input;
    return pathWithoutQueryOrHash.toLowerCase().endsWith('.svg');
  }
}

/**
 * 보안 정책 비교 전에 참조 문자열을 정규화한다.
 *
 * @param ref 검사할 참조 문자열
 * @returns 공백 제거 및 소문자 정규화된 문자열
 */
function normalizePolicyRef(ref: string): string {
  const decoded = ref
    .replace(/&#(?:x([0-9a-f]+)|([0-9]+));?/gi, (_match, hex: string | undefined, decimal: string | undefined) => {
      const codePoint = hex ? Number.parseInt(hex, 16) : Number.parseInt(decimal ?? '', 10);
      if (!Number.isFinite(codePoint)) {
        return '';
      }

      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return '';
      }
    })
    .replace(/&(quot|amp|apos|lt|gt|tab|newline|colon);/gi, (_match, entity: string) => {
      switch (entity.toLowerCase()) {
        case 'quot':
          return '"';
        case 'amp':
          return '&';
        case 'apos':
          return "'";
        case 'lt':
          return '<';
        case 'gt':
          return '>';
        case 'tab':
          return '\t';
        case 'newline':
          return '\n';
        case 'colon':
          return ':';
        default:
          return '';
      }
    });

  return decoded.replace(/[\u0000-\u0020\u007f-\u009f\s]+/g, '').trim().toLowerCase();
}

/**
 * SVG 보안 정책에서 차단해야 하는 참조인지 판정한다.
 *
 * @param ref 정규화 전 또는 후의 참조 문자열
 * @returns 외부 또는 실행 가능한 URI면 true
 */
function isBlockedSvgPolicyRef(ref: string): boolean {
  const normalizedRef = normalizePolicyRef(ref);
  return (
    normalizedRef.startsWith('//') ||
    normalizedRef.startsWith('http://') ||
    normalizedRef.startsWith('https://') ||
    normalizedRef.startsWith('./') ||
    normalizedRef.startsWith('../') ||
    normalizedRef.startsWith('/') ||
    normalizedRef.startsWith('javascript:') ||
    normalizedRef.startsWith('data:')
  );
}

/**
 * 따옴표 안의 `>` 문자를 태그 종료로 오인하지 않도록 SVG 시작 태그를 순회하는 패턴이다.
 */
const SVG_START_TAG_PATTERN = /<([a-z][a-z0-9:-]*)(\b(?:[^"'<>]|"[^"]*"|'[^']*')*)(\/?)>/gi;

/**
 * 지원하는 이미지 입력 소스 타입이다.
 */
export type SourceType =
  | 'element'
  | 'canvas'
  | 'blob'
  | 'arrayBuffer'
  | 'uint8Array'
  | 'svg'
  | 'dataurl'
  | 'url'
  | 'bloburl'
  | 'path';

/**
 * 문자열 앞의 UTF-8 BOM을 제거한다.
 * @param s 입력 문자열
 * @returns BOM이 제거된 문자열
 */
function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, '');
}

/**
 * SVG 앞부분의 XML 프롤로그와 잡음을 제거한다.
 *
 * @description XML 선언, 주석, DOCTYPE, 공백을 걷어내 실제 SVG 루트 태그 판별에 집중할 수 있게 한다.
 * @param head 분석할 문자열의 앞부분
 * @returns 실제 SVG 내용부터 시작하는 문자열
 */
function stripXmlPreambleAndNoise(head: string): string {
  let s = head.trimStart();

  // XML 선언을 먼저 제거한다.
  if (s.startsWith('<?xml')) {
    const end = s.indexOf('?>');
    if (end >= 0) s = s.slice(end + 2).trimStart();
  }

  // 연속된 주석이 있을 수 있어 반복해서 제거한다.
  while (true) {
    const m = s.match(/^<!--[\s\S]*?-->\s*/);
    if (!m) break;
    s = s.slice(m[0].length);
  }

  // DOCTYPE 선언을 제거한다.
  const doctype = s.match(/^<!DOCTYPE[^>]*>\s*/i);
  if (doctype) s = s.slice(doctype[0].length);

  return s.trimStart();
}

/**
 * XML 전처리를 거친 뒤 문자열이 인라인 SVG인지 정확하게 판정한다.
 *
 * 단순한 `includes('<svg')` 검사는 HTML 조각이나 임베디드 문자열에 오탐을 만들 수 있어,
 * BOM, XML 선언, 주석, DOCTYPE을 제거한 뒤 실제 루트가 `<svg`인지 확인한다.
 *
 * @param str SVG 여부를 확인할 문자열
 * @returns 유효한 인라인 SVG면 true
 */
function isInlineSvg(str: string): boolean {
  if (!str) return false;
  const stripped = stripXmlPreambleAndNoise(stripBom(str));
  return /^<svg[\s>]/i.test(stripped);
}

/**
 * 문자열이 SVG Data URL 형식인지 판정한다.
 *
 * @param input 검사할 문자열
 * @returns SVG Data URL이면 true
 */
function isDataUrlSvg(input: string): boolean {
  return /^data:image\/svg\+xml(?:[;,]|$)/i.test(input);
}

/**
 * Blob 앞부분만 읽어 실제 SVG 콘텐츠인지 판정한다.
 *
 * MIME 타입이 비어 있거나 신뢰하기 어려운 업로드에서도 `<svg` 루트를 빠르게 확인하기 위한 헬퍼다.
 * 읽기 실패는 모두 안전하게 false로 처리한다.
 *
 * @param blob 검사할 Blob 객체
 * @param bytes 앞에서부터 읽을 최대 바이트 수
 * @returns SVG 콘텐츠로 판정되면 true
 */
async function sniffSvgFromBlob(blob: Blob, bytes = 4096): Promise<boolean> {
  try {
    const slice = await blob.slice(0, bytes).text();
    return isInlineSvg(slice);
  } catch {
    return false;
  }
}

/**
 * 입력값의 실제 형태를 판별해 적절한 변환 경로로 라우팅한다.
 *
 * 문자열 입력은 Data URL, 인라인 SVG, HTTP URL, Blob URL, 파일 경로 순으로 확인하고,
 * 객체 입력은 `instanceof`와 덕 타이핑을 함께 사용해 브라우저 호환성을 확보한다.
 *
 * @param source 분석할 이미지 입력
 * @returns 후속 처리 파이프라인에 사용할 소스 타입
 * @throws {ImageProcessError} 지원하지 않는 입력이면
 */
export function detectSourceType(source: ImageSource): SourceType {
  if (source instanceof HTMLImageElement) {
    return 'element';
  }

  // Detect HTMLCanvasElement
  if (
    source instanceof HTMLCanvasElement ||
    (source &&
      typeof source === 'object' &&
      'getContext' in source &&
      'toDataURL' in source &&
      typeof (source as any).getContext === 'function')
  ) {
    return 'canvas';
  }

  // Detect Blob - use both instanceof and duck typing
  if (
    source instanceof Blob ||
    (source &&
      typeof source === 'object' &&
      'type' in source &&
      'size' in source &&
      ('slice' in source || 'arrayBuffer' in source))
  ) {
    // Detect SVG file
    if (source.type === 'image/svg+xml' || (source as File).name?.endsWith('.svg')) {
      return 'svg';
    }
    return 'blob';
  }

  if (source instanceof ArrayBuffer) {
    return 'arrayBuffer';
  }

  if (source instanceof Uint8Array) {
    return 'uint8Array';
  }

  if (typeof source === 'string') {
    const trimmed = source.trim();

    // Detect Data URL SVG (priority - check before general Data URL)
    if (isDataUrlSvg(trimmed)) {
      return 'svg';
    }

    // Detect inline SVG XML (accurate check)
    if (isInlineSvg(trimmed)) {
      return 'svg';
    }

    // Detect other Data URLs
    if (trimmed.startsWith('data:')) {
      return 'dataurl';
    }

    // Detect HTTP/HTTPS URLs
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      // 실제 MIME 판정은 로딩 시점에 수행하고, 여기서는 확장자만 힌트로 사용한다.
      if (isSvgResourcePath(trimmed)) {
        return 'svg';
      }
      return 'url';
    }

    // Detect protocol-relative URLs
    if (isProtocolRelativeUrl(trimmed)) {
      if (isSvgResourcePath(trimmed)) {
        return 'svg';
      }
      return 'url';
    }

    // Detect Blob URL (URL created by createObjectURL)
    if (trimmed.startsWith('blob:')) {
      return 'bloburl';
    }

    // File path - check SVG extension
    if (isSvgResourcePath(trimmed)) {
      return 'svg';
    }

    // Treat the rest as file paths
    return 'path';
  }

  throw new ImageProcessError(`Unsupported source type: ${typeof source}`, 'INVALID_SOURCE');
}

/**
 * SVG Data URL에서 실제 SVG 문자열을 추출하고 검증한다.
 *
 * @param dataUrl SVG Data URL 문자열
 * @returns 파싱과 검증을 통과한 SVG 문자열
 */
function parseSvgFromDataUrl(dataUrl: string): string {
  // Format: data:image/svg+xml;base64,<base64-data>
  // Format: data:image/svg+xml;charset=utf-8,<url-encoded-data>
  // Format: data:image/svg+xml,<svg-content>

  const [header, content] = dataUrl.split(',');
  if (!content) {
    throw new ImageProcessError('Invalid SVG Data URL format', 'INVALID_SOURCE');
  }

  let svgContent: string;

  // Base64 인코딩은 디코딩 예상 크기부터 확인해 과도한 메모리 사용을 막는다.
  if (header.includes('base64')) {
    if (estimateBase64DecodedSize(content) > MAX_SVG_BYTES) {
      throw createSvgSizeLimitError('Data URL SVG');
    }
    try {
      svgContent = atob(content);
    } catch (error) {
      throw new ImageProcessError('Failed to decode Base64 SVG', 'SOURCE_LOAD_FAILED', error as Error);
    }
  } else {
    // URL 인코딩 Data URL은 원문 길이가 아닌 디코딩 결과 기준으로 제한을 적용한다.
    try {
      svgContent = decodeURIComponent(content);
    } catch (error) {
      // URL 디코딩 실패 시에도 원문으로 한 번 더 SVG 형식을 검증한다.
      svgContent = content;
    }
  }

  // 디코딩된 SVG 크기가 허용 한도를 초과하는지 검사한다
  checkSvgSizeLimit(svgContent, 'Data URL SVG');

  // 디코딩 결과가 실제 SVG 루트인지 다시 확인한다.
  if (!isInlineSvg(svgContent)) {
    throw new ImageProcessError('Data URL content is not valid SVG', 'INVALID_SOURCE');
  }

  return svgContent;
}

/** 문자열 기반 입력을 HTMLImageElement로 변환한다. */
async function convertStringToElement(source: string, options?: ProcessorOptions): Promise<HTMLImageElement> {
  const sourceType = detectSourceType(source);

  switch (sourceType) {
    case 'svg':
      // 인라인 SVG, SVG Data URL, SVG URL을 각각 안전한 경로로 처리한다.
      if (typeof source === 'string') {
        // SVG Data URL은 먼저 문자열로 복원한 뒤 공통 SVG 처리기로 넘긴다.
        if (isDataUrlSvg(source.trim())) {
          const allowedProtocols = options?.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;
          checkAllowedProtocol(source.trim(), allowedProtocols);
          const svgContent = parseSvgFromDataUrl(source);
          return convertSvgToElement(svgContent, undefined, undefined, {
            quality: 'auto',
            crossOrigin: options?.crossOrigin,
          });
        }
        // 인라인 SVG 문자열은 경로 판정보다 먼저 공통 처리기로 보낸다.
        else if (isInlineSvg(source)) {
          return convertSvgToElement(source, undefined, undefined, {
            quality: 'auto',
            crossOrigin: options?.crossOrigin,
          });
        }
        // 원격 SVG URL은 응답 본문을 검증한 뒤에만 로드한다.
        else if (
          source.trim().startsWith('http://') ||
          source.trim().startsWith('https://') ||
          isProtocolRelativeUrl(source)
        ) {
          // 프로토콜 허용 여부를 fetch 전에 확인한다.
          const allowedProtocols = options?.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;
          checkAllowedProtocol(normalizePolicyUrl(source), allowedProtocols);

          // fetch 타임아웃과 AbortSignal을 결합한다.
          const timeoutMs = resolveFetchTimeoutMs(options);
          const signal = createFetchAbortSignal(timeoutMs, options?.abortSignal);
          const maxBytes = options?.maxSourceBytes !== undefined ? options.maxSourceBytes : DEFAULT_MAX_SOURCE_BYTES;

          // 원격 SVG fetch 실패 시 직접 로드로 넘기지 않고 차단한다 (fail-closed)
          let response: Response;
          try {
            response = await fetch(source, signal ? { signal } : undefined);
          } catch (fetchError) {
            if (signal?.aborted || isAbortLikeError(fetchError)) {
              throw new ImageProcessError('원격 SVG 로딩이 중단되었습니다', 'SOURCE_LOAD_FAILED', fetchError as Error);
            }
            throw new ImageProcessError('SVG URL을 안전하게 확인할 수 없어 로드를 차단합니다', 'INVALID_SOURCE');
          }
          if (!response.ok) {
            throw new ImageProcessError(`Failed to load SVG URL: ${response.status}`, 'SOURCE_LOAD_FAILED');
          }

          // 응답 크기가 최대 허용 바이트를 초과하면 차단한다.
          checkResponseSize(response, maxBytes, '원격 SVG URL');

          const svgContent = await readVerifiedSvgResponse(response, '원격 SVG 응답');
          return convertSvgToElement(svgContent, undefined, undefined, {
            quality: 'auto',
            crossOrigin: options?.crossOrigin,
          });
        }
        // 로컬 경로처럼 보이는 SVG도 fetch 응답을 검증한 뒤 처리한다.
        else if (isSvgResourcePath(source.trim())) {
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
          const signal = createFetchAbortSignal(timeoutMs, options?.abortSignal);
          const maxBytes = options?.maxSourceBytes !== undefined ? options.maxSourceBytes : DEFAULT_MAX_SOURCE_BYTES;

          // 로컬 SVG 경로 fetch 실패 시 안전하게 차단한다
          let response: Response;
          try {
            response = await fetch(source, signal ? { signal } : undefined);
          } catch (fetchError) {
            if (signal?.aborted || isAbortLikeError(fetchError)) {
              throw new ImageProcessError('원격 SVG 로딩이 중단되었습니다', 'SOURCE_LOAD_FAILED', fetchError as Error);
            }
            throw new ImageProcessError('SVG URL을 안전하게 확인할 수 없어 로드를 차단합니다', 'INVALID_SOURCE');
          }
          if (!response.ok) {
            throw new ImageProcessError(`Failed to load SVG file: ${response.status}`, 'SOURCE_LOAD_FAILED');
          }

          // 응답 크기가 최대 허용 바이트를 초과하면 차단한다.
          checkResponseSize(response, maxBytes, 'SVG 리소스 경로');

          const svgContent = await readVerifiedSvgResponse(response, '원격 SVG 응답');
          return convertSvgToElement(svgContent, undefined, undefined, {
            quality: 'auto',
            crossOrigin: options?.crossOrigin,
          });
        }
        // 일반 문자열 SVG는 즉시 공통 처리기로 보낸다.
        else {
          return convertSvgToElement(source, undefined, undefined, {
            quality: 'auto',
            crossOrigin: options?.crossOrigin,
          });
        }
      } else {
        // Blob/File로 들어온 SVG는 문자열로 읽어 동일한 보안 검사를 거친다.
        const svgText = await (source as Blob).text();
        return convertSvgToElement(svgText, undefined, undefined, {
          quality: 'auto',
          crossOrigin: options?.crossOrigin,
        });
      }
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

// SVG 정규화는 브라우저 호환성을 위해 svg-compatibility 모듈에 위임한다.

/**
 * SVG 문자열을 Base64 Data URL로 변환한다.
 *
 * @param svgString SVG 문자열
 * @returns Base64 인코딩된 Data URL
 */
function createBase64DataUrl(svgString: string): string {
  try {
    // UTF-8 바이트 기준으로 안전하게 Base64 인코딩한다.
    const base64 = btoa(
      Array.from(new TextEncoder().encode(svgString))
        .map((byte) => String.fromCharCode(byte))
        .join('')
    );
    return `data:image/svg+xml;base64,${base64}`;
  } catch (error) {
    // Base64 인코딩이 실패하면 URL 인코딩 방식으로 폴백한다.
    const encoded = encodeURIComponent(svgString);
    return `data:image/svg+xml,${encoded}`;
  }
}

/** SVG 렌더링 시 품질과 CORS 동작을 제어하는 옵션이다. */
interface SvgRenderingOptions {
  /** 품질 수준 또는 자동 선택 */
  quality?: QualityLevel | 'auto';
  /** CORS 설정 */
  crossOrigin?: string;
}

/**
 * SVG 문자열의 크기가 허용 한도를 초과하는지 검사한다.
 *
 * @param svgString 검사할 SVG 문자열
 * @param label 에러 메시지에 포함할 입력 출처 레이블
 * @throws {ImageProcessError} 크기 초과 시
 */
function checkSvgSizeLimit(svgString: string, label: string): void {
  if (getUtf8ByteLength(svgString) > MAX_SVG_BYTES) {
    throw createSvgSizeLimitError(label);
  }
}

/**
 * SVG 입력 크기 제한 초과 에러를 생성한다.
 *
 * @param label 에러 메시지에 포함할 입력 출처 레이블
 * @returns 표준화된 크기 제한 초과 에러
 */
function createSvgSizeLimitError(label: string): ImageProcessError {
  return new ImageProcessError(
    `SVG 입력이 최대 허용 크기(${MAX_SVG_BYTES / 1024 / 1024}MiB)를 초과합니다: ${label}`,
    'INVALID_SOURCE'
  );
}

/**
 * 응답 헤더에 선언된 SVG 본문 크기가 허용 한도를 넘는지 사전 확인한다.
 *
 * @param response fetch 응답 객체
 * @param label 에러 메시지에 포함할 입력 출처 레이블
 */
function checkSvgContentLengthHeader(response: Response, label: string): void {
  const declaredLength = response.headers.get('content-length');
  if (!declaredLength) {
    return;
  }

  const parsedLength = Number.parseInt(declaredLength, 10);
  if (Number.isFinite(parsedLength) && parsedLength > MAX_SVG_BYTES) {
    throw createSvgSizeLimitError(label);
  }
}

/**
 * 원격 텍스트 응답 본문을 fail-closed 정책으로 읽고 크기를 검증한다.
 *
 * @param response fetch 응답 객체
 * @param label 에러 메시지에 포함할 입력 출처 레이블
 * @returns 검증된 응답 문자열
 */
async function readCheckedTextResponse(response: Response, label: string): Promise<string> {
  checkSvgContentLengthHeader(response, label);

  if (!response.body) {
    try {
      const responseText = await response.text();
      checkSvgSizeLimit(responseText, label);
      return responseText;
    } catch (error) {
      if (error instanceof ImageProcessError) {
        throw error;
      }

      throw new ImageProcessError(
        `${label} 본문을 안전하게 확인할 수 없어 로드를 차단합니다`,
        'INVALID_SOURCE',
        error as Error
      );
    }
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const decodedChunk = decoder.decode(value, { stream: true });
      totalBytes += value.byteLength;
      if (totalBytes > MAX_SVG_BYTES) {
        await reader.cancel();
        throw createSvgSizeLimitError(label);
      }

      chunks.push(decodedChunk);
    }

    const tailChunk = decoder.decode();
    chunks.push(tailChunk);
    return chunks.join('');
  } catch (error) {
    if (error instanceof ImageProcessError) {
      throw error;
    }

    throw new ImageProcessError(
      `${label} 본문을 안전하게 확인할 수 없어 로드를 차단합니다`,
      'INVALID_SOURCE',
      error as Error
    );
  } finally {
    reader.releaseLock();
  }
}

/**
 * 원격 SVG 응답 본문을 fail-closed 정책으로 읽고 검증한다.
 *
 * @param response fetch 응답 객체
 * @param label 에러 메시지에 포함할 입력 출처 레이블
 * @returns 검증된 SVG 문자열
 */
async function readVerifiedSvgResponse(response: Response, label: string): Promise<string> {
  const responseText = await readCheckedTextResponse(response, label);
  if (!isInlineSvg(responseText)) {
    throw new ImageProcessError('원격 응답이 유효한 SVG가 아닙니다', 'INVALID_SOURCE');
  }

  return responseText;
}

/**
 * SVG 문자열에 위험한 콘텐츠가 포함되어 있는지 검사한다.
 *
 * 다음 항목이 발견되면 ImageProcessError를 던진다:
 *  - `<script` 태그 (대소문자 무관)
 *  - `onload`, `onclick` 등 `on*` 이벤트 핸들러 속성
 *  - href, xlink:href, src 속성에 외부 URL(http://, https://), 상대 경로(./, ../, /), javascript: URI가 있는 경우
 *  - style 속성이나 `<style>` 태그 내부에 외부 URL 또는 상대 경로를 담은 url() 참조가 있는 경우
 *
 * @param svgString 검사할 SVG 문자열
 * @throws {ImageProcessError} 위험한 콘텐츠 발견 시
 */
function assertSafeSvgContent(svgString: string): void {
  const lower = svgString.toLowerCase();

  // 1. <script 태그 차단
  if (lower.includes('<script')) {
    throw new ImageProcessError('SVG 콘텐츠에 위험한 요소가 포함되어 있습니다: <script> 태그', 'INVALID_SOURCE');
  }

  // 2. onload / onclick 등 이벤트 핸들러 속성을 차단한다.
  if (/\son[a-z0-9:-]*\s*=/i.test(svgString)) {
    throw new ImageProcessError('SVG 콘텐츠에 위험한 요소가 포함되어 있습니다: 이벤트 핸들러 속성', 'INVALID_SOURCE');
  }

  // 3~4. 태그 내부 속성만 대상으로 외부 참조를 검사한다.
  const tagPattern = SVG_START_TAG_PATTERN;
  let tagMatch: RegExpExecArray | null;
  tagMatch = tagPattern.exec(svgString);
  while (tagMatch !== null) {
    const attrs = tagMatch[2];

    const refAttrPattern = /\s+(?:href|xlink:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|(?!["'])([^\s>]+))/gi;
    let refMatch: RegExpExecArray | null;
    refMatch = refAttrPattern.exec(attrs);
    while (refMatch !== null) {
      const refValue = refMatch[1] ?? refMatch[2] ?? refMatch[3];
      if (refValue && isBlockedSvgPolicyRef(refValue)) {
        throw new ImageProcessError('SVG 콘텐츠에 위험한 요소가 포함되어 있습니다: 외부 리소스 참조', 'INVALID_SOURCE');
      }
      refMatch = refAttrPattern.exec(attrs);
    }

    const styleDoubleQuote = /\s+style\s*=\s*"((?:[^"\\]|\\.)*)"/gi;
    const styleSingleQuote = /\s+style\s*=\s*'((?:[^'\\]|\\.)*)'/gi;
    const styleUnquoted = /\s+style\s*=\s*(?!["'])([^\s>]+)/gi;
    let styleMatch: RegExpExecArray | null;
    styleMatch = styleDoubleQuote.exec(attrs);
    while (styleMatch !== null) {
      if (_hasDangerousUrlRef(styleMatch[1])) {
        throw new ImageProcessError(
          'SVG 콘텐츠에 위험한 요소가 포함되어 있습니다: style 속성의 외부 url() 참조',
          'INVALID_SOURCE'
        );
      }
      styleMatch = styleDoubleQuote.exec(attrs);
    }
    styleMatch = styleSingleQuote.exec(attrs);
    while (styleMatch !== null) {
      if (_hasDangerousUrlRef(styleMatch[1])) {
        throw new ImageProcessError(
          'SVG 콘텐츠에 위험한 요소가 포함되어 있습니다: style 속성의 외부 url() 참조',
          'INVALID_SOURCE'
        );
      }
      styleMatch = styleSingleQuote.exec(attrs);
    }
    styleMatch = styleUnquoted.exec(attrs);
    while (styleMatch !== null) {
      if (_hasDangerousUrlRef(styleMatch[1])) {
        throw new ImageProcessError(
          'SVG 콘텐츠에 위험한 요소가 포함되어 있습니다: style 속성의 외부 url() 참조',
          'INVALID_SOURCE'
        );
      }
      styleMatch = styleUnquoted.exec(attrs);
    }

    tagMatch = tagPattern.exec(svgString);
  }

  // <style> 태그 내부 콘텐츠의 url() 추출
  const styleTagPattern = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleTagMatch: RegExpExecArray | null;
  styleTagMatch = styleTagPattern.exec(svgString);
  while (styleTagMatch !== null) {
    const styleContent = styleTagMatch[1];
    if (_hasDangerousUrlRef(styleContent)) {
      throw new ImageProcessError(
        'SVG 콘텐츠에 위험한 요소가 포함되어 있습니다: <style> 태그의 외부 url() 참조',
        'INVALID_SOURCE'
      );
    }
    styleTagMatch = styleTagPattern.exec(svgString);
  }
}

/**
 * CSS url() 함수 내부에 외부 URL이나 상대 경로 참조가 있는지 확인한다.
 *
 * @param cssText 검사할 CSS 텍스트
 * @returns 위험한 참조가 있으면 true
 */
function _hasDangerousUrlRef(cssText: string): boolean {
  const urlPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  let m: RegExpExecArray | null;
  m = urlPattern.exec(cssText);
  while (m !== null) {
    if (isBlockedSvgPolicyRef(m[1])) {
      return true;
    }
    m = urlPattern.exec(cssText);
  }
  return false;
}

/**
 * SVG 문자열을 HTMLImageElement로 변환한다.
 *
 * @description
 * 벡터 품질을 완전히 보존하면서 SVG를 HTMLImageElement로 변환한다.
 *
 * **핵심 최적화:**
 * - SVG 원본 유지 (벡터 → 래스터 변환 지연)
 * - Canvas에 목표 크기로 직접 렌더링 (중간 단계 제거)
 * - 복잡도 분석을 통한 자동 품질 수준 선택
 * - 대형 SVG는 Blob URL, 소형 SVG는 Base64 하이브리드 방식
 *
 * @param svgString 변환할 SVG 문자열
 * @param targetWidth 목표 너비 (픽셀, 선택)
 * @param targetHeight 목표 높이 (픽셀, 선택)
 * @param options 렌더링 옵션 (품질 수준, CORS 등)
 * @returns 완전히 로드된 HTMLImageElement
 */
async function convertSvgToElement(
  svgString: string,
  targetWidth?: number,
  targetHeight?: number,
  options?: SvgRenderingOptions
): Promise<HTMLImageElement> {
  // 렌더링 전에 위험 요소를 먼저 제거한다 (sanitize 계층)
  const sanitized = sanitizeSvg(svgString);
  // 위험한 SVG 콘텐츠는 테스트 환경 우회 이전에 차단한다
  assertSafeSvgContent(sanitized);
  // 크기 초과 입력도 테스트 환경 우회 이전에 차단한다
  checkSvgSizeLimit(sanitized, '인라인 SVG');

  // 테스트 환경에서는 실제 SVG 디코딩을 우회해 타임아웃을 방지한다.
  if (typeof globalThis !== 'undefined' && (globalThis as any)._SVG_MOCK_MODE) {
    return new Promise<HTMLImageElement>((resolve) => {
      const img = document.createElement('img');
      img.onload = () => resolve(img);
      // 최소 비용의 1x1 투명 PNG로 대체한다.
      img.src =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    });
  }

  try {
    // 1. 브라우저별 차이를 줄이기 위해 sanitize된 SVG를 정규화한다.
    const normalizedSvg = enhanceSvgForBrowser(sanitized);

    // 2. 원본 SVG의 크기 정보를 추출한다.
    const dimensions = extractSvgDimensions(normalizedSvg);

    // 3. 목표 렌더링 크기를 결정한다.
    const finalWidth = targetWidth || dimensions.width;
    const finalHeight = targetHeight || dimensions.height;

    // 4. 명시값 또는 복잡도 분석 결과로 품질 수준을 정한다.
    let qualityLevel: QualityLevel = 'medium';
    if (options?.quality === 'auto' || !options?.quality) {
      const complexityResult = analyzeSvgComplexity(normalizedSvg);
      qualityLevel = complexityResult.recommendedQuality;
    } else {
      qualityLevel = options.quality;
    }

    // 5. SVG는 벡터이므로 목표 크기로 바로 렌더링해 불필요한 스케일 단계를 없앤다.
    const renderWidth = finalWidth;
    const renderHeight = finalHeight;

    debugLog.log('🔧 convertSvgToElement direct rendering:', {
      originalDimensions: `${dimensions.width}x${dimensions.height}`,
      targetDimensions: `${finalWidth}x${finalHeight}`,
      qualityLevel,
      renderDimensions: `${renderWidth}x${renderHeight}`,
      hasExplicitSize: dimensions.hasExplicitSize,
      viewBox: dimensions.viewBox,
      timestamp: Date.now(),
    });

    // 7. 정규화된 SVG를 그대로 사용해 벡터 품질을 유지한다.
    const enhancedSvg = normalizedSvg;

    // 8. 크기에 따라 Blob URL과 Base64를 선택하는 하이브리드 로딩을 적용한다.
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = document.createElement('img');
      let objectUrl: string | null = null;

      // 로드 성공 시 임시 URL을 정리한다.
      img.onload = () => {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl); // Free memory
        }
        resolve(img);
      };

      // 로드 실패 시에도 임시 URL을 정리하고 표준 오류로 감싼다.
      img.onerror = (error) => {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl); // Free memory even on error
        }
        reject(
          new ImageProcessError(
            `SVG load failed: quality level ${qualityLevel}, size ${renderWidth}x${renderHeight}, error: ${error}`,
            'SOURCE_LOAD_FAILED'
          )
        );
      };

      // SVG 크기에 따라 메모리 효율과 속도 사이의 균형점을 선택한다.
      const svgSize = new Blob([enhancedSvg]).size;
      const SIZE_THRESHOLD = 50 * 1024; // 50KB threshold

      if (svgSize > SIZE_THRESHOLD) {
        // 큰 SVG는 Blob URL이 메모리 사용량에 유리하다.
        try {
          const blob = new Blob([enhancedSvg], { type: 'image/svg+xml' });
          objectUrl = URL.createObjectURL(blob);
          img.src = objectUrl;
        } catch (blobError) {
          // Blob 생성이 실패하면 Base64 방식으로 폴백한다.
          productionLog.warn('Failed to create Blob URL, fallback to Base64:', blobError);
          img.src = createBase64DataUrl(enhancedSvg);
        }
      } else {
        // 작은 SVG는 Base64가 더 단순하고 빠르다.
        img.src = createBase64DataUrl(enhancedSvg);
      }

      // 비동기 디코딩을 요청해 메인 스레드 부담을 줄인다.
      img.decoding = 'async';

      // 필요 시 CORS 설정을 전달한다.
      if (options?.crossOrigin) {
        img.crossOrigin = options.crossOrigin;
      }
    });
  } catch (error) {
    if (error instanceof ImageProcessError) {
      throw error;
    }
    throw new ImageProcessError(
      `SVG processing failed: ${error instanceof Error ? error.message : error}`,
      'SOURCE_LOAD_FAILED'
    );
  }
}

/**
 * Blob URL 응답을 읽어 HTMLImageElement로 변환한다.
 *
 * MIME 타입과 실제 본문을 함께 확인해 SVG를 이중 검증한다.
 */
async function loadBlobUrl(blobUrl: string, options?: ProcessorOptions): Promise<HTMLImageElement> {
  try {
    // 프로토콜 허용 여부를 먼저 확인한다.
    const allowedProtocols = options?.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;
    checkAllowedProtocol(blobUrl, allowedProtocols);

    // fetch 타임아웃과 AbortSignal을 결합한다.
    const timeoutMs = resolveFetchTimeoutMs(options);
    const signal = createFetchAbortSignal(timeoutMs, options?.abortSignal);

    // Blob URL도 fetch 응답을 통해 MIME 타입과 실제 콘텐츠를 함께 확인한다.
    const response = await fetch(blobUrl, signal ? { signal } : undefined);

    const maxBytes = options?.maxSourceBytes !== undefined ? options.maxSourceBytes : DEFAULT_MAX_SOURCE_BYTES;

    if (!response.ok) {
      throw new ImageProcessError(`Failed to load Blob URL: ${response.status}`, 'SOURCE_LOAD_FAILED');
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() || '';
    const blob = await readCheckedBlobResponse(response, maxBytes, 'Blob URL');

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
        });
      }
    }

    // SVG가 아니면 일반 이미지 로딩 경로를 사용한다.
    return new Promise((resolve, reject) => {
      const img = document.createElement('img');
      const objectUrl = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new ImageProcessError(`Failed to load Blob URL image: ${blobUrl}`, 'SOURCE_LOAD_FAILED'));
      };
      img.src = objectUrl;
    });
  } catch (error) {
    if (error instanceof ImageProcessError) {
      throw error;
    }
    throw new ImageProcessError('Error occurred while processing Blob URL', 'SOURCE_LOAD_FAILED', error as Error);
  }
}

/**
 * URL 응답을 읽어 HTMLImageElement로 변환한다.
 *
 * 원격 응답은 Content-Type 우선 판정 후, 필요할 때만 본문을 읽어 SVG 여부를 재확인한다.
 */
async function loadImageFromUrl(
  url: string,
  crossOrigin?: string,
  options?: ProcessorOptions
): Promise<HTMLImageElement> {
  const loadImageElementDirectly = () =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = document.createElement('img');

      if (crossOrigin) {
        img.crossOrigin = crossOrigin;
      }

      img.onload = () => resolve(img);
      img.onerror = () => reject(new ImageProcessError(`Failed to load image: ${url}`, 'SOURCE_LOAD_FAILED'));

      img.src = url;
    });

  try {
    // 명시적 URL 스킴이 있는 경우에만 프로토콜 허용 여부를 검사한다.
    // 상대 경로는 기존 브라우저 자산 로딩 경로를 유지한다.
    if (hasExplicitUrlScheme(url) || isProtocolRelativeUrl(url)) {
      const allowedProtocols = options?.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;
      checkAllowedProtocol(normalizePolicyUrl(url), allowedProtocols);
    }

    // fetch 타임아웃과 AbortSignal을 미리 준비한다.
    const timeoutMs = resolveFetchTimeoutMs(options);
    const signal = createFetchAbortSignal(timeoutMs, options?.abortSignal);
    const maxBytes = options?.maxSourceBytes !== undefined ? options.maxSourceBytes : DEFAULT_MAX_SOURCE_BYTES;

    // HTTP/HTTPS URL은 우선 fetch로 MIME 타입과 본문을 확인한다.
    if (url.startsWith('http://') || url.startsWith('https://') || isProtocolRelativeUrl(url)) {
      try {
        // 한 번의 GET 요청으로 Content-Type 확인과 실제 로딩을 함께 처리한다.
        const response = await fetch(url, {
          method: 'GET',
          mode: crossOrigin ? 'cors' : 'same-origin',
          ...(signal ? { signal } : {}),
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
            });
          }

          const responseText = await readCheckedTextResponse(response, '원격 XML 응답');
          // XML MIME 응답은 실제 SVG 루트가 확인된 경우에만 SVG로 처리한다.
          const isActualSvg = isXmlMime && isInlineSvg(responseText);
          if (isActualSvg) {
            return convertSvgToElement(responseText, undefined, undefined, {
              quality: 'auto',
              crossOrigin: options?.crossOrigin,
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

          img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(img);
          };
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
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
        if (signal?.aborted || isAbortLikeError(fetchError)) {
          throw new ImageProcessError('원격 이미지 로딩이 중단되었습니다', 'SOURCE_LOAD_FAILED', fetchError as Error);
        }
        // .svg URL은 fetch 실패 시 직접 로드로 넘기지 않고 차단한다 (fail-closed)
        if (isSvgResourcePath(url)) {
          throw new ImageProcessError('SVG URL을 안전하게 확인할 수 없어 로드를 차단합니다', 'INVALID_SOURCE');
        }
        // 비-SVG URL은 기존 방식대로 직접 로드로 폴백한다
        productionLog.warn('Failed to check Content-Type, fallback to default image loading:', fetchError);
      }
    }

    // 최종 폴백은 브라우저 기본 이미지 로딩이다.
    return loadImageElementDirectly();
  } catch (error) {
    // ImageProcessError는 이미 적절한 메시지를 가지므로 그대로 다시 던진다
    if (error instanceof ImageProcessError) {
      throw error;
    }
    throw new ImageProcessError('Error occurred while loading URL image', 'SOURCE_LOAD_FAILED', error as Error);
  }
}

/**
 * Auto-detect MIME type from ArrayBuffer
 *
 * @param buffer ArrayBuffer data
 * @returns Detected MIME type
 */
function detectMimeTypeFromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG signature: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // WebP signature: RIFF ... WEBP (check file header)
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    // Check WEBP signature (bytes 8-11)
    if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return 'image/webp';
    }
  }

  // GIF signature: GIF87a or GIF89a
  if (bytes.length >= 6) {
    const gifSignature = String.fromCharCode(...bytes.slice(0, 3));
    if (gifSignature === 'GIF') {
      const version = String.fromCharCode(...bytes.slice(3, 6));
      if (version === '87a' || version === '89a') {
        return 'image/gif';
      }
    }
  }

  // BMP signature: BM
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'image/bmp';
  }

  // TIFF signature: II* (little-endian) or MM* (big-endian)
  if (bytes.length >= 4) {
    if (
      (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
    ) {
      return 'image/tiff';
    }
  }

  // ICO signature: 00 00 01 00
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
    return 'image/x-icon';
  }

  // Return PNG as default
  return 'image/png';
}

/**
 * Convert HTMLCanvasElement to HTMLImageElement
 */
async function convertCanvasToElement(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const dataURL = canvas.toDataURL();

    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageProcessError('Failed to load Canvas image', 'SOURCE_LOAD_FAILED'));

    img.src = dataURL;
  });
}

/**
 * Convert Blob to HTMLImageElement (includes SVG high-quality processing)
 */
async function convertBlobToElement(blob: Blob, options?: ProcessorOptions): Promise<HTMLImageElement> {
  // maxSourceBytes 옵션이 설정된 경우, Blob 크기가 한도를 초과하면 오류를 던진다
  const maxBytes = options?.maxSourceBytes ?? DEFAULT_MAX_SOURCE_BYTES;
  if (maxBytes > 0 && blob.size > maxBytes) {
    throw new ImageProcessError(
      `Blob 크기(${blob.size} bytes)가 최대 허용 크기(${maxBytes} bytes)를 초과합니다`,
      'SOURCE_LOAD_FAILED'
    );
  }

  // MIME이 비어 있거나 XML 계열인 Blob도 본문을 스니핑해 SVG 경로를 우회하지 못하게 한다.
  const normalizedType = blob.type.toLowerCase();
  const shouldSniffSvg =
    normalizedType === '' ||
    normalizedType === 'image/svg+xml' ||
    normalizedType.includes('text/xml') ||
    normalizedType.includes('application/xml') ||
    (blob as File).name?.endsWith('.svg');

  // High-quality processing for SVG Blob
  if (shouldSniffSvg && ((normalizedType === 'image/svg+xml' || (blob as File).name?.endsWith('.svg')) || (await sniffSvgFromBlob(blob)))) {
    const svgText = await blob.text();
    return convertSvgToElement(svgText, undefined, undefined, {
      quality: 'auto',
    });
  }

  // Regular Blob processing
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new ImageProcessError('Failed to load Blob image', 'SOURCE_LOAD_FAILED'));
    };

    img.src = objectUrl;
  });
}

/**
 * Convert all ImageSource types to HTMLImageElement (main function)
 *
 * @description
 * Converts various types of image sources to unified HTMLImageElement format.
 * This function plays a core role in normalizing all processor inputs.
 *
 * **Supported Types:**
 * - HTMLImageElement: Already loaded images are returned as-is
 * - HTMLCanvasElement: Convert to Data URL then load
 * - Blob/File: ObjectURL or SVG special processing
 * - ArrayBuffer/Uint8Array: Auto-detect MIME type then convert to Blob
 * - String: URL, Data URL, SVG XML, file path, etc.
 *
 * **SVG Special Processing:**
 * - SVG applies normalization, complexity analysis, high-quality rendering
 * - Use optimized conversion path to preserve vector quality
 *
 * @param source Image source to convert
 * @param options Conversion options (CORS settings, etc.)
 * @returns Fully loaded HTMLImageElement
 *
 * @throws {ImageProcessError} When source type is unsupported or conversion fails
 */
export async function convertToImageElement(
  source: ImageSource,
  options?: ProcessorOptions
): Promise<HTMLImageElement> {
  try {
    if (source instanceof HTMLImageElement) {
      // Check if image is already loaded
      if (source.complete && source.naturalWidth > 0) {
        return source;
      }

      // Wait until loading is complete
      return new Promise((resolve, reject) => {
        if (source.complete && source.naturalWidth > 0) {
          resolve(source);
        } else {
          source.onload = () => resolve(source);
          source.onerror = () => reject(new ImageProcessError('Failed to load HTMLImageElement', 'SOURCE_LOAD_FAILED'));
        }
      });
    }

    // HTMLCanvasElement processing
    if (
      source instanceof HTMLCanvasElement ||
      (source && typeof source === 'object' && 'getContext' in source && 'toDataURL' in source)
    ) {
      return convertCanvasToElement(source as HTMLCanvasElement);
    }

    // Blob detection - use both instanceof and duck typing
    if (
      source instanceof Blob ||
      (source &&
        typeof source === 'object' &&
        'type' in source &&
        'size' in source &&
        ('slice' in source || 'arrayBuffer' in source))
    ) {
      return convertBlobToElement(source as Blob, options);
    }

    if (source instanceof ArrayBuffer) {
      const mimeType = detectMimeTypeFromBuffer(source);
      const blob = new Blob([source], { type: mimeType });
      return convertBlobToElement(blob, options);
    }

    if (source instanceof Uint8Array) {
      // Safely convert Uint8Array to ArrayBuffer
      const arrayBuffer =
        source.buffer instanceof ArrayBuffer
          ? source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength)
          : source.slice().buffer;
      const mimeType = detectMimeTypeFromBuffer(arrayBuffer);
      const blob = new Blob([arrayBuffer], { type: mimeType });
      return convertBlobToElement(blob, options);
    }

    if (typeof source === 'string') {
      return convertStringToElement(source, options);
    }

    throw new ImageProcessError(`Unsupported source type: ${typeof source}`, 'INVALID_SOURCE');
  } catch (error) {
    if (error instanceof ImageProcessError) {
      throw error;
    }

    throw new ImageProcessError(
      'Unknown error occurred during source conversion',
      'SOURCE_LOAD_FAILED',
      error as Error
    );
  }
}

/**
 * Get size information of image source
 *
 * @description Extract actual size information from various image sources.
 * @param source Image source to get size information from
 * @returns Width and height information of the image
 */
export async function getImageDimensions(source: ImageSource): Promise<{
  width: number;
  height: number;
}> {
  const element = await convertToImageElement(source);
  return {
    width: element.naturalWidth || element.width,
    height: element.naturalHeight || element.height,
  };
}
