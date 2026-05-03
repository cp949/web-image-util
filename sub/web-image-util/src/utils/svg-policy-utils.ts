/**
 * SVG 보안 정책 비교에 필요한 공통 문자열/CSS 유틸리티.
 *
 * lightweight sanitizer와 SVG 입력 안전성 검사 경로가 같은 CSS escape/엔티티 해석 규칙을
 * 공유하도록 순수 함수만 둔다.
 */

/**
 * HTML/XML 문자 참조를 실제 문자로 복원한다.
 *
 * 브라우저가 SVG를 파싱할 때 `jav&#x61;script:` 같은 값이 다시 `javascript:`로
 * 해석되므로, 정책 비교 전에 최소한의 엔티티 디코딩이 필요하다.
 *
 * @param value 디코딩할 속성값 또는 CSS 조각
 * @returns 문자 참조가 복원된 문자열
 */
export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(?:x([0-9a-f]+)|([0-9]+));?/gi, (_match, hex: string | undefined, decimal: string | undefined) => {
      const codePoint = hex ? Number.parseInt(hex, 16) : Number.parseInt(decimal ?? '', 10);
      if (!Number.isFinite(codePoint)) {
        return '';
      }

      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return '';
      }
    })
    .replace(/&(quot|amp|apos|lt|gt|tab|newline|colon);/gi, (_match, entity: string) => {
      switch (entity.toLowerCase()) {
        case 'quot':
          return '"';
        case 'amp':
          return '&';
        case 'apos':
          return "'";
        case 'lt':
          return '<';
        case 'gt':
          return '>';
        case 'tab':
          return '\t';
        case 'newline':
          return '\n';
        case 'colon':
          return ':';
        default:
          return '';
      }
    });
}

/**
 * 보안 정책 비교 전에 URI 조각을 정규화한다.
 *
 * @param value 정규화할 문자열
 * @returns 정책 비교용 문자열
 */
export function normalizePolicyValue(value: string): string {
  return stripPolicyBoundaryQuotes(stripPolicyNoise(decodeHtmlEntities(value))).toLowerCase();
}

/**
 * CSS 숫자 escape 시퀀스를 실제 문자로 복원한다.
 *
 * @param value 디코딩할 CSS 조각
 * @returns CSS escape가 복원된 문자열
 */
export function decodeCssEscapes(value: string): string {
  return value.replace(/\\([0-9a-f]{1,6}\s?|.)/gi, (_match, escaped: string) => {
    const hex = escaped.trim();
    if (/^[0-9a-f]{1,6}$/i.test(hex)) {
      try {
        return String.fromCodePoint(Number.parseInt(hex, 16));
      } catch {
        return '';
      }
    }
    return escaped;
  });
}

/**
 * CSS URL 정책 비교에 사용할 원본/디코딩 후보를 반환한다.
 *
 * @param value `url(...)` 내부 값
 * @returns 정책 비교 후보 문자열 목록
 */
export function getCssPolicyValueVariants(value: string): string[] {
  return [value, decodeCssEscapes(value), decodeCssEscapes(decodeHtmlEntities(value))];
}

/**
 * CSS 텍스트 안의 `url(...)` 호출 값을 순회한다.
 *
 * @param css 검사할 CSS 텍스트
 * @param visitor `url(...)` 내부 값과 전체 match를 받는 콜백
 */
export function visitCssUrlValues(css: string, visitor: (value: string, match: string) => void): void {
  const urlPattern = createCssUrlPattern();
  let match: RegExpExecArray | null = urlPattern.exec(css);
  while (match !== null) {
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    visitor(value, match[0]);
    match = urlPattern.exec(css);
  }
}

/**
 * CSS 텍스트의 `url(...)` 호출 값을 조건에 따라 치환한다.
 *
 * @param css 처리할 CSS 텍스트
 * @param replacer `url(...)` 내부 값과 전체 match를 받아 대체 문자열을 반환하는 콜백
 * @returns 치환된 CSS 텍스트
 */
export function replaceCssUrlValues(css: string, replacer: (value: string, match: string) => string): string {
  return css.replace(
    createCssUrlPattern(),
    (match, _raw: string, doubleQuoted?: string, singleQuoted?: string, unquoted?: string) => {
      const value = doubleQuoted ?? singleQuoted ?? unquoted ?? '';
      return replacer(value, match);
    }
  );
}

function stripPolicyNoise(value: string): string {
  let normalized = '';

  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (char.trim().length === 0 || codePoint <= 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f)) {
      continue;
    }

    normalized += char;
  }

  return normalized;
}

function stripPolicyBoundaryQuotes(value: string): string {
  return value.replace(/^[\\"']+|[\\"']+$/g, '');
}

function createCssUrlPattern(): RegExp {
  return new RegExp(`${CSS_URL_FUNCTION_NAME_PATTERN.source}\\s*\\(\\s*("([^"]*)"|'([^']*)'|([^"')]*))\\s*\\)`, 'gi');
}

const CSS_HEX_2_PATTERN = '(?:2|&#x0*32;?|&#0*50;?)';
const CSS_HEX_4_PATTERN = '(?:4|&#x0*34;?|&#0*52;?)';
const CSS_HEX_5_PATTERN = '(?:5|&#x0*35;?|&#0*53;?)';
const CSS_HEX_6_PATTERN = '(?:6|&#x0*36;?|&#0*54;?)';
const CSS_HEX_7_PATTERN = '(?:7|&#x0*37;?|&#0*55;?)';
const CSS_HEX_C_PATTERN = '(?:c|C|&#x0*(?:43|63);?|&#0*(?:67|99);?)';

const CSS_ESCAPED_U_PATTERN = `\\\\(?:0{0,4}(?:${CSS_HEX_5_PATTERN}${CSS_HEX_5_PATTERN}|${CSS_HEX_7_PATTERN}${CSS_HEX_5_PATTERN})\\s?|u)`;
const CSS_ESCAPED_R_PATTERN = `\\\\(?:0{0,4}(?:${CSS_HEX_5_PATTERN}${CSS_HEX_2_PATTERN}|${CSS_HEX_7_PATTERN}${CSS_HEX_2_PATTERN})\\s?|r)`;
const CSS_ESCAPED_L_PATTERN = `\\\\(?:0{0,4}(?:${CSS_HEX_4_PATTERN}${CSS_HEX_C_PATTERN}|${CSS_HEX_6_PATTERN}${CSS_HEX_C_PATTERN})\\s?|l)`;

const CSS_URL_FUNCTION_NAME_PATTERN = new RegExp(
  `(?:u|${CSS_ESCAPED_U_PATTERN}|&#(?:x0*(?:55|75)|0*(?:85|117));?)(?:r|${CSS_ESCAPED_R_PATTERN}|&#(?:x0*(?:52|72)|0*(?:82|114));?)(?:l|${CSS_ESCAPED_L_PATTERN}|&#(?:x0*(?:4c|6c)|0*(?:76|108));?)`,
  'i'
);
