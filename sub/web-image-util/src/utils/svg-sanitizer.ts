/**
 * SVG 새니타이저 모듈
 *
 * @description
 * SVG 문자열에서 XSS 및 캔버스 오염을 유발할 수 있는 위험 요소를 제거한다.
 * 브라우저와 Node.js(happy-dom) 양쪽에서 동작하도록 정규식 기반으로 구현한다.
 *
 * **제거 대상:**
 * - `<script>` 요소 (자가 닫힘 포함)
 * - `<foreignObject>` 요소 (중첩 콘텐츠 포함)
 * - `on*` 이벤트 핸들러 속성 (onload, onclick 등)
 * - `href`, `xlink:href`, `src` 속성 중 외부 URL을 가리키는 것
 *   (http://, https://, data:, javascript: — 프래그먼트 참조 `#id`는 보존)
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
function decodeHtmlEntities(value: string): string {
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
 * 엔티티 디코딩 후 소문자화하고, 프로토콜 판별을 흐릴 수 있는 제어 문자와 공백을 제거한다.
 *
 * @param value 정규화할 문자열
 * @returns 정책 비교용 정규화 문자열
 */
function normalizePolicyValue(value: string): string {
  return stripPolicyNoise(decodeHtmlEntities(value)).toLowerCase();
}

/**
 * 프로토콜 판별을 흐릴 수 있는 제어 문자와 공백을 제거한다.
 *
 * @param value 정리할 문자열
 * @returns 정책 비교용으로 정리된 문자열
 */
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

/**
 * `href` 또는 `xlink:href` 속성값이 외부 URL인지 판정한다.
 *
 * 프래그먼트 참조(#...) 및 일반 상대 경로 이외의 경우를 위험으로 간주한다.
 * 단, 태스크 명세에 따라 여기서는 외부 URL(http://, https://, data:, javascript:)만 제거한다.
 *
 * @param value 속성값 문자열
 * @returns 외부 URL이면 true
 */
function isExternalHref(value: string): boolean {
  const normalized = normalizePolicyValue(value);
  return (
    normalized.startsWith('//') ||
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('javascript:')
  );
}

/**
 * CSS `url()` 함수 내 값이 외부 참조인지 판정한다.
 *
 * 외부 참조로 간주하는 스킴: http://, https://, data:, javascript://
 * 프래그먼트 참조(#...) 는 내부 참조이므로 허용한다.
 *
 * @param urlValue `url()` 안쪽의 따옴표가 제거된 문자열
 * @returns 외부 참조이면 true
 */
function isExternalCssUrl(urlValue: string): boolean {
  const normalized = normalizePolicyValue(urlValue);
  return (
    normalized.startsWith('//') ||
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('javascript:')
  );
}

/**
 * CSS 텍스트(style 속성값 또는 `<style>` 블록 본문)에서 외부 `url()` 참조를 제거한다.
 *
 * 제거 대상: `url(http://...)`, `url('https://...')`, `url("data:...")`, `url(javascript:...)` 등
 * 대체값: `url(#invalid)` — 내부 참조 형식이지만 실제로 존재하지 않아 렌더링에 영향을 주지 않는다.
 *
 * @param css 처리할 CSS 텍스트
 * @returns 외부 url() 참조가 제거된 CSS 텍스트
 */
