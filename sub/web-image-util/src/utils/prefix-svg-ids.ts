import { MAX_SVG_BYTES } from '../core/source-converter/options.internal';
import { ImageProcessError } from '../errors.internal';
import { detectSvgInspectionEnvironment } from './environment.internal';
import { detectStyleDeoptReasons, parseSvgDocument, serializeSvgDocument } from './prefix-svg-ids/dom-utils.internal';
import { applyIdRewrites, collectIdElements, planIdRewrites } from './prefix-svg-ids/id-rewrite.internal';
import { rewriteFragmentReferences } from './prefix-svg-ids/reference-rewrite.internal';
import { buildDeoptResult, buildPrefixWarnings } from './prefix-svg-ids/report-utils.internal';

/** rewrite를 보류한 사유. 같은 호출에서 여러 사유가 중복 누적될 수 있다. */
export type SvgIdPrefixDeoptReason =
  | 'byte-limit-exceeded'
  | 'parse-failed'
  | 'domparser-unavailable'
  | 'style-tag-present'
  | 'style-attribute-present';

/** rewrite를 부분적으로 생략한 사유. 정상 경로에서만 등장한다(deopt 경로에서는 빈 배열). */
export type SvgIdPrefixWarningCode =
  | 'id-rewrite-skipped-idempotent'
  | 'id-rewrite-skipped-collision'
  | 'reference-skipped-dangling'
  | 'reference-skipped-external';

export interface SvgIdPrefixWarning {
  code: SvgIdPrefixWarningCode;
  /** 발생 횟수. count > 0 일 때만 warnings 배열에 포함된다. */
  count: number;
}

export interface SvgIdPrefixReport {
  /** style/parse 실패/byte 초과로 rewrite를 보류했는지. true면 svg는 입력 원본 그대로. */
  deoptimized: boolean;
  /** deoptimized=true일 때 사유 배열. false일 때 빈 배열. */
  deoptReasons: SvgIdPrefixDeoptReason[];
  /** 입력 UTF-8 byte 수. */
  bytes: number;
  /** byte 한도(`MAX_SVG_BYTES`). */
  byteLimit: number;
  /** 실행 환경 표시. inspectSvg의 environment와 동일 규칙. */
  environment: 'browser' | 'happy-dom' | 'node' | 'unknown';
  /** prefix 접두를 실제로 붙인 id 개수(idempotent/collision 생략 제외). */
  prefixedIdCount: number;
  /** rewrite한 fragment reference 개수(dangling/external 생략 제외). */
  rewrittenReferenceCount: number;
  /** structured warning 목록. 각 code는 최대 1개. */
  warnings: SvgIdPrefixWarning[];
}

export interface SvgIdPrefixResult {
  /** 정상 경로: prefix가 적용된 svg. deopt 경로: 입력 원본 svg. */
  svg: string;
  report: SvgIdPrefixReport;
}

/** prefix 허용 패턴. XML id / CSS selector / URL fragment 세 표준의 교집합(D1). */
const PREFIX_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

/** 텍스트인코더 싱글턴 — UTF-8 바이트 측정에 사용한다. */
const encoder = new TextEncoder();

type PrefixEnvironment = SvgIdPrefixReport['environment'];

interface PreparedPrefixRewrite {
  bytes: number;
  environment: PrefixEnvironment;
  doc: Document;
}

interface PrefixRewriteCounts {
  prefixedIdCount: number;
  rewrittenReferenceCount: number;
  danglingCount: number;
  externalCount: number;
  idempotentCount: number;
  collisionCount: number;
}

function assertSvgString(svgString: unknown): asserts svgString is string {
  if (typeof svgString !== 'string') {
    const actualType = svgString === null ? 'null' : typeof svgString;
    throw new ImageProcessError(
      `prefixSvgIds expects a string svgString, but received ${actualType}.`,
      'SVG_INPUT_INVALID',
      {
        details: { actualType },
      }
    );
  }
}

function assertPrefix(prefix: unknown): asserts prefix is string {
  if (typeof prefix !== 'string') {
    const actualType = prefix === null ? 'null' : typeof prefix;
    throw new ImageProcessError(`prefixSvgIds expects a string prefix, but received ${actualType}.`, 'OPTION_INVALID', {
      details: { option: 'prefix', actualType },
    });
  }

  if (!PREFIX_PATTERN.test(prefix)) {
    throw new ImageProcessError('prefixSvgIds prefix must match /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.', 'OPTION_INVALID', {
      details: { option: 'prefix', reason: 'invalid-format' },
    });
  }
}

