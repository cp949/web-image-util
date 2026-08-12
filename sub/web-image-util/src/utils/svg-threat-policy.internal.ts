/**
 * SVG 위협 정책(threat policy) 모듈.
 *
 * "SVG에서 무엇이 위험한 참조·요소·속성인가"에 대한 판정 규칙의 단일 소유자다.
 * 경량(정규식)·strict(DOMPurify) 두 집행 엔진과 진단 수집기, intake guard는 모두
 * 이 모듈의 술어·목록을 소비하고, 각자는 "어떻게 제거하는가"(메커니즘)만 담당한다.
 *
 * 순수 함수·상수만 둔다 — DOM 접근이나 문서 순회 같은 메커니즘은 소비자 몫이다.
 */

import {
  decodeSvgDataImageRef,
  encodeSvgDataImageRef,
  isSafeRasterDataImageRef,
  isSanitizedSvgDataImageRef,
  isSvgDataImageRef,
  MAX_NESTED_SVG_DEPTH,
} from './svg-data-url-policy.internal';
import { decodeCssEscapes, decodeHtmlEntities, normalizePolicyValue } from './svg-policy-utils.internal';

/**
 * 위협 정책 모드.
 *
 * 공개 옵션의 `'skip'`은 정책이 아니라 파이프라인 분기이므로 여기 없다.
 */
export type SvgThreatPolicyMode = 'lightweight' | 'strict';

/**
 * nested `data:image/svg+xml` 재귀 정제 콜백.
 *
 * 정책 모듈이 엔진을 직접 부르면 순환 의존이 생기므로, 각 엔진이 자기 자신을
 * 이 형태로 주입한다.
 */
export type NestedSvgSanitize = (svg: string, depth: number) => string;

// ─────────────────────────────── URI 정책 ───────────────────────────────

/**
 * `href`/`xlink:href`/`src` 값이 해당 모드에서 보존 가능한지 판정한다.
 *
 * 두 모드 모두 allowlist다 — 문서 내부 프래그먼트(`#id`)만 보존하고 상대 경로,
 * 빈 값, 미지 스킴을 포함한 나머지는 제거한다. 차이는 정규화 방식뿐이다:
 * lightweight는 문자참조·노이즈 우회를 무력화하는 `normalizePolicyValue()`를,
 * strict는 단순 trim을 쓴다(느슨해지는 방향의 정규화는 strict에 적용하지 않는다).
 *
 * 안전한 `data:image/*` 참조는 `sanitizeUriValue()`가 이 판정 전에 분기 처리하므로
 * 여기서는 모든 `data:` 값을 차단 대상으로 본다.
 *
 * @param value 원본 속성값
 * @param mode 위협 정책 모드
 * @returns 보존 가능하면 true
 */
export function isAllowedUri(value: string, mode: SvgThreatPolicyMode): boolean {
  if (mode === 'strict') {
    return value.trim().startsWith('#');
  }
  if (startsWithPolicyBoundaryQuote(value)) {
    return false;
  }
  return normalizePolicyValue(value).startsWith('#');
}

function startsWithPolicyBoundaryQuote(value: string): boolean {
  for (const char of decodeHtmlEntities(value)) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (char.trim().length === 0 || codePoint <= 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f)) {
      continue;
    }
    return char === '"' || char === "'" || char === '\\';
  }
  return false;
}

/**
 * `href`/`xlink:href`/`src` 값 정제의 공통 골격.
 *
 * - 안전한 raster `data:image/*`는 원본 그대로 보존
 * - `data:image/svg+xml`은 nested SVG를 콜백으로 재귀 정제한 뒤
 *   `data:image/svg+xml;base64,...`로 재인코딩 (디코드 실패는 fail-closed)
 * - 그 외에는 모드별 `isAllowedUri()` 판정
 *
 * @param value 원본 속성값
 * @param mode 위협 정책 모드
 * @param depth 현재 nested SVG 재귀 깊이 (`MAX_NESTED_SVG_DEPTH` 이상이면 제거)
 * @param nestedSanitize 엔진이 주입하는 재귀 정제 함수
 * @returns 보존할 새 속성값(문자열) 또는 제거 의도(null)
 */
export function sanitizeUriValue(
  value: string,
  mode: SvgThreatPolicyMode,
  depth: number,
  nestedSanitize: NestedSvgSanitize
): string | null {
  if (isSafeRasterDataImageRef(value)) {
    return value;
  }

  if (isSvgDataImageRef(value)) {
    if (depth >= MAX_NESTED_SVG_DEPTH) return null;
    const nestedSvg = decodeSvgDataImageRef(value);
    if (!nestedSvg) return null;
    return encodeSvgDataImageRef(nestedSanitize(nestedSvg, depth + 1));
  }

  return isAllowedUri(value, mode) ? value : null;
}

