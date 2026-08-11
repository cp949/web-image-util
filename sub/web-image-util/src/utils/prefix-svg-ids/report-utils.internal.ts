import { MAX_SVG_BYTES } from '../../core/source-converter/options.internal';
import type { SvgIdPrefixDeoptReason, SvgIdPrefixResult, SvgIdPrefixWarning } from './types.internal';

/** prefixSvgIds 실행 환경 표시. report.environment와 동일 규칙. */
type PrefixEnvironment = 'browser' | 'happy-dom' | 'node' | 'unknown';

/** 정상 경로의 생략 count 모음. 각 count는 0 이상이며 0이면 warnings에 포함하지 않는다. */
export interface PrefixWarningCounts {
  idempotent: number;
  collision: number;
  dangling: number;
  external: number;
}

/**
 * 생략 count를 `SvgIdPrefixWarning[]`로 조립한다. count > 0인 항목만 포함하며
 * 순서는 idempotent → collision → dangling → external이다.
 */
export function buildPrefixWarnings(counts: PrefixWarningCounts): SvgIdPrefixWarning[] {
  const warnings: SvgIdPrefixWarning[] = [];
  if (counts.idempotent > 0) {
    warnings.push({ code: 'id-rewrite-skipped-idempotent', count: counts.idempotent });
  }
  if (counts.collision > 0) {
    warnings.push({ code: 'id-rewrite-skipped-collision', count: counts.collision });
  }
  if (counts.dangling > 0) {
    warnings.push({ code: 'reference-skipped-dangling', count: counts.dangling });
  }
  if (counts.external > 0) {
    warnings.push({ code: 'reference-skipped-external', count: counts.external });
  }
  return warnings;
}

/** deopt 응답을 일관된 shape으로 생성한다. */
export function buildDeoptResult(
  svgString: string,
  bytes: number,
  environment: PrefixEnvironment,
  deoptReasons: SvgIdPrefixDeoptReason[]
): SvgIdPrefixResult {
  return {
    svg: svgString,
    report: {
      deoptimized: true,
      deoptReasons,
      bytes,
      byteLimit: MAX_SVG_BYTES,
      environment,
      prefixedIdCount: 0,
      rewrittenReferenceCount: 0,
      warnings: [],
    },
  };
}
