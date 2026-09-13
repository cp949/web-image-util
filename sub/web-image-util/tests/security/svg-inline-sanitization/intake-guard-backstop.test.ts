/**
 * intake guard(assertSafeSvgContent)가 sanitizer 이후에도 fail-closed로
 * 잔여 위험 참조를 잡아내는 계약을 검증한다.
 *
 * 이 함수는 lightweight/strict 엔진이 이미 정제한 문자열을 다시 검사하는
 * 2차 방어선이므로, 엔진에 회귀가 생겨도 여기서 막혀야 한다. 정상 파이프라인은
 * 엔진이 먼저 걸러내므로, 이 backstop 자체의 커버리지는 함수를 직접 호출해서
 * 검증한다.
 */

import { describe, expect, it } from 'vitest';
import { assertSafeSvgContent } from '../../../src/core/source-converter/svg/safety.internal';

describe('보안: intake guard의 presentation 속성 CSS 재검증', () => {
  it('fill 속성의 외부 url() 참조를 fail-closed로 차단한다', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(http://evil.example/x.svg#y)" width="10" height="10"/></svg>';

    expect(() => assertSafeSvgContent(svg)).toThrow(expect.objectContaining({ code: 'INVALID_SOURCE' }));
  });

  it('filter 속성의 외부 url() 참조를 fail-closed로 차단한다', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect filter="url(http://evil.example/x.svg#y)" width="10" height="10"/></svg>';

    expect(() => assertSafeSvgContent(svg)).toThrow(expect.objectContaining({ code: 'INVALID_SOURCE' }));
  });

  it('mask 속성의 외부 url() 참조를 fail-closed로 차단한다', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect mask="url(http://evil.example/x.svg#y)" width="10" height="10"/></svg>';

    expect(() => assertSafeSvgContent(svg)).toThrow(expect.objectContaining({ code: 'INVALID_SOURCE' }));
  });

  it('presentation 속성의 로컬 fragment 참조(fill="url(#gradient)")는 차단하지 않는다', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(#gradient)" width="10" height="10"/></svg>';

    expect(() => assertSafeSvgContent(svg)).not.toThrow();
  });
});
