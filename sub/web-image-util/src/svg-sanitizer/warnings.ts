/**
 * 경고 누적 헬퍼와 입력 단계의 정책 위반 진단.
 *
 * `pushUniqueWarning`은 같은 메시지가 반복 삽입되지 않도록 하는 단순 헬퍼이고,
 * `collectInputPolicyWarnings`는 DOMPurify가 위험 속성/요소를 먼저 제거해
 * 후처리에서 변경 사실을 관찰하지 못하는 경우에도 detailed API가 입력의 위험
 * 신호를 알려줄 수 있게 하는 진단용 로직이다.
 */

import { isSafeRasterDataImageRef, isSvgDataImageRef } from '../utils/svg-data-url-policy';
import { sanitizeCssValue, shouldSanitizeCssAttribute } from './css-policy';
import { isSafeInternalReference } from './reference-policy';

/**
 * 같은 경고가 반복 삽입되지 않도록 warnings 배열에 한 번만 추가한다.
 *
 * @param warnings 경고 누적 배열
 * @param warning 추가할 경고 문구
 */
export function pushUniqueWarning(warnings: string[], warning: string): void {
  if (!warnings.includes(warning)) {
    warnings.push(warning);
  }
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
export function collectInputPolicyWarnings(svg: string, warnings: string[]): void {
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
