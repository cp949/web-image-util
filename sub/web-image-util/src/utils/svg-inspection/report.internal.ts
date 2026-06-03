/**
 * SVG 진단 리포트 조립 경계.
 *
 * orchestration(inspect-svg.ts)이 수집한 재료(environment/bytes/parse/root/
 * dimensions/complexity/findings)를 받아 `valid`와 `recommendation`을 계산하고
 * 최종 `InspectSvgReport`를 조립하는 순수 함수를 제공한다. 입력 검증, bytes 측정,
 * parser/analysis 호출 같은 orchestration은 이 모듈의 책임이 아니다.
 *
 * 이 모듈은 public export가 아니다(`package.json` exports 비대상).
 */

import type { ComplexityAnalysisResult } from '../../core/svg-complexity-analyzer';
import type { InspectSvgDimensions, InspectSvgFinding, InspectSvgFindingCode, InspectSvgReport } from '../inspect-svg';

/** 보안 finding 코드 목록 — 이 중 하나라도 있으면 strict sanitizer 추천 */
const SECURITY_FINDING_CODES = new Set<InspectSvgFindingCode>([
  'has-script-element',
  'has-foreign-object',
  'has-event-handler',
  'external-href',
  'style-attribute-external-url',
  'style-tag-external-url',
]);

/** valid=false를 유발하는 finding 코드 — 하나라도 있으면 보고서는 invalid. */
const INVALIDATING_FINDING_CODES = new Set<InspectSvgFindingCode>([
  'svg-bytes-exceeded',
  'svg-parse-failed',
  'not-svg-root',
]);

/**
 * finding 목록에서 sanitizer 추천을 도출한다.
 * 보안 finding이 하나라도 있으면 'strict', 없으면 'lightweight'.
 * reasons는 보안 코드 첫 등장 순서로 담되 중복은 제거한다.
 */
function deriveRecommendation(findings: InspectSvgFinding[]): InspectSvgReport['recommendation'] {
  const reasons: InspectSvgFindingCode[] = [];
  const seen = new Set<InspectSvgFindingCode>();

  for (const finding of findings) {
    if (SECURITY_FINDING_CODES.has(finding.code) && !seen.has(finding.code)) {
      reasons.push(finding.code);
      seen.add(finding.code);
    }
  }

  if (reasons.length > 0) {
    return { sanitizer: 'strict', reasons };
  }

  return { sanitizer: 'lightweight', reasons: [] };
}

/**
 * 수집된 재료로 최종 `InspectSvgReport`를 조립한다.
 *
 * `valid`는 svg-bytes-exceeded·svg-parse-failed·not-svg-root 중 하나라도 있으면 false다.
 * `recommendation`은 보안 finding 유무로 결정한다. findings는 입력 순서를 그대로 보존한다.
 */
export function assembleInspectReport(materials: {
  environment: InspectSvgReport['environment'];
  bytes: number;
  byteLimit: number;
  parse: InspectSvgReport['parse'];
  root: InspectSvgReport['root'];
  dimensions: InspectSvgDimensions | null;
  complexity: ComplexityAnalysisResult | null;
  findings: InspectSvgFinding[];
}): InspectSvgReport {
  const { environment, bytes, byteLimit, parse, root, dimensions, complexity, findings } = materials;

  const valid = !findings.some((f) => INVALIDATING_FINDING_CODES.has(f.code));

  return {
    valid,
    bytes,
    byteLimit,
    environment,
    parse,
    root,
    dimensions,
    complexity,
    findings,
    recommendation: deriveRecommendation(findings),
  };
}
