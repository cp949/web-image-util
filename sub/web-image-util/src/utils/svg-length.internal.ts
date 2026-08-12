/**
 * SVG 길이 값 파싱 프리미티브.
 *
 * @description "SVG 속성 문자열을 숫자로 어떻게 읽는가"라는 저수준 판정만 담는다.
 * 부호, 소수, 지수 표기, 단위 접미사, viewBox의 콤마 구분자를 이 모듈 한 곳이 안다.
 *
 * 소비자(`extractSvgDimensions` / `readInspectDimensions` / `applyViewBoxPolicy`)는
 * 반환 형태와 상위 정책(0 이하 처리, 폴백 크기, 진단용 raw 보존)을 각자 유지한다.
 * 이 모듈은 정책을 갖지 않는다.
 *
 * 이 모듈은 public export가 아니다(`package.json` exports 비대상).
 */

/** 길이 값 1개의 파싱 결과. */
export interface SvgLength {
  /** 부호·소수·지수를 반영한 유한 숫자. 파싱 실패 시 null */
  value: number | null;
  /** 소문자로 정규화한 단위(`px`, `%`, `em` 등). 단위가 없거나 파싱 실패 시 null */
  unit: string | null;
}

/** viewBox 속성의 네 값. */
export interface SvgViewBoxValues {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * SVG/CSS 숫자 토큰 문법.
 *
 * @description 10진수만 받아 `Number()`의 16진수 허용을 차단한다.
 * 양음 부호, 선행 0이 없는 소수, 지수 표기를 포함한다.
 */
const SVG_NUMBER_SOURCE = String.raw`[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?`;

/** 길이 문자열 전체 매칭 패턴. 숫자와 단위 사이 공백은 기존 진단 계약을 위해 유지한다. */
const SVG_LENGTH_PATTERN = new RegExp(String.raw`^(${SVG_NUMBER_SOURCE})(\s*)([a-z%]*)$`, 'i');

/** viewBox의 네 숫자와 단일 콤마/공백 구분자를 검증하는 전체 패턴. */
const VIEW_BOX_SEPARATOR_SOURCE = String.raw`(?:\s*,\s*|\s+)`;
const VIEW_BOX_PATTERN = new RegExp(
  String.raw`^\s*(${SVG_NUMBER_SOURCE})${VIEW_BOX_SEPARATOR_SOURCE}(${SVG_NUMBER_SOURCE})${VIEW_BOX_SEPARATOR_SOURCE}(${SVG_NUMBER_SOURCE})${VIEW_BOX_SEPARATOR_SOURCE}(${SVG_NUMBER_SOURCE})\s*$`,
  'i'
);

/**
 * SVG 길이 속성 값을 숫자와 단위로 분리한다.
 *
 * @description 단위가 없으면 SVG user unit으로 간주해 `unit`을 null로 돌려준다.
 * 형식이 맞지 않거나 결과가 유한값이 아니면(`"1e999"`) `value`·`unit` 모두 null이다.
 *
 * @param input 길이 문자열(예: `"100"`, `"100px"`, `"50%"`, `"-1.5e-3"`)
 * @returns 숫자와 단위 쌍. 파싱 실패 시 둘 다 null
 */
export function parseSvgLength(input?: string | null): SvgLength {
  if (!input) return { value: null, unit: null };

  const matched = SVG_LENGTH_PATTERN.exec(String(input).trim());
  if (!matched) return { value: null, unit: null };

  const value = Number(matched[1]);
  // 지수 표기가 오버플로하면 Infinity가 나오므로 유한값만 통과시킨다.
  if (!Number.isFinite(value)) return { value: null, unit: null };

  return { value, unit: matched[3] ? matched[3].toLowerCase() : null };
}

/**
 * 유효한 SVG 길이에서 숫자와 단위 사이 공백이 있는지 확인한다.
 *
 * @description `parseSvgLength`와 같은 패턴을 사용해 문법 판정이 소비자로 복제되지 않게 한다.
 */
export function hasWhitespaceBeforeSvgLengthUnit(input?: string | null): boolean {
  if (!input) return false;

  const matched = SVG_LENGTH_PATTERN.exec(String(input).trim());
  return Boolean(matched?.[2] && matched[3]);
}

/**
 * viewBox 속성 값을 네 숫자로 파싱한다.
 *
 * @description 앞뒤 공백을 제거하고 공백·콤마 혼용 구분자를 모두 받는다.
 * 값이 정확히 4개가 아니거나 하나라도 유한값이 아니면 null을 돌려준다.
 * 폭·높이가 0 이하인지 같은 판정은 소비자 정책이므로 여기서 하지 않는다.
 *
 * @param input viewBox 속성 값(예: `"0 0 100 100"`, `"0,0,100,100"`)
 * @returns 파싱된 네 값, 실패 시 null
 */
export function parseViewBoxValues(input?: string | null): SvgViewBoxValues | null {
  if (!input) return null;

  const matched = VIEW_BOX_PATTERN.exec(input);
  if (!matched) return null;

  const values = matched.slice(1).map(Number);
  if (!values.every((value) => Number.isFinite(value))) return null;

  return { x: values[0], y: values[1], width: values[2], height: values[3] };
}