function stripExternalCssUrls(css: string): string {
  // url("..."), url('...'), url(...) 세 가지 형식을 모두 처리한다
  return css
    .replace(/url\s*\(\s*"([^"]*)"\s*\)/gi, (_match, value: string) =>
      isExternalCssUrl(value) ? 'url(#invalid)' : _match
    )
    .replace(/url\s*\(\s*'([^']*)'\s*\)/gi, (_match, value: string) =>
      isExternalCssUrl(value) ? 'url(#invalid)' : _match
    )
    .replace(/url\s*\(\s*([^"')[^\s)]*)\s*\)/gi, (_match, value: string) =>
      isExternalCssUrl(value) ? 'url(#invalid)' : _match
    );
}

/**
 * 따옴표 안의 `>` 문자를 태그 종료로 오인하지 않도록 SVG 시작 태그를 순회하는 패턴이다.
 */
const SVG_START_TAG_PATTERN = /<([a-z][a-z0-9:-]*)(\b(?:[^"'<>]|"[^"]*"|'[^']*')*)(\/?)>/gi;

/**
 * SVG 문자열에서 위험 요소와 속성을 제거한 안전한 SVG 문자열을 반환한다.
 *
 * **처리 순서:**
 * 1. `<script>...</script>` 또는 `<script ... />` 제거
 * 2. `<foreignObject>...</foreignObject>` 제거 (중첩 포함)
 * 3. `on*` 이벤트 핸들러 속성 제거
 * 4. `href`, `xlink:href`, `src` 속성 중 외부 URL 값 제거
 * 5. `style` 속성 및 `<style>` 블록 내 외부 `url()` 참조 제거
 *
 * @param svgString 입력 SVG 문자열
 * @returns 위험 요소가 제거된 SVG 문자열
 *
 * @remarks
 * 이 함수는 정규식 기반으로 알려진 위협 벡터의 일부를 제거한다.
 * 완전한 보안 솔루션이 아니며, 신뢰할 수 없는 SVG를 완전히 안전하게 만들어주지 않는다.
 * 실제 프로덕션 환경에서는 DOMPurify 등 전용 라이브러리와 병행 사용을 권장한다.
 */
export function sanitizeSvg(svgString: string): string {
  let result = svgString;

  // 1. <script> 요소 제거 — 자가 닫힘(`<script ... />`)과 블록 형태(`<script>...</script>`) 모두 처리한다
  // 자가 닫힘 먼저 제거해야 블록 패턴의 오탐을 줄일 수 있다
  result = result.replace(/<script\b[^>]*\/>/gi, '');
  result = result.replace(/<script\b[\s\S]*?<\/script\s*>/gi, '');

  // 2. <foreignObject> 요소 제거 — 중첩 HTML 삽입 벡터를 제거한다
  // 중첩된 foreignObject를 모두 제거하기 위해 반복 적용한다
  let prev: string;
  do {
    prev = result;
    result = result.replace(/<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi, '');
  } while (result !== prev);
  // 자가 닫힘 foreignObject도 처리한다
  result = result.replace(/<foreignObject\b[^>]*\/>/gi, '');

  // 3~5. 태그 내부 속성만 대상으로 위험 속성을 제거/정제한다.
  result = result.replace(SVG_START_TAG_PATTERN, (_match, tagName: string, attrs: string, selfClosing: string) => {
    const cleaned = attrs
      // 3. on* 이벤트 핸들러 속성 제거
      .replace(/\s+on[a-z0-9:-]+\s*=\s*"[^"]*"/gi, '')
      .replace(/\s+on[a-z0-9:-]+\s*=\s*'[^']*'/gi, '')
      .replace(/\s+on[a-z0-9:-]+\s*=\s*[^\s>]+/gi, '')
      // 4. href, xlink:href, src 속성 중 외부 URL 값을 제거한다
      .replace(/\s+(?:(?:xlink:)?href|src)\s*=\s*"([^"]*)"/gi, (attrMatch, value: string) => {
        return isExternalHref(value) ? '' : attrMatch;
      })
      .replace(/\s+(?:(?:xlink:)?href|src)\s*=\s*'([^']*)'/gi, (attrMatch, value: string) => {
        return isExternalHref(value) ? '' : attrMatch;
      })
      .replace(/\s+(?:(?:xlink:)?href|src)\s*=\s*(?!["'])([^\s>]+)/gi, (attrMatch, value: string) => {
        return isExternalHref(value) ? '' : attrMatch;
      })
      // 5. style 속성 내 외부 url() 참조를 제거한다
      .replace(/\s+style\s*=\s*"([^"]*)"/gi, (_attrMatch, cssValue: string) => {
        const cleanedCss = stripExternalCssUrls(cssValue);
        return ` style="${cleanedCss}"`;
      })
      .replace(/\s+style\s*=\s*'([^']*)'/gi, (_attrMatch, cssValue: string) => {
        const cleanedCss = stripExternalCssUrls(cssValue);
        return ` style='${cleanedCss}'`;
      })
      .replace(/\s+style\s*=\s*(?!["'])([^\s>]+)/gi, (_attrMatch, cssValue: string) => {
        const cleanedCss = stripExternalCssUrls(cssValue);
        return ` style="${cleanedCss}"`;
      });

    return `<${tagName}${cleaned}${selfClosing}>`;
  });

  // 6. <style> 블록 본문 내 외부 url() 참조를 제거한다
  result = result.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi,
    (_match, open: string, body: string, close: string) => {
      return `${open}${stripExternalCssUrls(body)}${close}`;
    }
  );

  return result;
}
