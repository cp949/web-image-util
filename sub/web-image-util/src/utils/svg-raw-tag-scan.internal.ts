/**
 * 파싱 전 SVG 원문(raw string)에서 시작 태그와 속성값을 찾아내는 순회 로직의
 * 단일 소유자다.
 *
 * lightweight 엔진(`svg-sanitizer.ts`)과 intake guard(`safety.internal.ts`)가
 * 이 모듈을 공유한다 — 둘 다 DOM 파싱 없이 정규식으로 SVG 원문을 훑어야 하므로
 * 같은 순회 로직이 필요하지만, 손으로 각자 짜면 갈릴 수 있다(예: 어떤 속성
 * 이름 집합을 대상으로 볼지가 두 소비자 사이에서 벌어짐). 이 모듈은 "태그를
 * 어떻게 찾고 속성값을 어떻게 뽑아내는가"만 담당하며, 어떤 속성이 위험한지
 * (threat policy)나 찾은 값으로 무엇을 할지(제거/거부)는 다루지 않는다.
 *
 * on* 이벤트 핸들러 판정은 이 leaf에 포함하지 않는다 — 소비자별로 판정 폭이
 * 의도적으로 다르다(`classify-attribute-threat.internal.ts` 참고).
 */

/**
 * 따옴표 안의 `>` 문자를 태그 종료로 오인하지 않도록 SVG 시작 태그를 순회하는 패턴이다.
 */
export const SVG_START_TAG_PATTERN = /<([a-z][a-z0-9:-]*)(\b(?:[^"'<>]|"[^"]*"|'[^']*')*)(\/?)>/gi;

/** 속성 이름 집합을 따옴표 방식별로 찾아내는 정규식 3종. */
export interface AttributeValuePatterns {
  readonly doubleQuoted: RegExp;
  readonly singleQuoted: RegExp;
  readonly unquoted: RegExp;
}

/**
 * 주어진 속성 이름 집합을 큰따옴표/작은따옴표/무인용 값과 무관하게 찾아내는
 * 정규식 3종을 만든다.
 *
 * 각 정규식은 전역(`g`) 플래그를 가지며 `(attrName, value)` 두 캡처 그룹을
 * 돌려준다. 이름은 긴 것부터 정렬해 `marker-end`가 `marker`로 부분 매치되는
 * 것을 방지한다.
 *
 * @param names 대상 속성 이름(또는 이름 자리의 정규식 조각). 호출자가 이미
 *   정규식으로 안전한 문자열만 넘긴다는 전제다 — 이 함수는 이스케이프하지 않는다.
 */
export function buildAttributeValuePatterns(names: readonly string[]): AttributeValuePatterns {
  const alternation = [...names].sort((a, b) => b.length - a.length).join('|');
  return {
    doubleQuoted: new RegExp(`\\s+(${alternation})\\s*=\\s*"([^"]*)"`, 'gi'),
    singleQuoted: new RegExp(`\\s+(${alternation})\\s*=\\s*'([^']*)'`, 'gi'),
    unquoted: new RegExp(`\\s+(${alternation})\\s*=\\s*(?!["'])([^\\s>]+)`, 'gi'),
  };
}
