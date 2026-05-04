/**
 * DOMPurify 결과 위에 라이브러리 강제 strict 정책을 다시 한 번 적용한다.
 *
 * 사용자 DOMPurify 설정이나 프로필 변화가 있더라도 다음 항목은 항상 제거한다.
 * - `<foreignObject>`, `<script>` 같은 위험 요소
 * - on* 이벤트 핸들러 속성
 * - 외부 `href`, `xlink:href`, `src` 참조 (nested SVG는 재귀 정제 후 보존)
 * - CSS 속성값과 `<style>` 본문의 외부 `url()`, `image-set()`, `@import`,
 *   `expression()`, `-moz-binding`
 */

import { sanitizeCssValue, shouldSanitizeCssAttribute } from './css-policy';
import { sanitizeStrictUriValue } from './reference-policy';
import type { NestedSanitize, StrictSvgSanitizerOptions } from './types';
import { pushUniqueWarning } from './warnings';

/**
 * DOMPurify 결과에 라이브러리 강제 strict 정책을 한 번 더 적용한다.
 *
 * @param root 후처리 대상 SVG 루트
 * @param warnings 경고 누적 배열
 * @param options 부모 sanitizer 옵션 (nested 호출에 그대로 전파)
 * @param depth 현재 재귀 깊이
 * @param nestedSanitize core가 주입하는 재귀 정제 함수
 */
export function enforceStrictDomPolicy(
  root: Element,
  warnings: string[],
  options: StrictSvgSanitizerOptions | undefined,
  depth: number,
  nestedSanitize: NestedSanitize
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
        const sanitizedValue = sanitizeStrictUriValue(attribute.value, options, depth, nestedSanitize);
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
