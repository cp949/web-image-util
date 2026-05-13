import { DEFAULT_ALLOWED_PROTOCOLS, DEFAULT_FETCH_TIMEOUT_MS, MAX_SVG_BYTES } from '../core/source-converter/options';
import { isDataUrlSvg, parseSvgFromDataUrl } from '../core/source-converter/svg/data-url';
import { checkResponseSize, createFetchAbortHandle } from '../core/source-converter/url/fetch-guards';
import {
  checkAllowedProtocol,
  hasExplicitUrlScheme,
  isAbortLikeError,
  isProtocolRelativeUrl,
} from '../core/source-converter/url/policy';
import { ImageProcessError } from '../errors';
import type { InspectSvgReport } from './inspect-svg';
import { inspectSvg } from './inspect-svg';

const textEncoder = new TextEncoder();

/** SVG로 판정할 수 있는 입력 타입. HTMLImageElement / Canvas 등은 비-허용(D2). */
export type InspectSvgSourceInput = string | Blob | File | URL;

/** fetch 모드(D3). 기본 'never'. */
export type InspectSvgSourceFetchMode = 'never' | 'metadata' | 'body';

/**
 * source가 SVG로 판정됐는지 + 본문 도출 가능 여부.
 * - 'svg': MIME/extension/sniff 결과 SVG. 본문 도출 가능한 경우 svg 필드도 채움.
 * - 'not-svg-source': 입력 타입은 허용되지만 SVG가 아님.
 * - 'unknown': SVG 후보가 불명확 (예: text/plain MIME + body 미sniff).
 */
export type InspectSvgSourceKind = 'svg' | 'not-svg-source' | 'unknown';

/** source 단계 finding 코드(단일 출처). RM-001 finding code와 별도 namespace. */
export type InspectSvgSourceFindingCode =
  | 'source-kind-unsupported'
  | 'mime-mismatch'
  | 'extension-mismatch'
  | 'byte-limit-exceeded'
  | 'data-url-decode-failed'
  | 'fetch-disabled-by-option'
  | 'fetch-blocked-policy'
  | 'fetch-protocol-disallowed'
  | 'fetch-aborted'
  | 'fetch-timeout'
  | 'fetch-failed'
  | 'fetch-status-error'
  | 'body-consumed-once';

export interface InspectSvgSourceFinding {
  code: InspectSvgSourceFindingCode;
  /** 영어 자연문. 호출자 분기 대상이 아니며 patch에서도 다듬을 수 있다. */
  message: string;
  /** 호출자 분기용 구조화 컨텍스트. 원본 URL/Data URL 본문/Blob 내용은 담지 않는다. */
  details?: Record<string, unknown>;
}

export interface InspectSvgSourceMeta {
  originalKind: 'string' | 'data-url' | 'url-string' | 'blob' | 'file';
  /** 입력의 MIME 타입(Blob/File / Data URL에서 추출). 알 수 없으면 null. */
  mime: string | null;
  /** URL/파일명에서 추출한 확장자(소문자, '.svg'는 'svg'로). 없으면 null. */
  extension: string | null;
  /**
   * 입력 URL의 마스킹된 표현(D10). origin + path만, query/fragment 제거.
   * File 객체이면 null.
   */
  url: string | null;
  /** 입력 byte 수(추정 가능한 경우). Blob.size / Data URL payload 길이 / Response Content-Length 등. */
  bytes: number | null;
  /** Blob/Response 본문을 1회 소비했는지(D11). */
  consumed: boolean;
}

export interface InspectSvgSourceFetchInfo {
  mode: InspectSvgSourceFetchMode;
  /** 실제 fetch 시도 여부. policy로 차단되면 false. */
  performed: boolean;
  /** HTTP status. fetch 미수행 시 null. */
  status: number | null;
}

export interface InspectSvgSourceReport {
  kind: InspectSvgSourceKind;
  source: InspectSvgSourceMeta;
  /** URL 입력 + fetch 옵션이 작용한 경우에만 객체. 그 외는 null. */
  fetch: InspectSvgSourceFetchInfo | null;
  /** kind === 'svg' + 본문 도출 성공 시에만 RM-001 report. 그 외 null. */
  svg: InspectSvgReport | null;
  /** source/routing 단계 finding. svg 본문 단계 finding은 svg.findings에 있다. */
  findings: InspectSvgSourceFinding[];
  /** 실행 환경(D12). RM-001/RM-005와 동일 규칙. */
  environment: 'browser' | 'happy-dom' | 'node' | 'unknown';
}

