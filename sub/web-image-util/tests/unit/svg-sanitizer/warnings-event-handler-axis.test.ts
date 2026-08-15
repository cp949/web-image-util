/**
 * 입력 단계 진단 경고(collectInputPolicyWarnings)의 이벤트 핸들러 속성 판정 축 테스트.
 *
 * 이 판정은 위협 정책 leaf(isEventHandlerAttributeName)를 단일 기준으로 삼아야 한다.
 * 과거에는 이 경로가 leaf보다 넓은 startsWith('on') 검사를 인라인으로 복제해,
 * 속성명 "on" 단독처럼 실제로는 이벤트 핸들러가 아닌 값에도 경고를 잘못 보고했다.
 */

import { describe, expect, it } from 'vitest';

import { collectInputPolicyWarnings } from '../../../src/svg-sanitizer/warnings.internal';
import { isEventHandlerAttributeName } from '../../../src/utils/svg-threat-policy.internal';

const EVENT_HANDLER_WARNING = '이벤트 핸들러 속성이 제거되었습니다.';

interface EventHandlerAxisCase {
  label: string;
  attrName: string;
  warned: boolean;
}

const EVENT_HANDLER_AXIS_CASES: EventHandlerAxisCase[] = [
  { label: '표준 이벤트 핸들러(onclick)', attrName: 'onclick', warned: true },
  { label: '대소문자 혼합(ONCLICK)', attrName: 'ONCLICK', warned: true },
  { label: '"on" 단독 — leaf가 이벤트 핸들러로 보지 않는 경계값', attrName: 'on', warned: false },
  { label: '무관한 속성(fill)', attrName: 'fill', warned: false },
];

/** 속성 하나만 가진 SVG를 진단 경고 수집기에 넣어 특정 경고 발생 여부를 확인한다. */
function hasEventHandlerWarning(attrName: string): boolean {
  const warnings: string[] = [];
  collectInputPolicyWarnings(`<svg xmlns="http://www.w3.org/2000/svg"><rect ${attrName}="x"/></svg>`, warnings);
  return warnings.includes(EVENT_HANDLER_WARNING);
}

describe('입력 단계 이벤트 핸들러 경고 축 특성화 표', () => {
  it.each(EVENT_HANDLER_AXIS_CASES)('$label의 leaf 판정과 공개 경고 출력이 일치한다', ({ attrName, warned }) => {
    expect(isEventHandlerAttributeName(attrName)).toBe(warned);
    expect(hasEventHandlerWarning(attrName)).toBe(warned);
  });
});
