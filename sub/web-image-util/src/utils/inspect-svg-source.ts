import { MAX_SVG_BYTES } from '../core/source-converter/options.internal';
import { detectSvgInspectionEnvironment } from './environment.internal';
import type { InspectSvgReport } from './inspect-svg';
import { inspectSvg } from './inspect-svg';
import { extractSvgBody } from './inspect-svg-source/body-extraction.internal';
import { handleUrlSvgSourceFetch } from './inspect-svg-source/fetch-source.internal';
import { detectMimeAndExtension } from './inspect-svg-source/mime-extension.internal';
import { deduplicateFindings, maskSourceUrl } from './inspect-svg-source/report-utils.internal';
import { decideSvgFromSniff } from './inspect-svg-source/sniff-decision.internal';
import { detectOriginalKind, estimateSourceBytes } from './inspect-svg-source/source-kind.internal';
import type {
  InspectSvgSourceFetchInfo,
  InspectSvgSourceInput,
  InspectSvgSourceOptions,
  InspectSvgSourceReport,
} from './inspect-svg-source/types.internal';
import { assertInspectSvgSourceInput, assertInspectSvgSourceOptions } from './inspect-svg-source/validation.internal';

// 공개 타입의 정의는 스택의 타입 leaf(inspect-svg-source/types.internal.ts)에 있다.
// 이 재export가 공개 표면(utils/index.ts 경유)을 그대로 유지한다.
export type {
  InspectSvgSourceFetchInfo,
  InspectSvgSourceFetchMode,
  InspectSvgSourceFinding,
  InspectSvgSourceFindingCode,
  InspectSvgSourceInput,
  InspectSvgSourceKind,
  InspectSvgSourceMeta,
  InspectSvgSourceOptions,
  InspectSvgSourceReport,
} from './inspect-svg-source/types.internal';

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
  assertInspectSvgSourceInput(source);

  // options 검증 (D13)
  assertInspectSvgSourceOptions(options);

  const originalKind = detectOriginalKind(source);
  const environment = detectSvgInspectionEnvironment();

  let { mime, extension } = detectMimeAndExtension(source, originalKind);

  // bytes 추정: Blob/File은 .size 사용, 문자열은 UTF-8 바이트 수 계산, URL은 null.
  let bytes: number | null = estimateSourceBytes(source, originalKind);

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
    const fetchResult = await handleUrlSvgSourceFetch({
      source,
      mime,
      extension,
      bytes,
      kind,
      findings,
      options,
      byteLimit: effectiveByteLimit,
    });

    mime = fetchResult.mime;
    extension = fetchResult.extension;
    bytes = fetchResult.bytes;
    kind = fetchResult.kind;
    findings = fetchResult.findings;
    consumed = fetchResult.consumed;
    fetchInfo = fetchResult.fetchInfo;
    svgReport = fetchResult.svgReport;
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