export interface InspectSvgSourceOptions {
  /** fetch 정책(D3). 기본 'never'. */
  fetch?: InspectSvgSourceFetchMode;
  /** fetch 모드에서만 사용되는 abort signal(D9). */
  signal?: AbortSignal;
  /** fetch 모드에서만 사용되는 timeout(ms)(D9). 기본 DEFAULT_FETCH_TIMEOUT_MS = 30_000. */
  timeoutMs?: number;
  /** byte cap 하향 조정(D8). 1 <= byteLimit <= MAX_SVG_BYTES. 기본 MAX_SVG_BYTES. */
  byteLimit?: number;
}

/**
 * 현재 실행 환경을 감지한다. inspectSvg / prefixSvgIds와 동일 규칙을 인라인으로 둔다(D12).
 * 평가 순서: happyDOM → browser → node → unknown.
 */
function detectInspectSourceEnvironment(): 'browser' | 'happy-dom' | 'node' | 'unknown' {
  if ((globalThis as unknown as Record<string, unknown>).happyDOM != null) {
    return 'happy-dom';
  }
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof DOMParser !== 'undefined') {
    return 'browser';
  }
  if (typeof process !== 'undefined' && process.versions?.node) {
    return 'node';
  }
  return 'unknown';
}

/**
 * 입력의 MIME 타입과 파일 확장자를 추출한다.
 * File 분기는 Blob보다 먼저 평가된다(originalKind로 이미 구분됨).
 */
function detectMimeAndExtension(
  source: InspectSvgSourceInput,
  originalKind: InspectSvgSourceMeta['originalKind']
): { mime: string | null; extension: string | null } {
  if (originalKind === 'data-url') {
    const str = source as string;
    // isDataUrlSvg가 true이면 mime을 'image/svg+xml'로 확정한다(확장 sniff 우선).
    if (isDataUrlSvg(str)) {
      return { mime: 'image/svg+xml', extension: null };
    }
    const match = str.match(/^data:([^;,]+)/i);
    return { mime: match ? match[1].toLowerCase() : null, extension: null };
  }

  if (originalKind === 'url-string') {
    try {
      const urlObj = source instanceof URL ? source : new URL(source as string);
      const lastDot = urlObj.pathname.lastIndexOf('.');
      const ext = lastDot >= 0 ? urlObj.pathname.slice(lastDot + 1).toLowerCase() : null;
      return { mime: null, extension: ext || null };
    } catch {
      return { mime: null, extension: null };
    }
  }

  if (originalKind === 'string') {
    return { mime: null, extension: null };
  }

  if (originalKind === 'file') {
    const file = source as File;
    const mime = file.type || null;
    const lastDot = file.name ? file.name.lastIndexOf('.') : -1;
    const ext = lastDot >= 0 ? file.name.slice(lastDot + 1).toLowerCase() : null;
    return { mime, extension: ext || null };
  }

  // 'blob'
  return { mime: (source as Blob).type || null, extension: null };
}

interface DecideSvgFromSniffParams {
  originalKind: InspectSvgSourceMeta['originalKind'];
  mime: string | null;
  extension: string | null;
  bytes: number | null;
  byteLimit: number;
}

/**
 * MIME / 확장자 / originalKind / byte 크기를 종합해 kind 1차 분기를 결정한다.
 * fetch와 본문 도출은 수행하지 않는다.
 */
