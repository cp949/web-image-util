/**
 * post-sanitize 단계에서 SVG 문자열의 위험한 콘텐츠를 재검증하는 intake guard다.
 *
 * `<script>` 태그, on* 이벤트 핸들러, href/src의 외부 참조, style/presentation
 * 속성의 CSS url() 참조를 검사해 위반 시 ImageProcessError를 던진다.
 *
 * 태그 순회와 속성값 추출은 lightweight 엔진과 공유하는
 * `svg-raw-tag-scan.internal`이 단일 소유하고, 참조 판정 규칙은
 * `svg-threat-policy.internal`이 소유한다.
 */

import { ImageProcessError } from '../../../types';
import { getCssPolicyValueVariants, visitCssUrlValues } from '../../../utils/svg-policy-utils.internal';
import { buildAttributeValuePatterns, SVG_START_TAG_PATTERN } from '../../../utils/svg-raw-tag-scan.internal';
import { CSS_URL_PRESENTATION_ATTRIBUTES, classifyUriRef } from '../../../utils/svg-threat-policy.internal';

/**
 * href/xlink:href/src 참조 속성을 따옴표 방식과 무관하게 찾아내는 정규식 3종.
 *
 * 태그 순회와 속성값 추출 자체는 lightweight 엔진과 공유하는
 * `svg-raw-tag-scan.internal`이 단일 소유한다.
 */
const REF_ATTRIBUTE_PATTERNS = buildAttributeValuePatterns(['(?:xlink:)?href', 'src']);

/**
 * presentation 속성(`fill`, `filter`, `mask` 등 11종)을 찾아내는 정규식 3종.
 *
 * lightweight 엔진이 실제로 정제하는 속성 이름 집합과 같은
 * `CSS_URL_PRESENTATION_ATTRIBUTES`를 쓴다 — 엔진이 정제하는 범위와 이
 * backstop이 재검증하는 범위가 다시 벌어지지 않도록 이름 집합 자체를 공유한다.
 * `style` 속성은 별도의 이스케이프 인지 정규식으로 이미 검사하므로 여기 포함하지
 * 않는다.
 */
const CSS_PRESENTATION_ATTRIBUTE_PATTERNS = buildAttributeValuePatterns([...CSS_URL_PRESENTATION_ATTRIBUTES]);

/**
 * 참조가 렌더 파이프라인 intake guard의 차단 대상인지 판정한다.
 *
 * 판정 규칙은 위협 정책 모듈이 소유한다 — guard는 위협으로 판정된 참조를 막는다.
 */
function isBlockedRef(ref: string): boolean {
  return classifyUriRef(ref, 'lightweight').verdict === 'threat';
}

/**
 * CSS url() 함수 내부에 외부 URL이나 상대 경로 참조가 있는지 확인한다.
 *
 * @param cssText 검사할 CSS 텍스트
 * @returns 위험한 참조가 있으면 true
 */
function hasDangerousUrlRef(cssText: string): boolean {
  let hasDangerousRef = false;
  visitCssUrlValues(cssText, (value) => {
    if (getCssPolicyValueVariants(value).some(isBlockedRef)) {
      hasDangerousRef = true;
    }
  });
  return hasDangerousRef;
}

type SvgUnsafeReason =
  | 'script-tag'
  | 'event-handler'
  | 'external-ref'
  | 'style-attribute-url'
  | 'style-tag-url'
  | 'presentation-attribute-url';

function throwUnsafeSvg(reason: SvgUnsafeReason): never {
  throw new ImageProcessError(`SVG content contains a forbidden construct: ${reason}`, 'INVALID_SOURCE', {
    details: { reason },
  });
}

/**
 * SVG 문자열에 위험한 콘텐츠가 포함되어 있는지 검사한다.
 *
 * 다음 항목이 발견되면 ImageProcessError를 던진다:
 *  - `<script` 태그 (대소문자 무관)
 *  - `onload`, `onclick` 등 `on*` 이벤트 핸들러 속성
 *  - href, xlink:href, src 속성에 외부 URL(http://, https://), 상대 경로(./, ../, /), javascript: URI가 있는 경우
 *  - style 속성이나 `<style>` 태그 내부에 외부 URL 또는 상대 경로를 담은 url() 참조가 있는 경우
 *  - `fill`, `filter`, `mask` 등 presentation 속성에 외부 URL 또는 상대 경로를 담은
 *    url() 참조가 있는 경우 — lightweight/strict 엔진이 실제로 정제하는 속성
 *    집합과 같은 이름 집합(`CSS_URL_PRESENTATION_ATTRIBUTES`)을 재검증한다
 *
 * @param svgString 검사할 SVG 문자열
 * @throws {ImageProcessError} 위험한 콘텐츠 발견 시
 */
