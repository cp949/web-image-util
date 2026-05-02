/**
 * SVG 문자열 감지 유틸리티다.
 */

/**
 * 문자열 앞의 UTF-8 BOM을 제거한다.
 *
 * @param value 입력 문자열
 * @returns BOM이 제거된 문자열
 */
function stripBom(value: string): string {
  return value.replace(/^\uFEFF/, '');
}

/**
 * SVG 앞부분의 XML 프롤로그와 잡음을 제거한다.
 *
 * XML 선언, 주석, DOCTYPE, 공백을 걷어내 실제 SVG 루트 태그 판별에 집중할 수 있게 한다.
 *
 * @param head 분석할 문자열의 앞부분
 * @returns 실제 SVG 내용부터 시작하는 문자열
 */
function stripXmlPreambleAndNoise(head: string): string {
  let s = head.trimStart();

  // XML 선언을 먼저 제거한다. 닫히지 않은 선언은 유효한 SVG 시작으로 보지 않는다.
  if (s.startsWith('<?xml')) {
    const end = s.indexOf('?>');
    if (end < 0) return s;
    s = s.slice(end + 2).trimStart();
  }

  // 연속된 주석이 있을 수 있어 반복해서 제거한다.
  while (true) {
    const match = s.match(/^<!--[\s\S]*?-->\s*/);
    if (!match) break;
    s = s.slice(match[0].length);
  }

  // DOCTYPE 선언을 제거한다.
  const doctype = s.match(/^<!DOCTYPE[^>]*>\s*/i);
  if (doctype) s = s.slice(doctype[0].length);

  return s.trimStart();
}

/**
 * XML 전처리를 거친 뒤 문자열이 인라인 SVG인지 정확하게 판정한다.
 *
 * 단순한 `includes('<svg')` 검사는 HTML 조각이나 임베디드 문자열에 오탐을 만들 수 있어,
 * BOM, XML 선언, 주석, DOCTYPE을 제거한 뒤 실제 루트가 `<svg`인지 확인한다.
 * SVG Data URL은 XML 문자열 자체가 아니므로 false를 반환한다.
 *
 * @param source SVG 여부를 확인할 문자열
 * @returns 유효한 인라인 SVG XML 문자열이면 true
 */
export function isInlineSvg(source: string): boolean {
  if (!source) return false;
  const stripped = stripXmlPreambleAndNoise(stripBom(source));
  return /^<svg(?:[\s/>])/i.test(stripped);
}
