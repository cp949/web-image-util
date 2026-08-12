/**
 * CSS 값(style 속성, 일부 presentation 속성, `<style>` 본문)에 대한
 * strict sanitizer 정책 어댑터.
 *
 * 판정과 정제(`sanitizeCssValue`)는 위협 정책 모듈
 * (`utils/svg-threat-policy.internal`)이 소유한다 — 두 집행 엔진이 같은
 * 함수를 소비한다. 이 모듈은 DOM `Attr` 기반의 대상 속성 판정만 남긴다.
 */

import { CSS_URL_PRESENTATION_ATTRIBUTES, sanitizeCssValue } from '../utils/svg-threat-policy.internal';

export { CSS_URL_PRESENTATION_ATTRIBUTES, sanitizeCssValue };

/**
 * 속성값에 CSS URL 정책을 적용해야 하는지 판정한다.
 *
 * @param attribute 검사 대상 속성
 * @returns CSS 정제 대상 속성이면 true
 */
export function shouldSanitizeCssAttribute(attribute: Attr): boolean {
  const name = attribute.name.toLowerCase();
  const localName = attribute.localName.toLowerCase();

  return (
    name === 'style' || CSS_URL_PRESENTATION_ATTRIBUTES.has(name) || CSS_URL_PRESENTATION_ATTRIBUTES.has(localName)
  );
}
