/**
 * SVG 파싱 경계 모듈 내부 타입.
 *
 * 이 타입들은 public export가 아니다(`package.json` exports 비대상).
 * `inspect-svg.ts`와 `parser.ts` 사이의 계약만 표현한다.
 */

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