function decideSvgFromSniff({ originalKind, mime, extension, bytes, byteLimit }: DecideSvgFromSniffParams): {
  kind: InspectSvgSourceKind;
  findings: InspectSvgSourceFinding[];
} {
  const findings: InspectSvgSourceFinding[] = [];

  // byte 초과 시 본문 sniff 불가 → 'unknown'으로 보수적 처리.
  if (bytes !== null && bytes > byteLimit) {
    findings.push({
      code: 'byte-limit-exceeded',
      message: `Input size (${bytes} bytes) exceeds byte limit (${byteLimit} bytes).`,
      details: { bytes, byteLimit },
    });
    return { kind: 'unknown', findings };
  }

  // MIME이 'image/svg+xml'이면 SVG로 확정한다.
  if (mime === 'image/svg+xml') {
    if (extension !== null && extension !== 'svg') {
      findings.push({
        code: 'extension-mismatch',
        message: `MIME type is image/svg+xml but file extension is .${extension}.`,
        details: { mime, extension },
      });
    }
    return { kind: 'svg', findings };
  }

  // 확장자가 'svg'이면 SVG로 확정한다.
  if (extension === 'svg') {
    if (mime !== null && mime !== 'image/svg+xml') {
      findings.push({
        code: 'mime-mismatch',
        message: `File extension is .svg but MIME type is ${mime}.`,
        details: { mime, extension },
      });
    }
    return { kind: 'svg', findings };
  }

  // inline string은 본문 sniff(TASK-03)에서 확정한다.
  if (originalKind === 'string') {
    return { kind: 'unknown', findings };
  }

  return { kind: 'not-svg-source', findings };
}

type ExtractSvgBodySuccess = { svgString: string; consumed: boolean };
type ExtractSvgBodyFailure = {
  failure: InspectSvgSourceFindingCode | 'fetch-not-attempted-in-this-task';
  /** .text()를 호출했는지 여부. fail 분기에서도 consumed 표기를 정합 있게 유지하기 위함(D11). */
  consumed?: boolean;
};

/**
 * 입력으로부터 SVG 문자열을 도출한다.
 * URL 경로(fetch)는 본 함수 범위 밖이다(TASK-04).
 */
async function extractSvgBody(
  source: InspectSvgSourceInput,
  originalKind: InspectSvgSourceMeta['originalKind'],
  byteLimit: number
): Promise<ExtractSvgBodySuccess | ExtractSvgBodyFailure> {
  if (originalKind === 'string') {
    // 문자열은 항상 그대로 반환하고 inspectSvg에 위임한다.
    return { svgString: source as string, consumed: false };
  }

  if (originalKind === 'data-url') {
    try {
      const svgString = parseSvgFromDataUrl(source as string);
      return { svgString, consumed: false };
    } catch {
      return { failure: 'data-url-decode-failed' };
    }
  }

  if (originalKind === 'blob' || originalKind === 'file') {
    const blob = source as Blob;
    // .size 사전 검증으로 큰 Blob의 .text() 호출(메모리 폭발)을 차단한다.
    if (blob.size > byteLimit) {
      return { failure: 'byte-limit-exceeded' };
    }
    const text = await blob.text();
    const byteCount = textEncoder.encode(text).byteLength;
    if (byteCount > byteLimit) {
      // .text()는 이미 호출됐으므로 consumed 정보를 fail 분기에도 함께 보존한다(D11).
      return { failure: 'byte-limit-exceeded', consumed: true };
    }
    return { svgString: text, consumed: true };
  }

  // url-string: TASK-04에서 구현. 현재는 placeholder.
  return { failure: 'fetch-not-attempted-in-this-task' };
}

/**
 * source.url에 노출할 마스킹된 URL 표현을 반환한다(D10).
 * - url-string: origin + pathname만 노출. query/fragment 제거. 비-http(s)/blob/data 프로토콜은 protocol://[masked].
 * - data-url: data:<mime>[;base64],[masked] 형태. payload 본문 미포함.
 * - 그 외(string/blob/file): null.
 */
function maskSourceUrl(
  input: InspectSvgSourceInput,
  originalKind: InspectSvgSourceMeta['originalKind']
): string | null {
  if (originalKind === 'data-url' && typeof input === 'string') {
    const match = input.match(/^data:([^,;]+)/);
    const mime = match ? match[1] : '';
    return `data:${mime}[;base64],[masked]`;
  }

  if (originalKind === 'url-string') {
    const urlStr = typeof input === 'string' ? input : (input as URL).toString();
    try {
      const url = new URL(urlStr);
      const allowedForOrigin = ['http:', 'https:', 'blob:', 'data:'];
      if (!allowedForOrigin.includes(url.protocol)) {
        return `${url.protocol}//[masked]`;
      }
      return `${url.origin}${url.pathname}`;
    } catch {
      return null;
    }
  }

  return null;
}

