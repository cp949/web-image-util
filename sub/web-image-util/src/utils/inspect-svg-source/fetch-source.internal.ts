import { DEFAULT_ALLOWED_PROTOCOLS, DEFAULT_FETCH_TIMEOUT_MS } from '../../core/source-converter/options.internal';
import { type CheckedTextResponse, readCheckedTextResponse } from '../../core/source-converter/svg/safety.internal';
import { checkResponseSize, createFetchAbortHandle } from '../../core/source-converter/url/fetch-guards.internal';
import {
  checkAllowedProtocol,
  isAbortLikeError,
  normalizePolicyUrl,
} from '../../core/source-converter/url/policy.internal';
import { buildSvgBytesExceededFinding } from '../../svg-contract.internal';
import { ImageProcessError } from '../../types';
import type { InspectSvgReport } from '../inspect-svg';
import { inspectSvg } from '../inspect-svg';
import { decideSvgFromSniff } from './sniff-decision.internal';
import type {
  InspectSvgSourceFetchInfo,
  InspectSvgSourceFinding,
  InspectSvgSourceInput,
  InspectSvgSourceKind,
  InspectSvgSourceOptions,
} from './types.internal';

interface UrlFetchContext {
  mime: string | null;
  extension: string | null;
  bytes: number | null;
  kind: InspectSvgSourceKind;
  findings: InspectSvgSourceFinding[];
  consumed: boolean;
  svgReport: InspectSvgReport | null;
}

interface ResponseMetadata {
  mime: string | null;
  bytes: number | null;
  status: number;
}

export interface HandleUrlSvgSourceFetchParams {
  source: InspectSvgSourceInput;
  mime: string | null;
  extension: string | null;
  bytes: number | null;
  kind: InspectSvgSourceKind;
  findings: InspectSvgSourceFinding[];
  options: InspectSvgSourceOptions | undefined;
  byteLimit: number;
}

export interface HandleUrlSvgSourceFetchResult {
  mime: string | null;
  extension: string | null;
  bytes: number | null;
  kind: InspectSvgSourceKind;
  findings: InspectSvgSourceFinding[];
  consumed: boolean;
  fetchInfo: InspectSvgSourceFetchInfo;
  svgReport: InspectSvgReport | null;
}

function createFetchResult(
  context: UrlFetchContext,
  fetchInfo: InspectSvgSourceFetchInfo
): HandleUrlSvgSourceFetchResult {
  return {
    mime: context.mime,
    extension: context.extension,
    bytes: context.bytes,
    kind: context.kind,
    findings: context.findings,
    consumed: context.consumed,
    fetchInfo,
    svgReport: context.svgReport,
  };
}

function applyProtocolPolicy(context: UrlFetchContext, policyHref: string): boolean {
  try {
    checkAllowedProtocol(policyHref, DEFAULT_ALLOWED_PROTOCOLS);
    return false;
  } catch {
    context.findings.push({ code: 'fetch-protocol-disallowed', message: 'URL protocol is not in the allowed list.' });
    context.kind = 'not-svg-source';
    return true;
  }
}

function applyDisabledFetchFindings(context: UrlFetchContext, policyHref: string): void {
  context.findings.push({
    code: 'fetch-disabled-by-option',
    message: 'URL fetch is disabled (options.fetch is "never").',
  });

  const policyBlocked = applyProtocolPolicy(context, policyHref);

  if (!policyBlocked && context.kind === 'not-svg-source') {
    context.findings.push({
      code: 'source-kind-unsupported',
      message: 'URL does not point to an SVG resource (no .svg extension).',
    });
  }
}

function readResponseMetadata(response: Response): ResponseMetadata {
  const contentType = response.headers.get('content-type');
  const contentLengthHeader = response.headers.get('content-length');
  let bytes: number | null = null;

  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength >= 0) bytes = contentLength;
  }

  return {
    mime: contentType?.split(';')[0].trim().toLowerCase() || null,
    bytes,
    status: response.status,
  };
}

function applyResponseMetadata(context: UrlFetchContext, metadata: ResponseMetadata): void {
  if (metadata.mime) context.mime = metadata.mime;
  if (metadata.bytes !== null) context.bytes = metadata.bytes;
}

function pushFetchStatusFinding(findings: InspectSvgSourceFinding[], method: 'HEAD' | 'GET', status: number): void {
  if (status < 200 || status >= 300) {
    findings.push({
      code: 'fetch-status-error',
      message: `${method} request returned HTTP ${status}.`,
      details: { status },
    });
  }
}

function redetectUrlKind(context: UrlFetchContext, byteLimit: number): void {
  const reDecided = decideSvgFromSniff({
    originalKind: 'url-string',
    mime: context.mime,
    extension: context.extension,
    bytes: context.bytes,
    byteLimit,
  });
  context.kind = reDecided.kind;
  context.findings.push(...reDecided.findings);
}

async function fetchUrlMetadata(
  policyHref: string,
  signal: AbortSignal | undefined,
  context: UrlFetchContext,
  byteLimit: number
): Promise<number> {
  const response = await fetch(policyHref, { method: 'HEAD', signal });
  const metadata = readResponseMetadata(response);
  applyResponseMetadata(context, metadata);
  pushFetchStatusFinding(context.findings, 'HEAD', metadata.status);
  redetectUrlKind(context, byteLimit);
  return metadata.status;
}