/**
 * 파이프라인 intake guard의 URI 차단 판정.
 *
 * sanitizer의 lightweight 제거 판정(`isAllowedUri`)을 거울로 쓴다 — sanitizer가
 * 제거하는 참조는 guard도 차단한다. 예외 두 가지:
 * - 빈 값은 fetch/실행 대상이 없으므로 차단하지 않는다 (sanitizer는 속성을
 *   제거하지만 guard는 위험으로 보지 않는다)
 * - sanitizer가 보존한 안전한 raster와 canonical 재인코딩된 nested SVG는
 *   차단하지 않는다. 비-canonical `data:` 형식은 sanitizer 우회 가능성이
 *   있으므로 fail-closed로 차단한다.
 *
 * @param ref 정규화 전 또는 후의 참조 문자열
 * @returns 외부 또는 실행 가능한 URI면 true
 */
export function isBlockedPipelineUriRef(ref: string): boolean {
  const normalizedRef = normalizePolicyValue(ref);

  if (normalizedRef === '') {
    return false;
  }

  if (startsWithPolicyBoundaryQuote(ref)) {
    return true;
  }

  if (normalizedRef.startsWith('data:') && (isSafeRasterDataImageRef(ref) || isSanitizedSvgDataImageRef(ref))) {
    return false;
  }

  return !normalizedRef.startsWith('#');
}

// ─────────────────────────────── CSS 정책 ───────────────────────────────

/**
 * CSS 값으로 해석되며 URL 참조를 가질 수 있는 SVG presentation 속성 목록.
 *
 * 모든 속성에 CSS 정제를 적용하면 `xmlns` 같은 네임스페이스 선언까지 외부 URL로
 * 오인할 수 있으므로, `style` 속성과 이 목록에 있는 속성만 CSS 정책 대상으로 삼는다.
 */
export const CSS_URL_PRESENTATION_ATTRIBUTES: ReadonlySet<string> = new Set([
  'clip-path',
  'color-profile',
  'cursor',
  'fill',
  'filter',
  'marker',
  'marker-end',
  'marker-mid',
  'marker-start',
  'mask',
  'stroke',
]);

/**
 * CSS `url()` 내부 값이 보존 가능한지 판정한다.
 *
 * URI 판정과 마찬가지로 모드 무관 allowlist다 — 경계 따옴표 제거 후
 * `#fragment`만 허용한다.
 *
 * @param urlValue `url(...)` 내부 값 (따옴표 포함 가능)
 * @returns 보존 가능하면 true
 */
