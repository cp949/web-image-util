/**
 * 인라인 SVG 정화 렌더링 중 happy-dom에서만 통과하는 케이스를 모은다.
 *
 * 따옴표 없는 / protocol-relative style 속성은 jsdom의 DOMPurify 처리에서
 * 다른 sanitization 결과가 나와 SVG가 깨져 SOURCE_LOAD_FAILED로 거부된다.
 * 나머지 19개 케이스는 `inline-rendering-jsdom.test.ts`로 분리했다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToElement } from '../../../src/utils/converters';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('보안: 인라인 SVG 정화 렌더링 (happy-dom 잔류 — 따옴표 없는 style 속성)', () => {
  it('따옴표 없는 style 속성의 외부 url() 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style=fill:url(https://evil.example/x.svg#id)/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('protocol-relative style 속성의 외부 url() 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style=fill:url(//evil.example/x.svg#id)/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });
});
