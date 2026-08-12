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
 * 길이 문자열 전체 매칭 패턴.
 *
 * - `-?` 음수 허용
 * - `(?:\.\d+)?` 소수 허용
 * - `(?:e[+-]?\d+)?` 지수 표기 허용(대소문자 무관)
 * - `\s*` 숫자와 단위 사이 공백 허용(`"100 px"`)
 * - `([a-z%]*)` 단위는 알파벳과 `%`만 허용
 */
const SVG_LENGTH_PATTERN = /^(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*([a-z%]*)$/i;

/** viewBox 값 구분자. 공백과 콤마를 모두 받는다(`"0,0,100,100"`). */
const VIEW_BOX_SEPARATOR = /[\s,]+/;

/** viewBox가 가져야 하는 값 개수(min-x, min-y, width, height). */
const VIEW_BOX_VALUE_COUNT = 4;

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

  return { value, unit: matched[2] ? matched[2].toLowerCase() : null };
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

  const parts = input.trim().split(VIEW_BOX_SEPARATOR);
  if (parts.length !== VIEW_BOX_VALUE_COUNT) return null;

  const values = parts.map(Number);
  if (!values.every((value) => Number.isFinite(value))) return null;

  return { x: values[0], y: values[1], width: values[2], height: values[3] };
}
