import { MAX_SVG_BYTES } from '../core/source-converter/options';
import { isBlockedSvgPolicyRef } from '../core/source-converter/url/policy';
import type { ComplexityAnalysisResult } from '../core/svg-complexity-analyzer';
import { analyzeSvgComplexity } from '../core/svg-complexity-analyzer';
import { ImageProcessError } from '../errors';
import { getCssPolicyValueVariants, visitCssUrlValues } from './svg-policy-utils';

export type InspectSvgFindingCode =
  | 'svg-bytes-exceeded'
  | 'svg-parse-failed'
  | 'not-svg-root'
  | 'has-script-element'
  | 'has-foreign-object'
  | 'has-event-handler'
  | 'external-href'
  | 'style-attribute-external-url'
  | 'style-tag-external-url'
  | 'dimensions-fallback'
  | 'complexity-analysis-failed';

export interface InspectSvgFinding {
  code: InspectSvgFindingCode;
  /** 영어 자연문. 호출자 분기 대상이 아니며 patch에서도 자유롭게 다듬을 수 있다. */
  message: string;
  /** 호출자 분기용 구조화 컨텍스트. 원본 텍스트(SVG 본문/Data URL/외부 URL)는 담지 않는다. */
  details?: Record<string, unknown>;
}

export interface InspectSvgDimensions {
  widthAttr: { raw: string | null; numeric: number | null; unit: string | null };
  heightAttr: { raw: string | null; numeric: number | null; unit: string | null };
  viewBox: { raw: string | null; parsed: { x: number; y: number; width: number; height: number } | null };
  effective: { width: number; height: number; source: 'explicit' | 'viewBox' | 'fallback' };
}

export interface InspectSvgReport {
  /** parse 실패, bytes 초과, 루트 부재 중 하나라도 있으면 false. */
  valid: boolean;
  bytes: number;
  byteLimit: number;
  environment: 'browser' | 'happy-dom' | 'node' | 'unknown';
  parse: { ok: boolean; message: string | null; locationAvailable: boolean };
  root: 'svg' | 'other' | 'none' | 'unknown';
  dimensions: InspectSvgDimensions | null;
  complexity: ComplexityAnalysisResult | null;
  findings: InspectSvgFinding[];
  recommendation: { sanitizer: 'lightweight' | 'strict'; reasons: InspectSvgFindingCode[] };
}

const DIM_ATTR_REGEX = /^(\d+(?:\.\d+)?)\s*([a-z%]*)$/;
const COMPLEXITY_FALLBACK_SENTINEL = 'Using default values due to analysis failure';

function parseAttrValue(raw: string | null): { raw: string | null; numeric: number | null; unit: string | null } {
  if (raw === null) {
    return { raw: null, numeric: null, unit: null };
  }
  const match = DIM_ATTR_REGEX.exec(raw);
  if (match) {
    return { raw, numeric: parseFloat(match[1]), unit: match[2] };
  }
  return { raw, numeric: null, unit: raw };
}

function readInspectDimensions(svgElement: Element): InspectSvgDimensions {
  const widthRaw = svgElement.getAttribute('width');
  const heightRaw = svgElement.getAttribute('height');
  const viewBoxRaw = svgElement.getAttribute('viewBox');

  const widthAttr = parseAttrValue(widthRaw);
  const heightAttr = parseAttrValue(heightRaw);

  let viewBoxParsed: { x: number; y: number; width: number; height: number } | null = null;
  if (viewBoxRaw !== null) {
    const parts = viewBoxRaw.trim().split(/\s+/);
    if (parts.length === 4) {
      const nums = parts.map(Number);
      if (nums.every((n) => !Number.isNaN(n))) {
        viewBoxParsed = { x: nums[0], y: nums[1], width: nums[2], height: nums[3] };
      }
    }
  }

  const viewBox: InspectSvgDimensions['viewBox'] = { raw: viewBoxRaw, parsed: viewBoxParsed };

  let effective: InspectSvgDimensions['effective'];
  if (widthAttr.numeric !== null && widthAttr.numeric > 0 && heightAttr.numeric !== null && heightAttr.numeric > 0) {
    effective = { width: widthAttr.numeric, height: heightAttr.numeric, source: 'explicit' };
  } else if (viewBoxParsed !== null) {
    effective = { width: viewBoxParsed.width, height: viewBoxParsed.height, source: 'viewBox' };
  } else {
    effective = { width: 100, height: 100, source: 'fallback' };
  }

  return { widthAttr, heightAttr, viewBox, effective };
}

