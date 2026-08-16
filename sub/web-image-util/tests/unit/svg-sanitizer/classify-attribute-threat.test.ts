/**
 * classifyAttributeThreat()의 분기 순서·배타성을 고정하는 특성화 표.
 *
 * enforceStrictDomPolicy와 collectInputPolicyWarnings가 각자 손으로 짜던
 * event-handler → reference → css 분기 순서를 이 함수 하나로 옮긴다.
 * event-handler 판정만 두 소비자가 서로 다른 predicate(광의/협의)를 쓰므로
 * 주입받는다 — 나머지 두 카테고리는 이미 공유되는 리프 판정을 그대로 쓴다.
 */

import { describe, expect, it } from 'vitest';

import { classifyAttributeThreat } from '../../../src/svg-sanitizer/classify-attribute-threat.internal';
import { isEventHandlerAttributeName } from '../../../src/utils/svg-threat-policy.internal';

/** enforceStrictDomPolicy가 쓰는 방어적 광의 판정 — "on" 접두 전체를 잡는다. */
function broadEventHandlerPredicate(attribute: Attr): boolean {
  return attribute.name.toLowerCase().startsWith('on') || attribute.localName.toLowerCase().startsWith('on');
}

/** warnings.internal.ts가 쓰는 협의 판정 — 위협 정책 leaf 그대로 위임한다. */
function narrowEventHandlerPredicate(attribute: Attr): boolean {
  return isEventHandlerAttributeName(attribute.name);
}

/** SVG 조각을 파싱해 최상위 자식 요소와 그 첫 attribute를 돌려준다. */
function parseFirstAttribute(svg: string): { element: Element; attribute: Attr } {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const element = doc.documentElement.firstElementChild ?? doc.documentElement;
  const attribute = element.attributes[0];
  if (!attribute) {
    throw new Error('테스트 fixture에 attribute가 없다.');
  }
  return { element, attribute };
}

describe('classifyAttributeThreat()', () => {
  it('광의 predicate 사용 시 "on" 단독 속성도 event-handler로 분류한다', () => {
    const { element, attribute } = parseFirstAttribute('<svg xmlns="http://www.w3.org/2000/svg"><rect on="x"/></svg>');
    expect(classifyAttributeThreat(element, attribute, broadEventHandlerPredicate)).toEqual({ kind: 'event-handler' });
  });

  it('협의 predicate 사용 시 "on" 단독 속성은 event-handler가 아니다', () => {
    const { element, attribute } = parseFirstAttribute('<svg xmlns="http://www.w3.org/2000/svg"><rect on="x"/></svg>');
    expect(classifyAttributeThreat(element, attribute, narrowEventHandlerPredicate)).toEqual({ kind: 'none' });
  });

  it('표준 이벤트 핸들러(onclick)는 두 predicate 모두에서 event-handler다', () => {
    const { element, attribute } = parseFirstAttribute(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="x"/></svg>'
    );
    expect(classifyAttributeThreat(element, attribute, broadEventHandlerPredicate)).toEqual({ kind: 'event-handler' });
    expect(classifyAttributeThreat(element, attribute, narrowEventHandlerPredicate)).toEqual({ kind: 'event-handler' });
  });

  it('event-handler 판정이 참조 판정보다 분기 순서상 우선한다', () => {
    const { element, attribute } = parseFirstAttribute(
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="a.png"/></svg>'
    );
    expect(classifyAttributeThreat(element, attribute, () => true)).toEqual({ kind: 'event-handler' });
  });

  it('외부 URL을 참조하는 href는 reason과 함께 reference로 분류한다', () => {
    const { element, attribute } = parseFirstAttribute(
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/a.png"/></svg>'
    );
    expect(classifyAttributeThreat(element, attribute, narrowEventHandlerPredicate)).toEqual({
      kind: 'reference',
      reason: 'external',
    });
  });

  it('내부 fragment href는 reason internal-fragment로 reference 분류한다', () => {
    const { element, attribute } = parseFirstAttribute(
      '<svg xmlns="http://www.w3.org/2000/svg"><use href="#frag"/></svg>'
    );
    expect(classifyAttributeThreat(element, attribute, narrowEventHandlerPredicate)).toEqual({
      kind: 'reference',
      reason: 'internal-fragment',
    });
  });

  it('presentation 속성(fill)의 CSS 값은 css로 분류한다', () => {
    const { element, attribute } = parseFirstAttribute(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(https://evil.example/x)"/></svg>'
    );
    expect(classifyAttributeThreat(element, attribute, narrowEventHandlerPredicate)).toEqual({ kind: 'css' });
  });

  it('style 속성은 값이 있으면 css로 분류한다', () => {
    const { element, attribute } = parseFirstAttribute(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect style="color:red"/></svg>'
    );
    expect(classifyAttributeThreat(element, attribute, narrowEventHandlerPredicate)).toEqual({ kind: 'css' });
  });

  it('빈 값인 style 속성은 css로 분류하지 않는다', () => {
    const { element, attribute } = parseFirstAttribute(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect style=""/></svg>'
    );
    expect(classifyAttributeThreat(element, attribute, narrowEventHandlerPredicate)).toEqual({ kind: 'none' });
  });

  it('세 카테고리에 해당하지 않는 속성은 none으로 분류한다', () => {
    const { element, attribute } = parseFirstAttribute(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100"/></svg>'
    );
    expect(classifyAttributeThreat(element, attribute, narrowEventHandlerPredicate)).toEqual({ kind: 'none' });
  });
});