function preparePrefixRewrite(svgString: string): PreparedPrefixRewrite | SvgIdPrefixResult {
  const bytes = encoder.encode(svgString).byteLength;
  const environment = detectSvgInspectionEnvironment();

  if (bytes > MAX_SVG_BYTES) {
    return buildDeoptResult(svgString, bytes, environment, ['byte-limit-exceeded']);
  }

  const parseResult = parseSvgDocument(svgString);
  if ('failure' in parseResult) {
    return buildDeoptResult(svgString, bytes, environment, [parseResult.failure]);
  }

  const styleReasons = detectStyleDeoptReasons(parseResult);
  if (styleReasons.length > 0) {
    return buildDeoptResult(svgString, bytes, environment, styleReasons);
  }

  return { bytes, environment, doc: parseResult };
}

function isPrefixResult(value: PreparedPrefixRewrite | SvgIdPrefixResult): value is SvgIdPrefixResult {
  return 'svg' in value;
}

function collectOriginalIdSet(elements: Element[]): Set<string> {
  return new Set(elements.map((el) => el.getAttribute('id')).filter((id): id is string => id !== null && id !== ''));
}

function applyPrefixRewrite(doc: Document, prefix: string): PrefixRewriteCounts {
  const elements = collectIdElements(doc);
  const originalIdSet = collectOriginalIdSet(elements);
  const { rewrites, warnings: rewriteWarnings } = planIdRewrites(elements, prefix);
  const prefixedIdCount = applyIdRewrites(elements, rewrites);
  const { rewrittenCount, danglingCount, externalCount } = rewriteFragmentReferences(doc, rewrites, originalIdSet);

  return {
    prefixedIdCount,
    rewrittenReferenceCount: rewrittenCount,
    danglingCount,
    externalCount,
    idempotentCount: rewriteWarnings.idempotent,
    collisionCount: rewriteWarnings.collision,
  };
}

function buildPrefixResult(
  svg: string,
  bytes: number,
  environment: PrefixEnvironment,
  counts: PrefixRewriteCounts
): SvgIdPrefixResult {
  return {
    svg,
    report: {
      deoptimized: false,
      deoptReasons: [],
      bytes,
      byteLimit: MAX_SVG_BYTES,
      environment,
      prefixedIdCount: counts.prefixedIdCount,
      rewrittenReferenceCount: counts.rewrittenReferenceCount,
      warnings: buildPrefixWarnings({
        idempotent: counts.idempotentCount,
        collision: counts.collisionCount,
        dangling: counts.danglingCount,
        external: counts.externalCount,
      }),
    },
  };
}

/**
 * SVG 문자열의 모든 `[id]` 요소에 prefix를 붙이고 같은 문서 안의 attribute fragment reference만 rewrite한다.
 *
 * 신뢰할 수 없는 SVG는 먼저 `sanitizeSvgStrict()`로 정제한 뒤 본 함수를 호출한다.
 * 본 함수는 sanitizer가 아니며 보안 경계가 되지 않는다.
 *
 * `<style>` 요소 또는 `style` 속성이 있는 입력은 rewrite를 전면 보류하고 입력 svg를 그대로 반환한다.
 * CSS 내부 `url(#id)` rewrite는 본 함수 비범위다.
 *
 * @throws {ImageProcessError} code=`SVG_INPUT_INVALID` — svgString이 string이 아님.
 * @throws {ImageProcessError} code=`OPTION_INVALID` — prefix가 string이 아니거나 허용 패턴(D1)을 위반.
 */
export function prefixSvgIds(svgString: string, prefix: string): SvgIdPrefixResult {
  assertSvgString(svgString);
  assertPrefix(prefix);

  const prepared = preparePrefixRewrite(svgString);
  if (isPrefixResult(prepared)) return prepared;

  const counts = applyPrefixRewrite(prepared.doc, prefix);
  const serialized = serializeSvgDocument(prepared.doc);

  if (serialized === null) {
    return buildDeoptResult(svgString, prepared.bytes, prepared.environment, ['parse-failed']);
  }

  return buildPrefixResult(serialized, prepared.bytes, prepared.environment, counts);
}