function callComplexityWrapper(svgString: string): [ComplexityAnalysisResult | null, InspectSvgFinding[]] {
  const result = analyzeSvgComplexity(svgString);
  if (result.reasoning[0] === COMPLEXITY_FALLBACK_SENTINEL) {
    return [
      null,
      [
        {
          code: 'complexity-analysis-failed',
          message: 'SVG complexity analysis returned fallback values; result is unavailable.',
        },
      ],
    ];
  }
  return [result, []];
}

/** 현재 실행 환경을 감지한다. 평가 순서는 계획.md "환경 감지 규칙" 그대로. */
export function detectInspectEnvironment(): 'browser' | 'happy-dom' | 'node' | 'unknown' {
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

type ParseSvgFailure = { ok: false; message: string; locationAvailable: boolean; doc: null };
type ParseSvgSuccess = { ok: true; message: null; locationAvailable: false; doc: Document };

/** DOMParser로 SVG 문자열을 파싱하고 결과를 반환한다. */
function parseSvgWithDomParser(svgString: string): ParseSvgFailure | ParseSvgSuccess {
  if (typeof DOMParser === 'undefined') {
    return {
      ok: false,
      message: 'DOMParser is not available in this environment.',
      locationAvailable: false,
      doc: null,
    };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const parseError = doc.querySelector('parsererror');

  if (parseError !== null) {
    const textContent = parseError.textContent ?? '';
    const locationAvailable = /line\s*\d+/i.test(textContent) || /Line:\s*\d+/.test(textContent);
    return {
      ok: false,
      message: 'XML parser reported an error while parsing the input as image/svg+xml.',
      locationAvailable,
      doc: null,
    };
  }

  return { ok: true, message: null, locationAvailable: false, doc };
}

/**
 * 정규식으로 script/foreignObject/event-handler finding을 수집한다.
 * DOMParser 미가용 또는 파싱 실패 경로에서만 호출한다.
 */
function collectRegexFindings(svgString: string): InspectSvgFinding[] {
  const findings: InspectSvgFinding[] = [];

  // script 요소 카운트
  const scriptCount = (svgString.match(/<script\b[^>]*>/gi) ?? []).length;
  if (scriptCount > 0) {
    findings.push({
      code: 'has-script-element',
      message: 'Input contains <script> element(s); strict sanitizer is recommended.',
      details: { count: scriptCount },
    });
  }

  // foreignObject 요소 카운트
  const foreignObjectCount = (svgString.match(/<foreignObject\b[^>]*>/gi) ?? []).length;
  if (foreignObjectCount > 0) {
    findings.push({
      code: 'has-foreign-object',
      message: 'Input contains <foreignObject> element(s); strict sanitizer is recommended.',
      details: { count: foreignObjectCount },
    });
  }

  // 시작 태그를 순회하며 event handler attribute 카운트
  let eventHandlerCount = 0;
  for (const tagMatch of svgString.matchAll(/<[a-zA-Z][^>]*>/g)) {
    // 태그명 이후 attribute 영역 추출
    const attrArea = tagMatch[0].replace(/^<[a-zA-Z][a-zA-Z0-9_:-]*/, '');
    eventHandlerCount += (attrArea.match(/\son[a-z0-9:-]*\s*=/gi) ?? []).length;
  }
  if (eventHandlerCount > 0) {
    findings.push({
      code: 'has-event-handler',
      message: 'Input contains on* event handler attribute(s); strict sanitizer is recommended.',
      details: { count: eventHandlerCount },
    });
  }

  return findings;
}

/** 보안 finding 코드 목록 — 이 중 하나라도 있으면 strict sanitizer 추천 */
const SECURITY_FINDING_CODES = new Set<InspectSvgFindingCode>([
  'has-script-element',
  'has-foreign-object',
  'has-event-handler',
  'external-href',
  'style-attribute-external-url',
  'style-tag-external-url',
]);

/** on* 이벤트 핸들러 attribute 이름 패턴 */
const EVENT_HANDLER_ATTR_REGEX = /^on[a-z0-9:-]+$/i;

/**
 * DOM 기반으로 보안 finding을 수집한다.
 * DOMParser 파싱 성공 + svg 루트 경로에서만 호출한다.
 */
function collectDomFindings(doc: Document): InspectSvgFinding[] {
  const findings: InspectSvgFinding[] = [];

  // <script> 요소 검사
  const scriptCount = doc.getElementsByTagName('script').length;
  if (scriptCount > 0) {
    findings.push({
      code: 'has-script-element',
      message: 'Input contains <script> element(s); strict sanitizer is recommended.',
      details: { count: scriptCount },
    });
  }

  // <foreignObject> 요소 검사
  const foreignObjectCount = doc.getElementsByTagName('foreignObject').length;
  if (foreignObjectCount > 0) {
    findings.push({
      code: 'has-foreign-object',
      message: 'Input contains <foreignObject> element(s); strict sanitizer is recommended.',
      details: { count: foreignObjectCount },
    });
  }

  // 모든 element 순회
  const allElements = doc.getElementsByTagName('*');
  let eventHandlerCount = 0;
  let externalHrefCount = 0;
  let styleAttrExternalUrlCount = 0;

  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    if (!el) continue;

    // on* 이벤트 핸들러 attribute 검사
    for (const attrName of el.getAttributeNames()) {
      if (EVENT_HANDLER_ATTR_REGEX.test(attrName)) {
        eventHandlerCount++;
      }
    }

    // external href/xlink:href/src 검사
    const hrefCandidates = [
      el.getAttribute('href'),
      el.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ?? el.getAttribute('xlink:href'),
      el.getAttribute('src'),
    ];
    for (const val of hrefCandidates) {
      if (val !== null && getCssPolicyValueVariants(val).some(isBlockedSvgPolicyRef)) {
        externalHrefCount++;
        break; // element당 한 번만 카운트
      }
    }

    // style attribute 내부 url() 검사
    const styleAttr = el.getAttribute('style');
    if (styleAttr) {
      visitCssUrlValues(styleAttr, (urlValue) => {
        if (getCssPolicyValueVariants(urlValue).some(isBlockedSvgPolicyRef)) {
          styleAttrExternalUrlCount++;
        }
      });
    }
  }

  if (eventHandlerCount > 0) {
    findings.push({
      code: 'has-event-handler',
      message: 'Input contains on* event handler attribute(s); strict sanitizer is recommended.',
      details: { count: eventHandlerCount },
    });
  }

  if (externalHrefCount > 0) {
    findings.push({
      code: 'external-href',
      message: 'Input contains element(s) with external href/src references; strict sanitizer is recommended.',
      details: { count: externalHrefCount },
    });
  }

  if (styleAttrExternalUrlCount > 0) {
    findings.push({
      code: 'style-attribute-external-url',
      message: 'Input contains style attribute(s) with external url() references; strict sanitizer is recommended.',
      details: { count: styleAttrExternalUrlCount },
    });
  }

  // <style> 태그 내부 url() 검사
  const styleTags = doc.getElementsByTagName('style');
  let styleTagExternalUrlCount = 0;
  for (let i = 0; i < styleTags.length; i++) {
    const styleEl = styleTags[i];
    if (!styleEl) continue;
    const cssText = styleEl.textContent ?? '';
    visitCssUrlValues(cssText, (urlValue) => {
      if (getCssPolicyValueVariants(urlValue).some(isBlockedSvgPolicyRef)) {
        styleTagExternalUrlCount++;
      }
    });
  }

  if (styleTagExternalUrlCount > 0) {
    findings.push({
      code: 'style-tag-external-url',
      message: 'Input contains <style> tag(s) with external url() references; strict sanitizer is recommended.',
      details: { count: styleTagExternalUrlCount },
    });
  }

  return findings;
}

/**
 * finding 목록에서 sanitizer 추천을 도출한다.
 * 보안 finding이 하나라도 있으면 'strict', 없으면 'lightweight'.
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
    return {
      valid: false,
      bytes,
      byteLimit: MAX_SVG_BYTES,
      environment,
      parse: { ok: false, message: null, locationAvailable: false },
      root: 'unknown',
      dimensions: null,
      complexity: null,
      findings,
      recommendation: { sanitizer: 'lightweight', reasons: [] },
    };
  }

  // DOMParser 파싱
  const parseResult = parseSvgWithDomParser(svgString);
  const findings: InspectSvgFinding[] = [];
  let root: InspectSvgReport['root'] = 'unknown';
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
  } else {
    // 파싱 성공: 루트 요소 검사
    const docEl = parseResult.doc.documentElement;
    if (docEl == null) {
      root = 'none';
    } else {
      const tagLower = docEl.tagName.toLowerCase();
      if (tagLower === 'svg') {
        root = 'svg';
        dimensions = readInspectDimensions(docEl);
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
      } else {
        root = 'other';
        findings.push({
          code: 'not-svg-root',
          message: 'Parsed XML root element is not <svg>.',
          details: { rootTagName: tagLower },
        });
      }
    }
  }

  // svg-bytes-exceeded·svg-parse-failed·not-svg-root 중 하나라도 있으면 valid = false
  const valid = !findings.some(
    (f) => f.code === 'svg-bytes-exceeded' || f.code === 'svg-parse-failed' || f.code === 'not-svg-root'
  );

  return {
    valid,
    bytes,
    byteLimit: MAX_SVG_BYTES,
    environment,
    parse: {
      ok: parseResult.ok,
      message: parseResult.message,
      locationAvailable: parseResult.locationAvailable,
    },
    root,
    dimensions,
    complexity,
    findings,
    recommendation: deriveRecommendation(findings),
  };
}
