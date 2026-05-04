/**
 * @cp949/web-image-util/svg-sanitizer
 *
 * DOMPurify 기반 strict SVG sanitizer 서브패스.
 *
 * processImage() 내부의 경량 안전 처리(lightweight safety guard)와 달리,
 * 이 모듈은 신뢰할 수 없는 SVG를 processImage()에 넘기기 전에 명시적으로
 * 고강도 정제를 수행하기 위한 API를 제공한다.
 *
 * @example
 * ```ts
 * import { processImage } from '@cp949/web-image-util';
 * import { sanitizeSvgStrict } from '@cp949/web-image-util/svg-sanitizer';
 *
 * const safeSvg = sanitizeSvgStrict(svg);
 * const result = await processImage(safeSvg)
 *   .resize({ fit: 'cover', width: 300, height: 300 })
 *   .toBlob();
 * ```
 *
 * @remarks
 * processImage()는 strict sanitizer를 자동 호출하지 않는다.
 * 고강도 정제가 필요한 경우 이 모듈의 함수를 먼저 호출한 뒤
 * processImage()에 결과를 넘긴다.
 */

import type { Config } from 'dompurify';
import DOMPurify from 'dompurify';
import {
  decodeSvgDataImageRef,
  encodeSvgDataImageRef,
  isSafeRasterDataImageRef,
  isSvgDataImageRef,
  MAX_NESTED_SVG_DEPTH,
} from '../utils/svg-data-url-policy';

type DOMPurifyInstance = ReturnType<typeof DOMPurify>;

/**
 * strict SVG sanitizer 옵션
 */
export interface StrictSvgSanitizerOptions {
  /** 최대 SVG 입력 바이트 크기 (UTF-8 기준). 기본값: 10_485_760 (10MiB) */
  maxBytes?: number;
  /** 최대 노드 개수. 기본값: 10_000 */
  maxNodeCount?: number;
  /** <metadata> 요소 제거 여부. 기본값: false */
  removeMetadata?: boolean;
  /**
   * DOMPurify에 추가로 전달할 설정. 기본 strict 정책 위에 사용자 옵션을 머지한다.
   * 보안 핵심 옵션(USE_PROFILES, RETURN_*, IN_PLACE, KEEP_CONTENT 등)은 라이브러리가 강제하므로
   * 사용자가 덮어쓰면 무시되며 warnings에 그 사실이 기록된다.
   *
   * 머지 정책 비대칭 주의:
   * `FORBID_TAGS`와 `FORBID_ATTR`는 사용자 값과 라이브러리 강제 값이 union 머지된다.
   * 태그/속성/URI 허용 범위를 넓힐 수 있는 옵션은 strict 정책 보호를 위해 무시된다.
   */
  domPurifyConfig?: Config;
}

/**
 * sanitizeSvgStrictDetailed() 반환 타입
 */
export interface SanitizeSvgStrictDetailedResult {
  /** 정제된 SVG 문자열 */
  svg: string;
  /** 정제 과정에서 발생한 경고 목록 */
  warnings: string[];
}

/** 기본 최대 입력 바이트 크기 (10MiB) */
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

/** 기본 최대 노드 개수 */
const DEFAULT_MAX_NODE_COUNT = 10_000;

/** DOMPurify 인스턴스 캐시 */
let domPurifyInstance: DOMPurifyInstance | null = null;

/**
 * 사용자가 덮어쓸 수 없는 보안 핵심 설정 키 목록.
 *
 * 이 키들은 사용자 domPurifyConfig에서 제공되더라도 라이브러리 기본값으로 강제되며,
 * 덮어쓰기 시도 사실은 warnings에 기록된다.
 */
const FORBIDDEN_OVERRIDE_KEYS = [
  'ADD_ATTR',
  'ADD_DATA_URI_TAGS',
  'ADD_TAGS',
  'ADD_URI_SAFE_ATTR',
  'ALLOW_UNKNOWN_PROTOCOLS',
  'ALLOWED_ATTR',
  'ALLOWED_TAGS',
  'ALLOWED_URI_REGEXP',
  'CUSTOM_ELEMENT_HANDLING',
  'USE_PROFILES',
  'SAFE_FOR_TEMPLATES',
  'SAFE_FOR_XML',
  'WHOLE_DOCUMENT',
  'RETURN_DOM',
  'RETURN_DOM_FRAGMENT',
  'RETURN_TRUSTED_TYPE',
  'IN_PLACE',
  'KEEP_CONTENT',
] as const satisfies readonly (keyof Config)[];