/** finding 배열에서 code 기준으로 중복을 제거한다(먼저 등장한 항목 유지). */
function deduplicateFindings(findings: InspectSvgSourceFinding[]): InspectSvgSourceFinding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    if (seen.has(f.code)) return false;
    seen.add(f.code);
    return true;
  });
}

/**
 * 입력값의 originalKind를 판정한다.
 * File은 Blob 하위 타입이므로 Blob 분기보다 먼저 평가해야 한다(D4).
 */
function detectOriginalKind(source: InspectSvgSourceInput): InspectSvgSourceMeta['originalKind'] {
  if (source instanceof File) return 'file';
  if (source instanceof Blob) return 'blob';
  if (source instanceof URL) return 'url-string';
  // 위 instanceof 분기로 string 외 타입은 모두 제거됐다.
  if (isDataUrlSvg(source) || source.startsWith('data:')) return 'data-url';
  if (hasExplicitUrlScheme(source) || isProtocolRelativeUrl(source)) return 'url-string';
  return 'string';
}

/**
 * SVG 후보 입력(`string | Blob | File | URL`)을 진단한다.
 *
 * `processImage()`로 변환 시도하기 전에 입력이 SVG로 라우팅되는지, 어떤 단계에서 결정됐는지,
 * 원격 fetch가 정책으로 차단되는지를 확인할 수 있다.
 *
 * 기본 동작에서 네트워크 fetch는 수행되지 않는다(`options.fetch === 'never'`).
 * `'metadata'`는 HEAD 요청, `'body'`는 GET + byte cap 내 본문 sniff를 수행한다.
 *
 * @throws {ImageProcessError} code=`SVG_SOURCE_INVALID` — 입력 타입이 string/Blob/File/URL 어느 것도 아님.
 * @throws {ImageProcessError} code=`OPTION_INVALID` — options 형식 위반(fetch/byteLimit/timeoutMs/signal).
 */
