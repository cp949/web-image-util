import { MAX_SVG_BYTES } from '../core/source-converter/options.internal';
import type { ComplexityAnalysisResult } from '../core/svg-complexity-analyzer';
import { ImageProcessError } from '../errors.internal';
import { detectSvgInspectionEnvironment } from './svg-inspection';
import {
  callComplexityWrapper,
  collectDomFindings,
  readInspectDimensions,
} from './svg-inspection/dom-analysis.internal';
import { collectRegexFindings } from './svg-inspection/fallback-analysis.internal';
import { parseAndClassifySvg } from './svg-inspection/parser.internal';
import { assembleInspectReport } from './svg-inspection/report.internal';
import type { InspectSvgDimensions, InspectSvgFinding, InspectSvgReport } from './svg-inspection/types.internal';

// 공개 타입의 정의는 스택의 타입 leaf(svg-inspection/types.internal.ts)에 있다.
// 이 재export가 공개 표면(utils/index.ts 경유)을 그대로 유지한다.
export type {
  InspectSvgDimensions,
  InspectSvgFinding,
  InspectSvgFindingCode,
  InspectSvgReport,
} from './svg-inspection/types.internal';

/** 현재 실행 환경을 감지한다. 평가 순서는 happy-dom -> browser -> node -> unknown이다. */
export function detectInspectEnvironment(): 'browser' | 'happy-dom' | 'node' | 'unknown' {
  return detectSvgInspectionEnvironment();
}

/**
 * SVG 문자열을 부수효과 없이 진단해 리포트를 반환한다.
 *
 * 네트워크, sanitizer 실행, Canvas 렌더링을 수행하지 않는다.
 * 비문자열 입력에만 throw하며, 그 외 모든 케이스는 finding으로 답한다.
 *
 * @throws {ImageProcessError} code=`SVG_INPUT_INVALID`, details=`{ actualType }` — input is not a string.
 */
export function inspectSvg(svgString: unknown): InspectSvgReport {
  // 비문자열 입력 검증
  if (typeof svgString !== 'string') {
    const actualType = svgString === null ? 'null' : typeof svgString;
    throw new ImageProcessError(`inspectSvg expects a string input, but received ${actualType}.`, 'SVG_INPUT_INVALID', {
      details: { actualType },
    });
  }

  const environment = detectInspectEnvironment();

  // UTF-8 바이트 측정
  const bytes = new TextEncoder().encode(svgString).length;

  // 바이트 초과 찾기
  if (bytes > MAX_SVG_BYTES) {
    const findings: InspectSvgFinding[] = [
      {
        code: 'svg-bytes-exceeded',
        message: 'SVG input size exceeds the configured byte limit.',
        details: { actualBytes: bytes, maxBytes: MAX_SVG_BYTES },
      },
    ];
    // byte 초과 경로도 동일 조립 함수를 사용한다. svg-bytes-exceeded는 invalidating
    // 코드이므로 valid=false, 보안 코드가 아니므로 recommendation은 lightweight가 된다.
    return assembleInspectReport({
      environment,
      bytes,
      byteLimit: MAX_SVG_BYTES,
      parse: { ok: false, message: null, locationAvailable: false },
      root: 'unknown',
      dimensions: null,
      complexity: null,
      findings,
    });
  }

  // DOMParser 파싱 + 루트 판정은 parser 경계가 캡슐화한다.
  const parseResult = parseAndClassifySvg(svgString);
  const findings: InspectSvgFinding[] = [];
  const root: InspectSvgReport['root'] = parseResult.root;
  let dimensions: InspectSvgDimensions | null = null;
  let complexity: ComplexityAnalysisResult | null = null;

  if (!parseResult.ok) {
    // 파싱 실패 finding 추가
    findings.push({
      code: 'svg-parse-failed',
      message: 'The input could not be parsed as image/svg+xml.',
      details: { environment },
    });
    // 파싱 실패 경로에서 정규식 기반 finding 수집
    findings.push(...collectRegexFindings(svgString));
  } else if (root === 'svg' && parseResult.svgElement !== null) {
    // 파싱 성공 + svg 루트: dimension 읽기·finding 수집은 호출부 책임.
    dimensions = readInspectDimensions(parseResult.svgElement);
    if (dimensions.effective.source === 'fallback') {
      findings.push({
        code: 'dimensions-fallback',
        message: 'SVG has no usable width/height or viewBox; defaulting to 100×100.',
        details: { width: 100, height: 100 },
      });
    }
    const [complexityResult, complexityFindings] = callComplexityWrapper(svgString);
    complexity = complexityResult;
    findings.push(...complexityFindings);
    // DOM 기반 보안 finding 수집 (파싱 성공 + svg 루트 경로에서만)
    findings.push(...collectDomFindings(parseResult.doc));
  } else if (root === 'other') {
    findings.push({
      code: 'not-svg-root',
      message: 'Parsed XML root element is not <svg>.',
      // root tag 이름은 입력 원문이므로 report details에 반사하지 않는다.
      details: { rootTagName: 'non-svg-root' },
    });
  }
  // root === 'none' 경로는 finding을 추가하지 않는다(기존 동작 유지).

  // valid·recommendation 계산과 최종 객체 조립은 report 경계가 담당한다.
  return assembleInspectReport({
    environment,
    bytes,
    byteLimit: MAX_SVG_BYTES,
    parse: {
      ok: parseResult.ok,
      message: parseResult.message,
      locationAvailable: parseResult.locationAvailable,
    },
    root,
    dimensions,
    complexity,
    findings,
  });
}