/**
 * CSS 값으로 해석되며 URL 참조를 가질 수 있는 SVG presentation 속성 목록.
 *
 * 모든 속성에 CSS 정제를 적용하면 `xmlns` 같은 네임스페이스 선언까지 외부 URL로
 * 오인할 수 있으므로, style 속성과 이 목록에 있는 속성만 CSS 정책 대상으로 삼는다.
 */
const CSS_URL_PRESENTATION_ATTRIBUTES = new Set([
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
 * 실행 환경에 맞는 DOMPurify 인스턴스를 반환한다.
 *
 * DOMPurify는 번들/런타임 형태에 따라 이미 `sanitize()`를 가진 인스턴스로
 * 들어오기도 하고, `window`를 받아 인스턴스를 만드는 factory로 들어오기도 한다.
 * 이 라이브러리는 브라우저용 패키지이므로 factory 형태에서는 현재 window를 주입한다.
 *
 * @returns DOMPurify sanitizer 인스턴스
 */
function getDomPurify(): DOMPurifyInstance {
  if (domPurifyInstance) {
    return domPurifyInstance;
  }

  if (typeof globalThis.window === 'undefined') {
    if (typeof DOMPurify.sanitize === 'function') {
      return DOMPurify;
    }

    throw new Error('sanitizeSvgStrict: DOMPurify를 초기화하려면 window 객체가 필요합니다.');
  }

  domPurifyInstance = DOMPurify(globalThis.window);
  return domPurifyInstance;
}

/**
 * 입력 SVG 문자열에서 DOCTYPE/ENTITY 선언, BOM, XML 선언, HTML 주석을 제거한다.
 *
 * `<metadata>` 요소는 정규식으로는 안전하게 제거할 수 없으므로(중첩 케이스에서
 * 비탐욕 매칭이 깨지는 문제) 여기서는 다루지 않고 후처리(postProcessSanitized)에서
 * DOM 기반으로 제거한다.
 *
 * DOCTYPE 제거는 quoted `]>` 같은 까다로운 케이스에서도 잔여물이 남지 않도록
 * "DOCTYPE 시작부터 다음 SVG 루트 시작 또는 문서 끝까지"를 한 번에 절단한다.
 *
 * @param svg 원본 SVG 문자열
 * @param warnings 경고 누적 배열 — DOCTYPE/ENTITY 발견 시 메시지가 추가된다
 * @returns 전처리가 적용된 SVG 문자열
 */
function preprocessSvgInput(svg: string, warnings: string[]): string {
  let result = svg;

  // BOM 제거
  if (result.charCodeAt(0) === 0xfeff) {
    result = result.slice(1);
  }

  // DOCTYPE / ENTITY 선언 검출 및 제거 (XXE 우려)
  // 대소문자 무관하게 매칭하며 발견 시 경고를 남긴다
  const hasDoctype = /<!DOCTYPE\b/i.test(result);
  const hasEntity = /<!ENTITY\b/i.test(result);

  if (hasDoctype) {
    warnings.push('XXE 우려로 DOCTYPE 선언이 제거되었습니다.');
  }
  if (hasEntity) {
    warnings.push('XXE 우려로 ENTITY 선언이 제거되었습니다.');
  }

  // <!DOCTYPE 부터 첫 <svg 루트 시작 직전까지 (대소문자 무관) 모두 제거.
  // 이 패턴은 internal subset 안의 quoted "]>"나 임의의 텍스트가 있어도
  // SVG 루트 시작점을 기준으로 절단하므로 잔여물이 남지 않는다.
  result = result.replace(/<!DOCTYPE\b[\s\S]*?(?=<svg\b|$)/gi, '');
  // 위 패턴이 SVG 루트 외부의 ENTITY까지 함께 잡지만,
  // 루트 내부에 단독으로 등장한 <!ENTITY ...> 선언은 별도로 정리한다.
  result = result.replace(/<!ENTITY\b[^>]*>/gi, '');

  // XML 선언 제거 (<?xml ... ?>)
  result = result.replace(/<\?xml\b[\s\S]*?\?>/gi, '');

  // HTML 주석 제거 (<!-- ... -->)
  result = result.replace(/<!--[\s\S]*?-->/g, '');

  return result;
}

/**
 * 사용자 domPurifyConfig에서 보안 핵심 키를 제거하고 덮어쓰기 시도를 warnings에 기록한다.
 *
 * @param userConfig 사용자가 전달한 DOMPurify 설정 (없으면 빈 객체로 처리)
 * @param warnings 경고 누적 배열
 * @returns 보안 키가 제거된 안전한 사용자 설정 사본
 */
function sanitizeUserConfig(userConfig: Config | undefined, warnings: string[]): Config {
  if (!userConfig) {
    return {};
  }

  const safeUserConfig: Config = { ...userConfig };
  for (const key of FORBIDDEN_OVERRIDE_KEYS) {
    if (key in safeUserConfig) {
      warnings.push(`보안 정책 키 "${key}" 덮어쓰기 시도가 무시되었습니다. 라이브러리 기본값이 강제됩니다.`);
      delete safeUserConfig[key];
    }
  }

  return safeUserConfig;
}

/**
 * 사용자 설정과 라이브러리 강제 설정을 병합해 최종 DOMPurify 설정을 생성한다.
 *
 * 강제 설정은 사용자 설정 위에 덮어써져 항상 우선 적용된다.
 * FORBID_TAGS와 FORBID_ATTR는 사용자 값과 라이브러리 강제 값을 병합한다.
 *
 * @param userConfig 사용자 설정 (보안 키가 이미 제거된 상태)
 * @returns 최종 DOMPurify 설정
 */
function buildFinalConfig(userConfig: Config): Config {
  // 라이브러리가 강제하는 보안 핵심 설정
  const forcedTags = ['script', 'foreignObject'];
  const forcedAttrs = ['on*'];
  const userForbidTags = Array.isArray(userConfig.FORBID_TAGS) ? userConfig.FORBID_TAGS : [];
  const userForbidAttrs = Array.isArray(userConfig.FORBID_ATTR) ? userConfig.FORBID_ATTR : [];
  const mergedForbidTags = Array.from(new Set([...userForbidTags, ...forcedTags]));
  const mergedForbidAttrs = Array.from(new Set([...userForbidAttrs, ...forcedAttrs]));

  return {
    ...userConfig,
    USE_PROFILES: { svg: true, svgFilters: true },
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
    IN_PLACE: false,
    KEEP_CONTENT: false,
    FORBID_TAGS: mergedForbidTags,
    FORBID_ATTR: mergedForbidAttrs,
    SAFE_FOR_XML: true,
    WHOLE_DOCUMENT: false,
  };
}

/**
 * URI 속성에서 허용할 수 있는 내부 참조인지 판정한다.
 *
 * strict sanitizer는 외부 로딩과 canvas taint를 줄이기 위해 `#id` 형태의
 * 문서 내부 프래그먼트 참조만 보존한다.
 *
 * @param value URI 속성값
 * @returns 내부 프래그먼트 참조이면 true
 */
function isSafeInternalReference(value: string): boolean {
  return value.trim().startsWith('#');
}

/**
 * strict sanitizer의 href/xlink:href/src 값에 보존 정책을 적용한다.
 *
 * - 안전한 raster `data:image/*`는 원본 그대로 보존
 * - `data:image/svg+xml`은 nested SVG를 strict sanitizer로 재귀 정제한 뒤
 *   `data:image/svg+xml;base64,...`로 재인코딩 (`MAX_NESTED_SVG_DEPTH` 깊이 제한)
 * - 그 외에는 내부 프래그먼트(`#id`)만 허용하고 나머지는 제거 의도(null) 반환
 *
 * @param value 원본 속성값
 * @param options 부모 sanitizer 옵션 (nested 호출에 그대로 전파)
 * @param depth 현재 재귀 깊이
 * @returns 새 속성값 또는 null(속성 제거)
 */
function sanitizeStrictUriValue(
  value: string,
  options: StrictSvgSanitizerOptions | undefined,
  depth: number
): string | null {
  if (isSafeRasterDataImageRef(value)) {
    return value;
  }

  if (isSvgDataImageRef(value)) {
    if (depth >= MAX_NESTED_SVG_DEPTH) return null;
    const nestedSvg = decodeSvgDataImageRef(value);
    if (!nestedSvg) return null;
    const sanitizedNestedSvg = sanitizeSvgStrictCore(nestedSvg, options, depth + 1).svg;
    return encodeSvgDataImageRef(sanitizedNestedSvg);
  }

  return isSafeInternalReference(value) ? value : null;
}

/**
 * CSS url() 값에서 허용할 수 있는 내부 참조인지 판정한다.
 *
 * @param value url(...) 내부 값
 * @returns 내부 프래그먼트 참조이면 true
 */
function isSafeCssUrl(value: string): boolean {
  return isSafeInternalReference(value.replace(/^['"]|['"]$/g, ''));
}

/**
 * 같은 경고가 반복 삽입되지 않도록 warnings 배열에 한 번만 추가한다.
 *
 * @param warnings 경고 누적 배열
 * @param warning 추가할 경고 문구
 */
function pushUniqueWarning(warnings: string[], warning: string): void {
  if (!warnings.includes(warning)) {
    warnings.push(warning);
  }
}

/**
 * CSS escape를 정책 비교용 문자열로 복원한다.
 *
 * 브라우저 CSS 파서는 `u\72l(...)` 같은 escape를 `url(...)`로 해석할 수 있으므로,
 * 위험 함수 판정 전에 최소한의 CSS escape 디코딩을 수행한다.
 *
 * @param css CSS 문자열
 * @returns 정책 비교용으로 CSS escape가 복원된 문자열
 */
function decodeCssEscapesForPolicy(css: string): string {
  return css.replace(/\\([0-9a-f]{1,6}\s?|.)/gi, (_match, escaped: string) => {
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
 * CSS 값 내부에 외부 URL 문자열이 직접 포함되어 있는지 판정한다.
 *
 * `image-set("https://...")`처럼 `url(...)`을 쓰지 않는 CSS 함수도 외부 리소스를
 * 로드할 수 있으므로, strict sanitizer는 CSS 값 안의 명시적인 외부 URL 문자열을
 * 보수적으로 제거한다.
 *
 * @param css CSS 문자열
 * @returns 외부 URL 문자열이 있으면 true
 */
function hasExternalUrlLiteral(css: string): boolean {
  return /(?:https?:|file:|data:|blob:|ftp:|\/\/)/i.test(css);
}

/**
 * CSS image-set 계열 함수 패턴.
 *
 * 상대 경로도 외부 리소스로 해석될 수 있으므로 함수 전체를 제거한다.
 */
const CSS_IMAGE_SET_FUNCTION_PATTERN = /(?:-webkit-)?image-set\s*\([^)]*\)/gi;

/**
 * 속성값에 CSS URL 정책을 적용해야 하는지 판정한다.
 *
 * @param attribute 검사 대상 속성
 * @returns CSS 정제 대상 속성이면 true
 */
function shouldSanitizeCssAttribute(attribute: Attr): boolean {
  const name = attribute.name.toLowerCase();
  const localName = attribute.localName.toLowerCase();

  return (
    name === 'style' || CSS_URL_PRESENTATION_ATTRIBUTES.has(name) || CSS_URL_PRESENTATION_ATTRIBUTES.has(localName)
  );
}

/**
 * style 속성 또는 `<style>` 본문에서 외부 참조와 위험 CSS 구문을 제거한다.
 *
 * CSS 파서는 환경별 차이가 있어 여기서는 strict sanitizer의 필수 차단 항목만
 * 보수적인 문자열 정책으로 제거한다. `url(#id)` 같은 내부 참조만 보존하고,
 * `image-set("https://...")`처럼 외부 URL 문자열을 직접 받는 CSS 함수는
 * 속성/본문 단위로 제거한다.
 *
 * @param css CSS 문자열
 * @returns 위험 참조가 제거된 CSS 문자열
 */
function sanitizeCssValue(css: string): string {
  const decodedForPolicy = decodeCssEscapesForPolicy(css);
  const hasDecodedDangerousCss =
    decodedForPolicy !== css &&
    (/@import\b/i.test(decodedForPolicy) ||
      /expression\s*\(/i.test(decodedForPolicy) ||
      /-moz-binding\s*:/i.test(decodedForPolicy) ||
      /url\s*\(/i.test(decodedForPolicy) ||
      /(?:-webkit-)?image-set\s*\(/i.test(decodedForPolicy) ||
      hasExternalUrlLiteral(decodedForPolicy));

  if (hasDecodedDangerousCss) {
    return '';
  }

  const sanitizedCss = css
    .replace(/@import\b[^;]*(?:;|$)/gi, '')
    .replace(CSS_IMAGE_SET_FUNCTION_PATTERN, '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/-moz-binding\s*:[^;]*(?:;|$)/gi, '')
    .replace(/url\s*\(\s*("([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi, (match, _raw, doubleQuoted, singleQuoted, unquoted) => {
      const urlValue = doubleQuoted ?? singleQuoted ?? unquoted ?? '';
      return isSafeCssUrl(urlValue) ? match : 'none';
    });

  return hasExternalUrlLiteral(sanitizedCss) ? '' : sanitizedCss;
}

/**
 * DOMPurify 정제 전에 입력에 포함된 위험 정책 패턴을 경고로 수집한다.
 *
 * 실제 제거는 DOMPurify와 후처리 단계가 담당한다. 이 함수는 DOMPurify가 먼저
 * 위험 속성/요소를 제거해 후처리에서 변경 사실을 관찰하지 못하는 경우에도
 * detailed API가 입력의 위험 신호를 알려줄 수 있게 하는 진단용 로직이다.
 *
 * @param svg 전처리된 SVG 문자열
 * @param warnings 경고 누적 배열
 */
function collectInputPolicyWarnings(svg: string, warnings: string[]): void {
  if (typeof DOMParser === 'undefined' || !svg.trim()) {
    return;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.tagName === 'parsererror' || root.querySelector('parsererror')) {
    return;
  }

  const elements = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const element of elements) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const localName = attribute.localName.toLowerCase();

      if (name.startsWith('on') || localName.startsWith('on')) {
        pushUniqueWarning(warnings, '이벤트 핸들러 속성이 제거되었습니다.');
        continue;
      }

      if (name === 'href' || name === 'xlink:href' || name === 'src' || localName === 'href' || localName === 'src') {
        // 새 정책에서 안전한 data:image/* 참조는 보존되거나 nested sanitize 후 보존되므로 false-positive 경고를 내지 않는다.
        // nested SVG 안의 위험 요소 제거는 enforceStrictDomPolicy에서 별도 경고로 보고된다.
        if (
          !isSafeInternalReference(attribute.value) &&
          !isSafeRasterDataImageRef(attribute.value) &&
          !isSvgDataImageRef(attribute.value)
        ) {
          pushUniqueWarning(warnings, '외부 URI 참조 속성이 제거되었습니다.');
        }
        continue;
      }

      if (
        attribute.value &&
        shouldSanitizeCssAttribute(attribute) &&
        sanitizeCssValue(attribute.value).trim() !== attribute.value.trim()
      ) {
        pushUniqueWarning(warnings, '위험 CSS 구문 또는 외부 CSS URL 참조가 제거되었습니다.');
      }
    }
  }

  for (const styleElement of Array.from(root.querySelectorAll('style'))) {
    const css = styleElement.textContent ?? '';
    if (sanitizeCssValue(css) !== css) {
      pushUniqueWarning(warnings, '위험 CSS 구문 또는 외부 CSS URL 참조가 제거되었습니다.');
    }
  }
}

/**
 * DOMPurify 결과에 라이브러리 강제 strict 정책을 한 번 더 적용한다.
 *
 * 사용자 DOMPurify 설정이나 DOMPurify 기본 프로필 변화가 있더라도 다음 항목은 항상 제거한다.
 * - on* 이벤트 핸들러 속성
 * - 외부 `href`, `xlink:href`, `src` 참조
 * - CSS 속성값과 `<style>` 본문의 외부 `url()`, `image-set()`, `@import`, `expression()`, `-moz-binding`
 *
 * @param root 후처리 대상 SVG 루트
 * @param warnings 경고 누적 배열
 */
function enforceStrictDomPolicy(
  root: Element,
  warnings: string[],
  options: StrictSvgSanitizerOptions | undefined,
  depth: number
): void {
  const elements = [root, ...Array.from(root.querySelectorAll('*'))];

  for (const element of elements) {
    if (element !== root && ['foreignobject', 'script'].includes(element.localName.toLowerCase())) {
      element.parentNode?.removeChild(element);
      pushUniqueWarning(warnings, '위험 SVG 요소가 제거되었습니다.');
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const localName = attribute.localName.toLowerCase();

      if (name.startsWith('on') || localName.startsWith('on')) {
        element.removeAttribute(attribute.name);
        pushUniqueWarning(warnings, '이벤트 핸들러 속성이 제거되었습니다.');
        continue;
      }

      if (name === 'href' || name === 'xlink:href' || name === 'src' || localName === 'href' || localName === 'src') {
        const sanitizedValue = sanitizeStrictUriValue(attribute.value, options, depth);
        if (sanitizedValue === null) {
          element.removeAttribute(attribute.name);
          pushUniqueWarning(warnings, '외부 URI 참조 속성이 제거되었습니다.');
        } else if (sanitizedValue !== attribute.value) {
          element.setAttribute(attribute.name, sanitizedValue);
          pushUniqueWarning(warnings, 'data:image/svg+xml 참조가 nested sanitizer로 정제되었습니다.');
        }
        continue;
      }

      if (attribute.value && shouldSanitizeCssAttribute(attribute)) {
        const sanitizedAttributeValue = sanitizeCssValue(attribute.value).trim();
        const wasChanged = sanitizedAttributeValue !== attribute.value.trim();
        if (sanitizedAttributeValue) {
          element.setAttribute(attribute.name, sanitizedAttributeValue);
        } else {
          element.removeAttribute(attribute.name);
        }
        if (wasChanged) {
          pushUniqueWarning(warnings, '위험 CSS 구문 또는 외부 CSS URL 참조가 제거되었습니다.');
        }
      }
    }
  }

  for (const styleElement of Array.from(root.querySelectorAll('style'))) {
    const originalCss = styleElement.textContent ?? '';
    const sanitizedCss = sanitizeCssValue(originalCss);
    styleElement.textContent = sanitizedCss;
    if (sanitizedCss !== originalCss) {
      pushUniqueWarning(warnings, '위험 CSS 구문 또는 외부 CSS URL 참조가 제거되었습니다.');
    }
  }
}

/**
 * 정제된 SVG 문자열을 DOMParser로 한 번 파싱해 후처리를 일괄 수행한다.
 *
 * 다음 작업을 한 번의 파싱으로 처리한다:
 *   1. 파서 에러(parsererror)면 빈 결과로 간주 (svg='', nodeCount=0)
 *   2. removeMetadata=true 이면 모든 `<metadata>` 요소를 DOM 트리에서 제거 (중첩 포함)
 *   3. 루트의 모든 자손 Element 개수를 카운트
 *   4. metadata가 실제로 제거된 경우에만 XMLSerializer로 다시 직렬화한 결과를 반환,
 *      그렇지 않으면 원본 sanitized 문자열을 그대로 반환
 *
 * @param sanitizedSvg DOMPurify 정제 후 SVG 문자열
 * @param removeMetadata `<metadata>` 요소 제거 여부
 * @param warnings 경고 누적 배열
 * @returns 후처리된 SVG 문자열과 자손 Element 개수
 */
function postProcessSanitized(
  sanitizedSvg: string,
  removeMetadata: boolean,
  warnings: string[],
  options: StrictSvgSanitizerOptions | undefined,
  depth: number
): { svg: string; nodeCount: number } {
  // 빈 결과인 경우 즉시 반환
  if (!sanitizedSvg.trim()) {
    return { svg: '', nodeCount: 0 };
  }

  const parser = new DOMParser();
  // image/svg+xml 으로 파싱하면 루트가 SVG 요소가 된다
  const doc = parser.parseFromString(sanitizedSvg, 'image/svg+xml');
  const root = doc.documentElement;

  // 루트가 없는 경우 0으로 간주
  if (!root) {
    return { svg: '', nodeCount: 0 };
  }

  // 파서 에러 처리 — 브라우저와 happy-dom의 표현 형태가 다르므로 두 조건을 OR로 둔다.
  if (root.tagName === 'parsererror' || root.querySelector('parsererror')) {
    return { svg: '', nodeCount: 0 };
  }

  // strict sanitizer의 반환 계약은 SVG 루트 문자열이다. WHOLE_DOCUMENT 같은
  // 설정 변화나 파서 보정으로 루트가 SVG가 아니면 fail-closed 처리한다.
  if (root.localName.toLowerCase() !== 'svg') {
    return { svg: '', nodeCount: 0 };
  }

  // DOMPurify 결과에 strict sanitizer 강제 정책을 재적용한다.
  enforceStrictDomPolicy(root, warnings, options, depth);

  // metadata 제거 — 중첩 케이스도 DOM 트리 순회로 안전하게 처리
  if (removeMetadata) {
    const metadataNodes = root.querySelectorAll('metadata');
    if (metadataNodes.length > 0) {
      for (const node of Array.from(metadataNodes)) {
        node.parentNode?.removeChild(node);
      }
      pushUniqueWarning(warnings, '<metadata> 요소가 제거되었습니다.');
    }
  }

  // 자손 Element 카운트 (루트 자체는 제외)
  const nodeCount = root.querySelectorAll('*').length;

  // 강제 후처리 결과를 반영하기 위해 항상 다시 직렬화한다.
  const svg = new XMLSerializer().serializeToString(root);

  return { svg, nodeCount };
}

/**
 * 입력 SVG의 UTF-8 바이트 크기가 maxBytes를 초과하면 Error를 던진다.
 *
 * @param svg 입력 SVG 문자열
 * @param maxBytes 최대 허용 바이트
 */
function assertWithinMaxBytes(svg: string, maxBytes: number): void {
  // TextEncoder는 브라우저와 happy-dom 모두에서 사용 가능
  const byteLength = new TextEncoder().encode(svg).byteLength;
  if (byteLength > maxBytes) {
    const limitMb = Math.round(maxBytes / (1024 * 1024));
    throw new Error(
      `SVG 입력 크기(${byteLength} bytes)가 최대 허용치(${maxBytes} bytes, 약 ${limitMb}M)를 초과했습니다.`
    );
  }
}

/**
 * 사용자 제한 옵션이 DoS 방어를 비활성화하지 않도록 검증한다.
 *
 * @param name 옵션 이름
 * @param value 옵션 값
 * @param minimum 최소 허용값
 */
function assertSafeIntegerLimit(name: string, value: number, minimum: number): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${name} 옵션은 ${minimum} 이상의 안전한 정수여야 합니다.`);
  }
}

/**
 * 공통 정제 로직: 전처리 → DOMPurify 정제 → 노드 개수 검증.
 *
 * sanitizeSvgStrict 와 sanitizeSvgStrictDetailed 가 공유하는 핵심 구현이다.
 *
 * @param svg 입력 SVG 문자열
 * @param options sanitizer 옵션
 * @returns 정제된 SVG와 경고 목록
 */
function sanitizeSvgStrictCore(
  svg: string,
  options: StrictSvgSanitizerOptions | undefined,
  recursionDepth = 0
): SanitizeSvgStrictDetailedResult {
  // 1. 입력 타입 검증
  if (typeof svg !== 'string') {
    throw new TypeError('sanitizeSvgStrict: 입력은 string 타입이어야 합니다.');
  }

  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxNodeCount = options?.maxNodeCount ?? DEFAULT_MAX_NODE_COUNT;
  const removeMetadata = options?.removeMetadata ?? false;

  assertSafeIntegerLimit('maxBytes', maxBytes, 1);
  assertSafeIntegerLimit('maxNodeCount', maxNodeCount, 0);

  // 2. 입력 바이트 크기 검증
  assertWithinMaxBytes(svg, maxBytes);

  const warnings: string[] = [];

  // 3. 전처리 (DOCTYPE/ENTITY/BOM/XML 선언/주석 제거)
  //    `<metadata>` 제거는 정규식으로 안전하게 처리할 수 없어
  //    후처리(postProcessSanitized) 단계에서 DOM 기반으로 다룬다.
  const preprocessed = preprocessSvgInput(svg, warnings);
  collectInputPolicyWarnings(preprocessed, warnings);

  // 4. 사용자 DOMPurify 설정에서 보안 키 제거
  const safeUserConfig = sanitizeUserConfig(options?.domPurifyConfig, warnings);

  // 5. 최종 DOMPurify 설정 빌드 (라이브러리 강제 정책 우선)
  const finalConfig = buildFinalConfig(safeUserConfig);

  // 6. DOMPurify 정제 — RETURN_TRUSTED_TYPE: false 이므로 string 반환이 보장된다.
  //    DOMPurify.sanitize의 반환 타입은 설정에 따라 string | TrustedHTML 등으로
  //    유니온이지만, 위 finalConfig가 RETURN_TRUSTED_TYPE=false 를 강제하므로
  //    런타임 값은 항상 string이다. 타입 단언은 그 사실을 반영한다.
  const sanitized = getDomPurify().sanitize(preprocessed, finalConfig) as string;

  // 7. 후처리 — DOMParser로 한 번 파싱해서 metadata 제거, parsererror 처리, 노드 개수 카운트를 일괄 수행
  const { svg: finalSvg, nodeCount } = postProcessSanitized(
    sanitized,
    removeMetadata,
    warnings,
    options,
    recursionDepth
  );
  if (nodeCount > maxNodeCount) {
    throw new Error(`정제 후 SVG 노드 개수(${nodeCount})가 최대 허용치(${maxNodeCount})를 초과했습니다.`);
  }

  return {
    svg: finalSvg,
    warnings,
  };
}

/**
 * DOMPurify 기반 strict SVG sanitizer.
 *
 * 신뢰할 수 없는 SVG에서 XSS 벡터, 위험 태그, 위험 속성, 외부 리소스 참조를
 * 정의된 strict 정책에 따라 제거한 SVG 문자열을 반환한다.
 *
 * @param svg 입력 SVG 문자열
 * @param options sanitizer 옵션
 * @returns 정제된 SVG 문자열
 *
 * @throws {TypeError} svg가 문자열이 아닌 경우
 * @throws {Error} 입력 바이트 크기가 maxBytes를 초과하거나 정제 후 노드 개수가 maxNodeCount를 초과하는 경우
 */
export function sanitizeSvgStrict(svg: string, options?: StrictSvgSanitizerOptions): string {
  return sanitizeSvgStrictCore(svg, options).svg;
}

/**
 * DOMPurify 기반 strict SVG sanitizer (상세 결과 반환).
 *
 * sanitizeSvgStrict()와 동일하게 정제를 수행하되, 정제된 SVG와 함께
 * 정제 과정에서 발생한 경고 목록을 반환한다.
 *
 * 경고 목록에는 라이브러리가 사전/후처리한 항목(DOCTYPE/ENTITY 제거, 사용자 설정 충돌,
 * 후처리 정책에 따른 위험 속성/참조 제거)이 포함되며 DOMPurify 자체의 removed 배열은 노출하지 않는다.
 *
 * @param svg 입력 SVG 문자열
 * @param options sanitizer 옵션
 * @returns 정제된 SVG와 경고 목록을 담은 객체
 *
 * @throws {TypeError} svg가 문자열이 아닌 경우
 * @throws {Error} 입력 바이트 크기가 maxBytes를 초과하거나 정제 후 노드 개수가 maxNodeCount를 초과하는 경우
 */
export function sanitizeSvgStrictDetailed(
  svg: string,
  options?: StrictSvgSanitizerOptions
): SanitizeSvgStrictDetailedResult {
  return sanitizeSvgStrictCore(svg, options);
}
