/**
 * SVG 위협 정책(threat policy) 모듈.
 *
 * "SVG에서 무엇이 위험한 참조·요소·속성인가"에 대한 판정 규칙의 단일 소유자다.
 * 경량(정규식)·strict(DOMPurify) 두 집행 엔진과 진단 수집기, intake guard는 모두
 * 이 모듈의 술어·목록을 소비하고, 각자는 "어떻게 제거하는가"(메커니즘)만 담당한다.
 *
 * 순수 함수·상수만 둔다 — DOM 접근이나 문서 순회 같은 메커니즘은 소비자 몫이다.
 */

import { isDataURLString } from './data-url';
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
 * 참조 판정이 갈린 근거.
 *
 * 소비자별 동작 차이는 이 코드에 대한 매핑으로만 표현한다 — 집행 엔진은 제거를,
 * intake guard는 거부를, 진단 수집기는 집계를 각자 고른다.
 *
 * `empty`와 `normalized-empty`를 가르는 이유는 두 소비자의 "빈 값" 정의가 다르기
 * 때문이다. 진단 수집기는 원본 `trim()` 기준으로 집계하고, intake guard는
 * 정규화 기준으로 허용한다. `&#32;`가 두 축에서 갈리는 지점이다.
 */
export type UriRefReason =
  | 'internal-fragment'
  | 'empty'
  | 'normalized-empty'
  | 'boundary-quote'
  | 'safe-raster-data'
  | 'canonical-svg-data'
  | 'nested-svg-data'
  | 'unsafe-data'
  | 'external';

/**
 * 참조 판정 결과.
 *
 * `verdict`는 위협 여부이지 허용 여부가 아니다. 빈 참조는 위협이 아니지만
 * sanitizer는 제거한다 — 그 제거는 위협 대응이 아니라 위생 동작이다.
 */
export interface UriRefVerdict {
  verdict: 'threat' | 'no-threat';
  reason: UriRefReason;
}

/**
 * `href`/`xlink:href`/`src` 값 하나를 판정해 위협 여부와 근거를 돌려준다.
 *
 * 검사 순서가 계약의 일부다.
 * 1. `data:` 계열은 **원본 값 기준**으로 가른다. 정규화값 기준으로 바꾸면
 *    `&#100;ata:...` 같은 입력이 data 분기를 타 진단 집계가 달라진다.
 * 2. 빈 값 검사가 경계 따옴표보다 **먼저**다. `&quot;`(따옴표 단독)는 정규화하면
 *    비므로 오늘 intake guard가 허용한다.
 * 3. fragment 판정만 모드별 정규화를 쓴다 — strict는 `trim()`, lightweight는
 *    문자참조·노이즈를 디코드하는 `normalizePolicyValue()`.
 *
 * 모드에 따라 reason이 갈릴 수 있다. `&#35;frag`는 strict에서 `external`,
 * lightweight에서 `internal-fragment`다.
 *
 * @param value 원본 속성값
 * @param mode 위협 정책 모드
 * @returns 위협 여부와 판정 근거
 */
