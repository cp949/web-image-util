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
import { getCssPolicyValueVariants, normalizePolicyValue } from './svg-policy-utils.internal';

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
 * 경량 모드가 차단하는 URI 스킴 denylist 판정.
 *
 * @param normalizedValue `normalizePolicyValue()`를 거친 값
 * @returns 차단 대상 스킴이면 true
 */
export function isDeniedUriScheme(normalizedValue: string): boolean {
  return (
    normalizedValue.startsWith('//') ||
    normalizedValue.startsWith('http://') ||
    normalizedValue.startsWith('https://') ||
    normalizedValue.startsWith('data:') ||
    normalizedValue.startsWith('javascript:')
  );
}

/**
 * `href`/`xlink:href`/`src` 값이 해당 모드에서 보존 가능한지 판정한다.
 *
 * - lightweight: denylist — 알려진 위험 스킴만 차단하고 나머지(상대 경로, 빈 값,
 *   미지 스킴)는 보존한다. 이 보존은 동치성 코퍼스에 알려진 구멍으로 등재되어 있다.
 * - strict: allowlist — 문서 내부 프래그먼트(`#id`)만 보존한다.
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
  return !isDeniedUriScheme(normalizePolicyValue(value));
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
 * 경량 denylist에 `./`, `../`, `/` 경로를 더한 guard 전용 집합이다.
 * sanitizer가 보존한 안전한 raster와 canonical 재인코딩된 nested SVG는
 * 차단하지 않는다 — 비-canonical `data:` 형식은 sanitizer 우회 가능성이
 * 있으므로 fail-closed로 차단한다.
 *
 * @param ref 정규화 전 또는 후의 참조 문자열
 * @returns 외부 또는 실행 가능한 URI면 true
 */
export function isBlockedPipelineUriRef(ref: string): boolean {
  const normalizedRef = normalizePolicyValue(ref);

  if (normalizedRef.startsWith('data:') && (isSafeRasterDataImageRef(ref) || isSanitizedSvgDataImageRef(ref))) {
    return false;
  }

  return (
    isDeniedUriScheme(normalizedRef) ||
    normalizedRef.startsWith('./') ||
    normalizedRef.startsWith('../') ||
    normalizedRef.startsWith('/')
  );
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
 * CSS `url()` 내부 값이 해당 모드에서 보존 가능한지 판정한다.
 *
 * - lightweight: denylist — 원본/escape 디코드 변형 중 하나라도 위험 스킴이면 차단
 * - strict: allowlist — 경계 따옴표 제거 후 `#fragment`만 허용
 *
 * @param urlValue `url(...)` 내부 값 (따옴표 포함 가능)
 * @param mode 위협 정책 모드
 * @returns 보존 가능하면 true
 */
export function isAllowedCssUrl(urlValue: string, mode: SvgThreatPolicyMode): boolean {
  if (mode === 'strict') {
    return urlValue
      .replace(/^['"]|['"]$/g, '')
      .trim()
      .startsWith('#');
  }
  return !getCssPolicyValueVariants(urlValue).map(normalizePolicyValue).some(isDeniedUriScheme);
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