async function fetchUrlBody(
  policyHref: string,
  signal: AbortSignal | undefined,
  context: UrlFetchContext,
  byteLimit: number
): Promise<number> {
  const response = await fetch(policyHref, { method: 'GET', signal });
  const metadata = readResponseMetadata(response);
  applyResponseMetadata(context, metadata);
  pushFetchStatusFinding(context.findings, 'GET', metadata.status);

  try {
    // 공유 가드가 초과 시 본문 취소까지 수행한다.
    //
    // 이 사전 검사는 아래 readCheckedTextResponse가 내부에서 반복하는 헤더 판정과 겹치지만
    // 지우면 안 된다 — Content-Length 초과를 여기서 잡아야 헤더가 선언한 크기를 bytes로
    // 보고할 수 있다. 어댑터 안에서 잡히면 실제 수신량만 알 수 있어 보고값이 달라진다.
    await checkResponseSize(response, byteLimit, 'inspect-svg-source body');
  } catch {
    // byte 초과 finding은 공유 계약(빌더)으로 조립한다. 이 분기는 초과한 Content-Length를 실제 크기로 쓴다.
    context.findings.push(buildSvgBytesExceededFinding(context.bytes, byteLimit));
    context.kind = 'unknown';
    return metadata.status;
  }

  const hasResponseStream = response.body !== null;
  let body: CheckedTextResponse;
  try {
    body = await readCheckedTextResponse(response, 'inspect-svg-source body', byteLimit);
  } catch (error) {
    if (error instanceof ImageProcessError && error.code === 'SVG_BYTES_EXCEEDED') {
      context.consumed = true;
      context.findings.push({ code: 'body-consumed-once', message: 'Response body was consumed once.' });
      // 스트림은 상한을 넘는 순간 취소하므로 전체 크기를 알 수 없다 — 부분 누적치를 크기로
      // 보고하면 오해를 부르므로 null을 쓴다. 스트림이 없는 응답만 실측값을 보고한다.
      const actualBytes = hasResponseStream ? null : ((error.details?.actualBytes as number | undefined) ?? null);
      context.bytes = actualBytes;
      context.findings.push(buildSvgBytesExceededFinding(actualBytes, byteLimit));
      context.kind = 'unknown';
      return metadata.status;
    }
    throw error;
  }

  const svgString = body.text;
  context.consumed = true;
  context.findings.push({ code: 'body-consumed-once', message: 'Response body was consumed once.' });
  context.bytes = body.bytes;
  context.svgReport = inspectSvg(svgString);
  context.kind = context.mime === 'image/svg+xml' || context.svgReport.valid === true ? 'svg' : 'not-svg-source';

  return metadata.status;
}

function pushFetchFailureFinding(
  findings: InspectSvgSourceFinding[],
  error: unknown,
  signal: AbortSignal | undefined
): void {
  if (isAbortLikeError(error)) {
    const errorName = error instanceof Error ? error.name : '';
    const signalReason = signal?.aborted ? signal.reason : undefined;
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
    return;
  }

  findings.push({ code: 'fetch-failed', message: 'URL fetch failed.' });
}

export async function handleUrlSvgSourceFetch({
  source,
  mime: initialMime,
  extension,
  bytes: initialBytes,
  kind: initialKind,
  findings: initialFindings,
  options,
  byteLimit,
}: HandleUrlSvgSourceFetchParams): Promise<HandleUrlSvgSourceFetchResult> {
  const context: UrlFetchContext = {
    mime: initialMime,
    extension,
    bytes: initialBytes,
    kind: initialKind,
    findings: [...initialFindings],
    consumed: false,
    svgReport: null,
  };

  const href = source instanceof URL ? source.href : (source as string);
  const policyHref = normalizePolicyUrl(href);
  const fetchMode = options?.fetch ?? 'never';

  if (fetchMode === 'never') {
    applyDisabledFetchFindings(context, policyHref);
    return createFetchResult(context, { mode: 'never', performed: false, status: null });
  }

  if (applyProtocolPolicy(context, policyHref)) {
    return createFetchResult(context, { mode: fetchMode, performed: false, status: null });
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const handle = createFetchAbortHandle(timeoutMs, options?.signal);
  let responseStatus: number | null = null;
  let fetchAttempted = false;

  try {
    if (fetchMode === 'metadata') {
      fetchAttempted = true;
      responseStatus = await fetchUrlMetadata(policyHref, handle.signal, context, byteLimit);
      return createFetchResult(context, { mode: 'metadata', performed: true, status: responseStatus });
    }

    fetchAttempted = true;
    responseStatus = await fetchUrlBody(policyHref, handle.signal, context, byteLimit);
    return createFetchResult(context, { mode: 'body', performed: true, status: responseStatus });
  } catch (error) {
    pushFetchFailureFinding(context.findings, error, handle.signal);
    context.kind = 'unknown';
    return createFetchResult(context, { mode: fetchMode, performed: fetchAttempted, status: responseStatus });
  } finally {
    handle.dispose();
  }
}
