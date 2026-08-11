/**
 * SVG 검사 스택의 타입 leaf.
 *
 * inspectSvg 공개 타입(FindingCode/Finding/Dimensions/Report)의 정의 지점이다 —
 * 파일 자체는 공개 경로가 아니며, 공개는 `inspect-svg.ts`의 재export를 경유한다.
 * 나머지 Parse* 타입은 `inspect-svg.ts`와 `parser.internal.ts` 사이의 내부 계약이다.
 */

import type { ComplexityAnalysisResult } from '../../core/svg-complexity-analyzer';
import type { RuntimeEnvironment } from '../environment.internal';

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
  environment: RuntimeEnvironment;
  parse: { ok: boolean; message: string | null; locationAvailable: boolean };
  root: 'svg' | 'other' | 'none' | 'unknown';
  dimensions: InspectSvgDimensions | null;
  complexity: ComplexityAnalysisResult | null;
  findings: InspectSvgFinding[];
  recommendation: { sanitizer: 'lightweight' | 'strict'; reasons: InspectSvgFindingCode[] };
}

/** DOMParser 파싱 실패 결과. */
export type ParseSvgFailure = {
  ok: false;
  message: string;
  locationAvailable: boolean;
  doc: null;
};

/** DOMParser 파싱 성공 결과. */
export type ParseSvgSuccess = {
  ok: true;
  message: null;
  locationAvailable: false;
  doc: Document;
};

/** 파싱 성공 후 루트 요소를 판정한 결과. */
export type ParsedSvgRoot = 'svg' | 'other' | 'none' | 'unknown';

/**
 * parser.ts가 호출부에 넘기는 통합 결과.
 *
 * dimension 읽기·finding 수집은 parser 책임 밖이므로 root가 'svg'일 때만
 * `svgElement`(documentElement)를 함께 넘겨 호출부가 후속 분석을 하게 한다.
 */
export type InspectParseResult =
  | (ParseSvgFailure & { root: 'unknown'; svgElement: null })
  | (ParseSvgSuccess & { root: ParsedSvgRoot; svgElement: Element | null });
