import { DEFAULT_ALLOWED_PROTOCOLS, DEFAULT_FETCH_TIMEOUT_MS } from '../../core/source-converter/options.internal';
import { checkResponseSize, createFetchAbortHandle } from '../../core/source-converter/url/fetch-guards.internal';
import {
  checkAllowedProtocol,
  isAbortLikeError,
  normalizePolicyUrl,
} from '../../core/source-converter/url/policy.internal';
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

const textEncoder = new TextEncoder();

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
    checkResponseSize(response, byteLimit, 'inspect-svg-source body');
  } catch {
    context.findings.push({
      code: 'byte-limit-exceeded',
      message: `Response Content-Length exceeds byte limit (${byteLimit} bytes).`,
      details: { byteLimit },
    });
    context.kind = 'unknown';
    return metadata.status;
  }

  const svgString = await response.text();
  context.consumed = true;
  context.findings.push({ code: 'body-consumed-once', message: 'Response body was consumed once via .text().' });

  if (context.bytes === null) {
    context.bytes = textEncoder.encode(svgString).byteLength;
  }

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