export function classifyUriRef(value: string, mode: SvgThreatPolicyMode): UriRefVerdict {
  if (isDataURLString(value)) {
    if (isSafeRasterDataImageRef(value)) return { verdict: 'no-threat', reason: 'safe-raster-data' };
    if (isSanitizedSvgDataImageRef(value)) return { verdict: 'no-threat', reason: 'canonical-svg-data' };
    if (isSvgDataImageRef(value)) return { verdict: 'threat', reason: 'nested-svg-data' };
    return { verdict: 'threat', reason: 'unsafe-data' };
  }

  const trimmed = value.trim();
  if (trimmed === '') return { verdict: 'no-threat', reason: 'empty' };

  const normalizedPolicyValue = normalizePolicyValue(value);
  if (normalizedPolicyValue === '') return { verdict: 'no-threat', reason: 'normalized-empty' };
  if (startsWithPolicyBoundaryQuote(value)) return { verdict: 'threat', reason: 'boundary-quote' };

  const normalized = mode === 'strict' ? trimmed : normalizedPolicyValue;
  if (normalized.startsWith('#')) return { verdict: 'no-threat', reason: 'internal-fragment' };
  return { verdict: 'threat', reason: 'external' };
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
 * 판정은 `classifyUriRef()`가 소유하고, 이 함수는 reason별 값 변환만 담당한다.
 * nested SVG 재귀 정제(깊이 제한, 디코드 실패 fail-closed, canonical 재인코딩)는
 * 판정이 아니라 메커니즘이므로 여기 남는다.
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
  const { reason } = classifyUriRef(value, mode);

  switch (reason) {
    case 'safe-raster-data':
    case 'internal-fragment':
      return value;

    case 'canonical-svg-data':
    case 'nested-svg-data': {
      if (depth >= MAX_NESTED_SVG_DEPTH) return null;
      const nestedSvg = decodeSvgDataImageRef(value);
      if (!nestedSvg) return null;
      return encodeSvgDataImageRef(nestedSanitize(nestedSvg, depth + 1));
    }

    default:
      return null;
  }
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
 * CSS 위험 구문 1건. 탐지와 제거를 한 항목이 소유한다.
 *
 * 집행 엔진은 `createStripPattern()`으로 제거하고, 진단 수집기는 같은 패턴의
 * replacer에서 센다. 두 소비자가 같은 테이블을 같은 순서로 순회한다.
 */
interface DangerousCssConstruct {
  /** 문서에서 위험 구문 항목을 식별하는 코드. 런타임 판정에는 사용하지 않는다. */
  code: 'at-import' | 'image-set' | 'expression' | 'moz-binding';
  /** 존재 탐지 — `/g` 없이 두어 `lastIndex` 상태를 공유하지 않는다. */
  detect: RegExp;
  /** 값 단위 제거 — `/g`의 `lastIndex` 공유를 피해 팩토리로 제공한다. */
  createStripPattern(): RegExp;
}

/**
 * 위험 CSS 구문 테이블.
 *
 * 배열 순서가 곧 제거 순서다. `image-set()`은 상대 경로도 외부 리소스로
 * 해석될 수 있어 함수 전체를 제거한다.
 */
export const DANGEROUS_CSS_CONSTRUCTS: readonly DangerousCssConstruct[] = [
  {
    code: 'at-import',
    detect: /@import\b/i,
    createStripPattern: () => /@import\b[^;]*(?:;|$)/gi,
  },
  {
    code: 'image-set',
    detect: /(?:-webkit-)?image-set\s*\(/i,
    createStripPattern: () => /(?:-webkit-)?image-set\s*\([^)]*\)/gi,
  },
  {
    code: 'expression',
    detect: /expression\s*\(/i,
    createStripPattern: () => /expression\s*\([^)]*\)/gi,
  },
  {
    code: 'moz-binding',
    detect: /-moz-binding\s*:/i,
    createStripPattern: () => /-moz-binding\s*:[^;]*(?:;|$)/gi,
  },
];

/** `url(` 자체는 제거 대상이 아니라 escape 우회 탐지 신호다. */
const CSS_URL_FUNCTION_DETECT = /url\s*\(/i;

/**
 * CSS escape를 디코드해 감춰진 위험 구문이 드러나는지 확인한다.
 *
 * 디코드 결과를 함께 돌려주는 이유는 진단 수집기가 디코드된 문자열로 다시
 * 세기 때문이다. 집행 엔진은 `revealsDangerous`만 보고 값 전체를 폐기한다.
 *
 * @param css 원본 CSS 문자열
 * @returns 디코드 결과와 위험 노출 여부
 */
export function probeDecodedCss(css: string): { decoded: string; revealsDangerous: boolean } {
  const decoded = decodeCssEscapes(css);
  if (decoded === css) {
    return { decoded, revealsDangerous: false };
  }

  const revealsDangerous =
    DANGEROUS_CSS_CONSTRUCTS.some((construct) => construct.detect.test(decoded)) ||
    CSS_URL_FUNCTION_DETECT.test(decoded) ||
    hasExternalCssUrlLiteral(decoded);

  return { decoded, revealsDangerous };
}

/**
 * style 속성, CSS presentation 속성, `<style>` 본문에서 외부 참조와 위험 CSS
 * 구문을 제거한다. 두 집행 엔진이 같은 함수를 소비하는 모드 무관 단일 정책이다.
 *
 * CSS 파서는 환경별 차이가 있어 필수 차단 항목만 보수적인 문자열 정책으로
 * 제거한다. `url(#id)` 같은 문서 내부 참조만 보존하고, `@import`,
 * `expression()`, `-moz-binding`, `image-set()` 및 외부 URL 문자열을 직접 받는
 * CSS 구문은 값 단위로 제거한다. CSS escape(예: `u\72l(...)`)는 디코드해 같은
 * 정책으로 판정하고, 디코드 후 위험 구문이 드러나면 값 전체를 폐기한다. 위험
 * 구문 판정·제거는 `DANGEROUS_CSS_CONSTRUCTS` 테이블이 소유한다.
 *
 * @param css CSS 문자열
 * @returns 위험 참조가 제거된 CSS 문자열
 */
export function sanitizeCssValue(css: string): string {
  if (probeDecodedCss(css).revealsDangerous) {
    return '';
  }

  let sanitizedCss = css;
  for (const construct of DANGEROUS_CSS_CONSTRUCTS) {
    sanitizedCss = sanitizedCss.replace(construct.createStripPattern(), '');
  }
  sanitizedCss = sanitizedCss.replace(
    /url\s*\(\s*("([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi,
    (match, _raw, doubleQuoted, singleQuoted, unquoted) => {
      const urlValue = doubleQuoted ?? singleQuoted ?? unquoted ?? '';
      return isAllowedCssUrl(urlValue) ? match : 'none';
    }
  );

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
  const normalized = decodeHtmlEntities(value).trim().toLowerCase();
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
 * 정책 판정(진단·카운트)은 이 술어를 기준으로 한다 — `dom-signals.internal.ts`,
 * `svg-sanitizer/warnings.internal.ts`가 이 함수를 직접 호출한다.
 *
 * `svg-sanitizer/enforce-dom-policy.internal.ts`(strict 엔진의 재강제 단계)만
 * 의도된 예외다. 방어적으로 이보다 넓은 `on` 접두 검사(`startsWith('on')`)를
 * 인라인으로 쓴다 — 속성명 `"on"` 단독처럼 이 술어가 이벤트 핸들러로 보지 않는
 * 값까지 보수적으로 제거하기 위해서다. 이 함수를 호출하도록 통합하지 않는다.
 *
 * @param name 속성 이름
 * @returns 이벤트 핸들러 속성이면 true
 */
export function isEventHandlerAttributeName(name: string): boolean {
  return EVENT_HANDLER_ATTRIBUTE_PATTERN.test(name);
}
