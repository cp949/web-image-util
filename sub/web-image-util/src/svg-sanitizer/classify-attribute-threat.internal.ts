/**
 * SVG attribute 하나가 어떤 위협 카테고리에 속하는지 판정하는 분기 순서의
 * 단일 소유자.
 *
 * `enforceStrictDomPolicy`(strict 집행 엔진)와 `collectInputPolicyWarnings`
 * (입력 진단)는 서로 다른 문서(DOMPurify 이전/이후)를 각자 순회하므로 순회
 * 자체는 합칠 수 없다. 하지만 "event-handler → reference → css" 분기 순서와
 * 배타성(`if`+`continue` 체인)은 두 파일이 손으로 각자 짜 왔고, 그 사실이
 * B1(속성명 "on" 경계값 divergence)의 원인이었다. 이 함수가 그 분기를 한 곳에
 * 모은다.
 *
 * event-handler 판정만 predicate로 주입받는다 — enforce-dom-policy는 의도적으로
 * `svg-threat-policy.internal.ts`의 leaf보다 넓은 방어적 검사를 쓰고
 * (`isEventHandlerAttributeName`을 호출하도록 통합하지 않는다), warnings는 그
 * leaf를 그대로 쓴다. 나머지 두 카테고리(reference, css)는 이미 두 소비자가
 * 같은 리프 판정을 쓰므로 이 함수가 직접 호출한다.
 */

import { isReferenceAttribute } from '../utils/svg-reference-attribute.internal';
import { classifyUriRef, type UriRefReason } from '../utils/svg-threat-policy.internal';
import { shouldSanitizeCssAttribute } from './css-policy.internal';

/**
 * attribute 하나의 위협 카테고리 판정 결과.
 *
 * `reference`만 `reason`을 함께 돌려준다 — 소비자별로 어떤 reason 집합을
 * 경고/제거 대상으로 볼지가 갈리기 때문이다(제거는 5종, 진단 경고 제외는 4종).
 */
export type AttributeThreatCategory =
  | { readonly kind: 'event-handler' }
  | { readonly kind: 'reference'; readonly reason: UriRefReason }
  | { readonly kind: 'css' }
  | { readonly kind: 'none' };

/**
 * attribute 하나를 event-handler → reference → css 순서로 판정한다.
 *
 * 순서는 계약의 일부다 — 세 카테고리는 서로 배타적이며, 먼저 매치된 카테고리가
 * 이긴다(현재 코드베이스에 실제 중복 매치 케이스는 없지만, 순서 자체를 한 곳에
 * 고정해 두 소비자가 다시 갈릴 여지를 없앤다).
 *
 * @param element attribute가 속한 요소 (참조 판정에 namespace 조회가 필요하다)
 * @param attribute 판정 대상 attribute
 * @param isEventHandlerAttribute event-handler 판정 predicate. 호출자가 자신의
 *   정책(광의/협의)을 주입한다.
 * @returns 위협 카테고리
 */
export function classifyAttributeThreat(
  element: Element,
  attribute: Attr,
  isEventHandlerAttribute: (attribute: Attr) => boolean
): AttributeThreatCategory {
  if (isEventHandlerAttribute(attribute)) {
    return { kind: 'event-handler' };
  }

  if (isReferenceAttribute(element, attribute.name)) {
    const { reason } = classifyUriRef(attribute.value, 'strict');
    return { kind: 'reference', reason };
  }

  if (attribute.value && shouldSanitizeCssAttribute(attribute)) {
    return { kind: 'css' };
  }

  return { kind: 'none' };
}