export function assertSafeSvgContent(svgString: string): void {
  const lower = svgString.toLowerCase();

  // 1. <script 태그 차단
  if (lower.includes('<script')) {
    throwUnsafeSvg('script-tag');
  }

  // 2. onload / onclick 등 이벤트 핸들러 속성을 차단한다.
  if (/\son[a-z0-9:-]*\s*=/i.test(svgString)) {
    throwUnsafeSvg('event-handler');
  }

  // 3~4. 태그 내부 속성만 대상으로 외부 참조를 검사한다.
  const tagPattern = SVG_START_TAG_PATTERN;
  tagPattern.lastIndex = 0;
  let tagMatch: RegExpExecArray | null;
  tagMatch = tagPattern.exec(svgString);
  while (tagMatch !== null) {
    const attrs = tagMatch[2];

    REF_ATTRIBUTE_PATTERNS.doubleQuoted.lastIndex = 0;
    REF_ATTRIBUTE_PATTERNS.singleQuoted.lastIndex = 0;
    REF_ATTRIBUTE_PATTERNS.unquoted.lastIndex = 0;
    let refMatch: RegExpExecArray | null;
    refMatch = REF_ATTRIBUTE_PATTERNS.doubleQuoted.exec(attrs);
    while (refMatch !== null) {
      if (refMatch[2] && isBlockedRef(refMatch[2])) {
        throwUnsafeSvg('external-ref');
      }
      refMatch = REF_ATTRIBUTE_PATTERNS.doubleQuoted.exec(attrs);
    }
    refMatch = REF_ATTRIBUTE_PATTERNS.singleQuoted.exec(attrs);
    while (refMatch !== null) {
      if (refMatch[2] && isBlockedRef(refMatch[2])) {
        throwUnsafeSvg('external-ref');
      }
      refMatch = REF_ATTRIBUTE_PATTERNS.singleQuoted.exec(attrs);
    }
    refMatch = REF_ATTRIBUTE_PATTERNS.unquoted.exec(attrs);
    while (refMatch !== null) {
      if (refMatch[2] && isBlockedRef(refMatch[2])) {
        throwUnsafeSvg('external-ref');
      }
      refMatch = REF_ATTRIBUTE_PATTERNS.unquoted.exec(attrs);
    }

    // presentation 속성(fill/filter/mask 등)의 CSS url() 참조를 재검증한다 —
    // style 속성과 같은 위협 정책(hasDangerousUrlRef)을 쓰되, 이스케이프 인지는
    // 하지 않는다(엔진 자신도 이 속성군에는 같은 단순 패턴을 쓴다).
    CSS_PRESENTATION_ATTRIBUTE_PATTERNS.doubleQuoted.lastIndex = 0;
    CSS_PRESENTATION_ATTRIBUTE_PATTERNS.singleQuoted.lastIndex = 0;
    CSS_PRESENTATION_ATTRIBUTE_PATTERNS.unquoted.lastIndex = 0;
    let presentationMatch: RegExpExecArray | null;
    presentationMatch = CSS_PRESENTATION_ATTRIBUTE_PATTERNS.doubleQuoted.exec(attrs);
    while (presentationMatch !== null) {
      if (hasDangerousUrlRef(presentationMatch[2])) {
        throwUnsafeSvg('presentation-attribute-url');
      }
      presentationMatch = CSS_PRESENTATION_ATTRIBUTE_PATTERNS.doubleQuoted.exec(attrs);
    }
    presentationMatch = CSS_PRESENTATION_ATTRIBUTE_PATTERNS.singleQuoted.exec(attrs);
    while (presentationMatch !== null) {
      if (hasDangerousUrlRef(presentationMatch[2])) {
        throwUnsafeSvg('presentation-attribute-url');
      }
      presentationMatch = CSS_PRESENTATION_ATTRIBUTE_PATTERNS.singleQuoted.exec(attrs);
    }
    presentationMatch = CSS_PRESENTATION_ATTRIBUTE_PATTERNS.unquoted.exec(attrs);
    while (presentationMatch !== null) {
      if (hasDangerousUrlRef(presentationMatch[2])) {
        throwUnsafeSvg('presentation-attribute-url');
      }
      presentationMatch = CSS_PRESENTATION_ATTRIBUTE_PATTERNS.unquoted.exec(attrs);
    }

    const styleDoubleQuote = /\s+style\s*=\s*"((?:[^"\\]|\\.)*)"/gi;
    const styleSingleQuote = /\s+style\s*=\s*'((?:[^'\\]|\\.)*)'/gi;
    const styleUnquoted = /\s+style\s*=\s*(?!["'])([^\s>]+)/gi;
    let styleMatch: RegExpExecArray | null;
    styleMatch = styleDoubleQuote.exec(attrs);
    while (styleMatch !== null) {
      if (hasDangerousUrlRef(styleMatch[1])) {
        throwUnsafeSvg('style-attribute-url');
      }
      styleMatch = styleDoubleQuote.exec(attrs);
    }
    styleMatch = styleSingleQuote.exec(attrs);
    while (styleMatch !== null) {
      if (hasDangerousUrlRef(styleMatch[1])) {
        throwUnsafeSvg('style-attribute-url');
      }
      styleMatch = styleSingleQuote.exec(attrs);
    }
    styleMatch = styleUnquoted.exec(attrs);
    while (styleMatch !== null) {
      if (hasDangerousUrlRef(styleMatch[1])) {
        throwUnsafeSvg('style-attribute-url');
      }
      styleMatch = styleUnquoted.exec(attrs);
    }

    tagMatch = tagPattern.exec(svgString);
  }

  // <style> 태그 내부 콘텐츠의 url() 추출
  const styleTagPattern = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleTagMatch: RegExpExecArray | null;
  styleTagMatch = styleTagPattern.exec(svgString);
  while (styleTagMatch !== null) {
    const styleContent = styleTagMatch[1];
    if (hasDangerousUrlRef(styleContent)) {
      throwUnsafeSvg('style-tag-url');
    }
    styleTagMatch = styleTagPattern.exec(svgString);
  }
}
