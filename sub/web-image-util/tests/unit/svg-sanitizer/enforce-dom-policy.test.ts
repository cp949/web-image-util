/**
 * enforceStrictDomPolicy()가 DOMPurify를 거치지 않은 raw DOM에도 참조 속성 판정을
 * 올바르게 적용하는지 직접 검증한다.
 *
 * DOMPurify의 SVG 프로필은 비표준 prefix(`foo:href`) 속성과 그 선언에 쓰인
 * `xmlns:foo`를 이미 통째로 제거하므로, `sanitizeSvgStrict()` 수준 테스트만으로는
 * enforceStrictDomPolicy 내부의 isReferenceAttribute() 호출이 실제로 관여하는지
 * 확인할 수 없다(DOMPurify가 이미 지워버린 속성이 남아있을 리 없다는 사실만 확인함).
 * 이 테스트는 DOMParser로 직접 만든 DOM을 enforceStrictDomPolicy에 주입해, 그
 * 함수 자신의 참조 판정 분기를 고정한다.
 */

import { describe, expect, it } from 'vitest';

import { enforceStrictDomPolicy } from '../../../src/svg-sanitizer/enforce-dom-policy.internal';
import type { NestedSanitize } from '../../../src/svg-sanitizer/types';

/** 이 테스트의 입력(https:// 외부 URL)은 data: URI가 아니므로 호출되지 않아야 하는 stub. */
const unexpectedNestedSanitize: NestedSanitize = () => {
  throw new Error('이 테스트에서는 nestedSanitize가 호출되지 않아야 한다.');
};

describe('enforceStrictDomPolicy()', () => {
  it('비표준 prefix로 선언된 xlink 참조 속성을 제거하고 경고를 남긴다', () => {
    const doc = new DOMParser().parseFromString(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:foo="http://example.test/foo">' +
        '<image foo:href="https://example.test/tracker.png"/></svg>',
      'image/svg+xml'
    );
    const root = doc.documentElement;
    const image = doc.getElementsByTagName('image')[0];
    const warnings: string[] = [];

    enforceStrictDomPolicy(root, warnings, undefined, 0, unexpectedNestedSanitize);

    expect(image.hasAttribute('foo:href')).toBe(false);
    expect(warnings).toContain('외부 URI 참조 속성이 제거되었습니다.');
  });
});