export function isAllowedCssUrl(urlValue: string): boolean {
  return urlValue
    .replace(/^['"]|['"]$/g, '')
    .trim()
    .startsWith('#');
}

/**
 * style 속성, CSS presentation 속성, `<style>` 본문에서 외부 참조와 위험 CSS
 * 구문을 제거한다. 두 집행 엔진이 같은 함수를 소비하는 모드 무관 단일 정책이다.
 *
 * CSS 파서는 환경별 차이가 있어 필수 차단 항목만 보수적인 문자열 정책으로
 * 제거한다. `url(#id)` 같은 문서 내부 참조만 보존하고, `@import`,
 * `expression()`, `-moz-binding`, `image-set()` 및 외부 URL 문자열을 직접 받는
 * CSS 구문은 값 단위로 제거한다. CSS escape(예: `u\72l(...)`)는 디코드해 같은
 * 정책으로 판정하고, 디코드 후 위험 구문이 드러나면 값 전체를 폐기한다.
 *
 * @param css CSS 문자열
 * @returns 위험 참조가 제거된 CSS 문자열
 */
export function sanitizeCssValue(css: string): string {
  const decodedForPolicy = decodeCssEscapes(css);
  const hasDecodedDangerousCss =
    decodedForPolicy !== css &&
    (/@import\b/i.test(decodedForPolicy) ||
      /expression\s*\(/i.test(decodedForPolicy) ||
      /-moz-binding\s*:/i.test(decodedForPolicy) ||
      /url\s*\(/i.test(decodedForPolicy) ||
      /(?:-webkit-)?image-set\s*\(/i.test(decodedForPolicy) ||
      hasExternalCssUrlLiteral(decodedForPolicy));

  if (hasDecodedDangerousCss) {
    return '';
  }

  const sanitizedCss = css
    .replace(/@import\b[^;]*(?:;|$)/gi, '')
    .replace(createCssImageSetFunctionPattern(), '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/-moz-binding\s*:[^;]*(?:;|$)/gi, '')
    .replace(/url\s*\(\s*("([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi, (match, _raw, doubleQuoted, singleQuoted, unquoted) => {
      const urlValue = doubleQuoted ?? singleQuoted ?? unquoted ?? '';
      return isAllowedCssUrl(urlValue) ? match : 'none';
    });

  return hasExternalCssUrlLiteral(sanitizedCss) ? '' : sanitizedCss;
}

/**
 * CSS 값 내부에 외부 URL 문자열이 직접 포함되어 있는지 판정한다.
 *
 * `image-set("https://...")`처럼 `url(...)`을 쓰지 않는 CSS 함수도 외부 리소스를
 * 로드할 수 있으므로, strict 정책은 CSS 값 안의 명시적인 외부 URL 문자열을
 * 보수적으로 차단한다.
 *
 * @param css CSS 문자열
 * @returns 외부 URL 문자열이 있으면 true
 */
export function hasExternalCssUrlLiteral(css: string): boolean {
  return /(?:https?:|file:|data:|blob:|ftp:|\/\/)/i.test(css);
}

/**
 * CSS image-set 계열 함수 패턴을 생성한다.
 *
 * 상대 경로도 외부 리소스로 해석될 수 있으므로 strict 정책은 함수 전체를 제거한다.
 * `/g` 플래그의 lastIndex 상태 공유를 피하기 위해 상수 대신 팩토리로 제공한다.
 */
export function createCssImageSetFunctionPattern(): RegExp {
  return /(?:-webkit-)?image-set\s*\([^)]*\)/gi;
}

// ─────────────────────────── 요소·속성 정책 ───────────────────────────

/**
 * 모드 무관 금지 요소(소문자 localName) — 두 집행 엔진이 항상 제거한다.
 */
export const FORBIDDEN_SVG_ELEMENT_NAMES: readonly string[] = ['foreignobject', 'script'];

/**
 * `attributeName`으로 href를 타겟팅해 URI 정책을 우회할 수 있는 애니메이션
 * 요소(소문자). `animateTransform` 등 좌표 애니메이션은 해당 없다.
 *
 * strict 엔진은 DOMPurify 기본 정책으로 이 요소들을 전부 제거하고, 경량 엔진은
 * href 타겟팅 여부를 판정해 해당 요소만 제거한다.
 */
export const HREF_TARGETING_ANIMATION_ELEMENT_NAMES: readonly string[] = ['animate', 'set'];

/**
 * `attributeName` 값이 href 계열(URI 정책 우회 대상)인지 판정한다.
 *
 * @param value attributeName 속성값
 * @returns href 또는 xlink:href를 타겟팅하면 true
 */
export function isHrefTargetingAttributeValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === 'href' || normalized === 'xlink:href';
}

/**
 * DOCTYPE/ENTITY 선언(XXE 표면)을 절단한다 — 두 집행 엔진이 공유한다.
 *
 * DOCTYPE 제거는 internal subset 안의 quoted `]>` 같은 까다로운 케이스에서도
 * 잔여물이 남지 않도록 "DOCTYPE 시작부터 다음 SVG 루트 시작 또는 문서 끝까지"를
 * 한 번에 절단한다. 루트 내부에 단독으로 등장한 `<!ENTITY ...>`는 별도로 정리한다.
 *
 * @param svg 원본 SVG 문자열
 * @returns 절단 결과와 선언 발견 여부
 */
export function stripDoctypeAndEntityDeclarations(svg: string): {
  svg: string;
  doctypeRemoved: boolean;
  entityRemoved: boolean;
} {
  const doctypeRemoved = /<!DOCTYPE\b/i.test(svg);
  const entityRemoved = /<!ENTITY\b/i.test(svg);

  let result = svg;
  if (doctypeRemoved) {
    result = result.replace(/<!DOCTYPE\b[\s\S]*?(?=<svg\b|$)/gi, '');
  }
  if (entityRemoved) {
    result = result.replace(/<!ENTITY\b[^>]*>/gi, '');
  }

  return { svg: result, doctypeRemoved, entityRemoved };
}

const EVENT_HANDLER_ATTRIBUTE_PATTERN = /^on[a-z0-9:-]+$/i;

/**
 * `on*` 이벤트 핸들러 속성 이름인지 판정한다.
 *
 * strict 엔진의 재강제 단계는 방어적으로 이보다 넓은 `on` 접두 검사를 쓴다 —
 * 정책 판정(진단·카운트)은 이 술어를 기준으로 한다.
 *
 * @param name 속성 이름
 * @returns 이벤트 핸들러 속성이면 true
 */
export function isEventHandlerAttributeName(name: string): boolean {
  return EVENT_HANDLER_ATTRIBUTE_PATTERN.test(name);
}