export async function inspectSvgSource(
  source: InspectSvgSourceInput,
  options?: InspectSvgSourceOptions
): Promise<InspectSvgSourceReport> {
  // 입력 타입 검증 (D2, D13)
  const isAllowedInput =
    typeof source === 'string' || source instanceof Blob || source instanceof File || source instanceof URL;

  if (!isAllowedInput) {
    const actualType = source === null ? 'null' : typeof source;
    throw new ImageProcessError(
      `inspectSvgSource expects a string, Blob, File, or URL, but received ${actualType}.`,
      'SVG_SOURCE_INVALID',
      { details: { actualType } }
    );
  }

  // options 검증 (D13)
  if (options !== undefined) {
    if (options.fetch !== undefined && !['never', 'metadata', 'body'].includes(options.fetch)) {
      throw new ImageProcessError(
        `inspectSvgSource expects options.fetch to be 'never' | 'metadata' | 'body'.`,
        'OPTION_INVALID',
        { details: { option: 'fetch' } }
      );
    }

    if (
      options.byteLimit !== undefined &&
      (!Number.isInteger(options.byteLimit) || options.byteLimit < 1 || options.byteLimit > MAX_SVG_BYTES)
    ) {
      throw new ImageProcessError(
        `inspectSvgSource expects options.byteLimit to be an integer between 1 and MAX_SVG_BYTES.`,
        'OPTION_INVALID',
        { details: { option: 'byteLimit' } }
      );
    }

    if (options.timeoutMs !== undefined && (!Number.isInteger(options.timeoutMs) || options.timeoutMs <= 0)) {
      throw new ImageProcessError(
        `inspectSvgSource expects options.timeoutMs to be a positive integer.`,
        'OPTION_INVALID',
        { details: { option: 'timeoutMs' } }
      );
    }

    if (options.signal !== undefined && !(options.signal instanceof AbortSignal)) {
      throw new ImageProcessError(`inspectSvgSource expects options.signal to be an AbortSignal.`, 'OPTION_INVALID', {
        details: { option: 'signal' },
      });
    }
  }

  const originalKind = detectOriginalKind(source);
  const environment = detectInspectSourceEnvironment();

  let { mime, extension } = detectMimeAndExtension(source, originalKind);

  // bytes 추정: Blob/File은 .size 사용, 문자열은 UTF-8 바이트 수 계산, URL은 null.
  let bytes: number | null;
  if (originalKind === 'blob' || originalKind === 'file') {
    bytes = (source as Blob).size;
  } else if (originalKind === 'url-string') {
    bytes = null;
  } else {
    // 'string' | 'data-url'
    bytes = textEncoder.encode(source as string).byteLength;
  }

  const effectiveByteLimit = options?.byteLimit ?? MAX_SVG_BYTES;
  let { kind, findings } = decideSvgFromSniff({
    originalKind,
    mime,
    extension,
    bytes,
    byteLimit: effectiveByteLimit,
  });

  let svgReport: InspectSvgReport | null = null;
  let consumed = false;
  let fetchInfo: InspectSvgSourceFetchInfo | null = null;

  if (originalKind === 'url-string') {
    const href = source instanceof URL ? source.href : (source as string);
    const fetchMode = options?.fetch ?? 'never';

    if (fetchMode === 'never') {
      findings.push({ code: 'fetch-disabled-by-option', message: 'URL fetch is disabled (options.fetch is "never").' });

      let policyBlocked = false;
      try {
        checkAllowedProtocol(href, DEFAULT_ALLOWED_PROTOCOLS);
      } catch {
        findings.push({ code: 'fetch-protocol-disallowed', message: 'URL protocol is not in the allowed list.' });
        kind = 'not-svg-source';
        policyBlocked = true;
      }

      if (!policyBlocked && kind === 'not-svg-source') {
        findings.push({
          code: 'source-kind-unsupported',
          message: 'URL does not point to an SVG resource (no .svg extension).',
        });
      }

      fetchInfo = { mode: 'never', performed: false, status: null };
    } else {
      // 'metadata' 또는 'body'
      let policyBlocked = false;
      try {
        checkAllowedProtocol(href, DEFAULT_ALLOWED_PROTOCOLS);
      } catch {
        findings.push({ code: 'fetch-protocol-disallowed', message: 'URL protocol is not in the allowed list.' });
        kind = 'not-svg-source';
        policyBlocked = true;
      }

      if (policyBlocked) {
        fetchInfo = { mode: fetchMode, performed: false, status: null };
      } else {
        const timeoutMs = options?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
        const handle = createFetchAbortHandle(timeoutMs, options?.signal);
        let responseStatus: number | null = null;
        let fetchAttempted = false;

        try {
          if (fetchMode === 'metadata') {
            const response = await fetch(href, { method: 'HEAD', signal: handle.signal });
            fetchAttempted = true;
            responseStatus = response.status;

            const contentType = response.headers.get('content-type');
            if (contentType) {
              mime = contentType.split(';')[0].trim().toLowerCase() || null;
            }
            const contentLengthHeader = response.headers.get('content-length');
            if (contentLengthHeader !== null) {
              const cl = Number(contentLengthHeader);
              if (Number.isFinite(cl) && cl >= 0) bytes = cl;
            }

            if (responseStatus < 200 || responseStatus >= 300) {
              findings.push({
                code: 'fetch-status-error',
                message: `HEAD request returned HTTP ${responseStatus}.`,
                details: { status: responseStatus },
              });
            }

            // MIME 정보가 갱신됐으므로 kind 재결정
            const reDecided = decideSvgFromSniff({
              originalKind,
              mime,
              extension,
              bytes,
              byteLimit: effectiveByteLimit,
            });
            kind = reDecided.kind;
            findings.push(...reDecided.findings);

            fetchInfo = { mode: 'metadata', performed: true, status: responseStatus };
            consumed = false;
          } else {
            // 'body'
            const response = await fetch(href, { method: 'GET', signal: handle.signal });
            fetchAttempted = true;
            responseStatus = response.status;

            const contentType = response.headers.get('content-type');
            if (contentType) {
              mime = contentType.split(';')[0].trim().toLowerCase() || null;
            }
            const contentLengthHeader = response.headers.get('content-length');
            if (contentLengthHeader !== null) {
              const cl = Number(contentLengthHeader);
              if (Number.isFinite(cl) && cl >= 0) bytes = cl;
            }

            if (responseStatus < 200 || responseStatus >= 300) {
              findings.push({
                code: 'fetch-status-error',
                message: `GET request returned HTTP ${responseStatus}.`,
                details: { status: responseStatus },
              });
            }

            // Content-Length 기반 byte cap 검증 (초과 시 finding 추가, 본문 미소비)
            let byteLimitExceeded = false;
            try {
              checkResponseSize(response, effectiveByteLimit, 'inspect-svg-source body');
            } catch {
              findings.push({
                code: 'byte-limit-exceeded',
                message: `Response Content-Length exceeds byte limit (${effectiveByteLimit} bytes).`,
                details: { byteLimit: effectiveByteLimit },
              });
              kind = 'unknown';
              byteLimitExceeded = true;
            }

            if (!byteLimitExceeded) {
              const svgString = await response.text();
              consumed = true;
              findings.push({ code: 'body-consumed-once', message: 'Response body was consumed once via .text().' });

              if (bytes === null) {
                bytes = textEncoder.encode(svgString).byteLength;
              }

              svgReport = inspectSvg(svgString);

              if (mime === 'image/svg+xml' || svgReport.valid === true) {
                kind = 'svg';
              } else {
                kind = 'not-svg-source';
              }
            }

            fetchInfo = { mode: 'body', performed: true, status: responseStatus };
          }
        } catch (error) {
          if (isAbortLikeError(error)) {
            // AbortSignal.timeout() 발동 시 일부 런타임은 error.name='AbortError'를 던지면서
            // signal.reason에 TimeoutError DOMException을 담는다. 두 위치 모두 확인한다.
            const errorName = error instanceof Error ? error.name : '';
            const signalReason = handle.signal?.aborted ? handle.signal.reason : undefined;
            const reasonName =
              signalReason && typeof signalReason === 'object' && 'name' in signalReason
                ? String((signalReason as { name: unknown }).name)
                : '';
            const isTimeout = errorName === 'TimeoutError' || reasonName === 'TimeoutError';

            if (isTimeout) {
              findings.push({ code: 'fetch-timeout', message: 'URL fetch timed out.' });
            } else {
              findings.push({ code: 'fetch-aborted', message: 'URL fetch was aborted by the caller.' });
            }
          } else {
            findings.push({ code: 'fetch-failed', message: 'URL fetch failed.' });
          }
          kind = 'unknown';
          fetchInfo = { mode: fetchMode, performed: fetchAttempted, status: responseStatus };
        } finally {
          handle.dispose();
        }
      }
    }
  } else if (kind === 'svg' || kind === 'unknown') {
    // url-string이 아닌 경우 본문 도출(string/data-url/blob/file)
    const extracted = await extractSvgBody(source, originalKind, effectiveByteLimit);

    if ('svgString' in extracted) {
      consumed = extracted.consumed;
      svgReport = inspectSvg(extracted.svgString);

      if (consumed) {
        findings.push({ code: 'body-consumed-once', message: 'Blob/File body was consumed once via .text().' });
      }

      // kind 보정: unknown 상태에서 inspectSvg 결과로 확정
      if (svgReport.valid === false && kind === 'unknown') {
        kind = 'not-svg-source';
      } else if (originalKind === 'string' && svgReport.valid === true) {
        kind = 'svg';
      }
    } else {
      const { failure } = extracted;

      // .text() 호출 후 fail이라도 D11에 따라 consumed 표기 + body-consumed-once finding을 보고한다.
      if (extracted.consumed === true) {
        consumed = true;
        findings.push({ code: 'body-consumed-once', message: 'Blob/File body was consumed once via .text().' });
      }

      if (failure === 'data-url-decode-failed') {
        findings.push({
          code: 'data-url-decode-failed',
          message: 'Failed to decode Data URL as SVG content.',
        });
        kind = 'unknown';
      } else if (failure === 'byte-limit-exceeded') {
        findings.push({
          code: 'byte-limit-exceeded',
          message: `Blob/File body size exceeds byte limit (${effectiveByteLimit} bytes).`,
          details: { byteLimit: effectiveByteLimit },
        });
        kind = 'unknown';
      }
    }
  }

  return {
    kind,
    source: {
      originalKind,
      mime,
      extension,
      url: maskSourceUrl(source, originalKind),
      bytes,
      consumed,
    },
    fetch: fetchInfo,
    svg: svgReport,
    findings: deduplicateFindings(findings),
    environment,
  };
}
