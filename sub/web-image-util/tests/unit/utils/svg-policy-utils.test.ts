import { describe, expect, it, vi } from 'vitest';

import {
  decodeCssEscapes,
  decodeHtmlEntities,
  getCssPolicyValueVariants,
  normalizePolicyValue,
  replaceCssUrlValues,
  visitCssUrlValues,
} from '../../../src/utils/svg-policy-utils';

describe('decodeHtmlEntities()', () => {
  it('hex 문자 참조를 복원한다', () => {
    expect(decodeHtmlEntities('&#x61;')).toBe('a');
    expect(decodeHtmlEntities('&#x41;')).toBe('A');
  });

  it('decimal 문자 참조를 복원한다', () => {
    expect(decodeHtmlEntities('&#97;')).toBe('a');
    expect(decodeHtmlEntities('&#65;')).toBe('A');
  });

  it('named 엔티티 quot, amp, apos, lt, gt를 복원한다', () => {
    expect(decodeHtmlEntities('&quot;')).toBe('"');
    expect(decodeHtmlEntities('&amp;')).toBe('&');
    expect(decodeHtmlEntities('&apos;')).toBe("'");
    expect(decodeHtmlEntities('&lt;')).toBe('<');
    expect(decodeHtmlEntities('&gt;')).toBe('>');
  });

  it('named 엔티티 colon, tab, newline을 복원한다', () => {
    expect(decodeHtmlEntities('&colon;')).toBe(':');
    expect(decodeHtmlEntities('&tab;')).toBe('\t');
    expect(decodeHtmlEntities('&newline;')).toBe('\n');
  });

  it('보안: jav&#x61;script: 를 javascript: 로 복원한다', () => {
    expect(decodeHtmlEntities('jav&#x61;script:')).toBe('javascript:');
  });

  it('보안: jav&#97;script: 를 javascript: 로 복원한다', () => {
    expect(decodeHtmlEntities('jav&#97;script:')).toBe('javascript:');
  });

  it('잘못된 코드포인트는 빈 문자열로 교체한다', () => {
    // 0x10FFFF 초과 값은 String.fromCodePoint가 RangeError를 던짐
    expect(decodeHtmlEntities('&#x110000;')).toBe('');
  });

  it('세미콜론 없는 참조도 복원한다', () => {
    expect(decodeHtmlEntities('&#x61')).toBe('a');
    expect(decodeHtmlEntities('&#97')).toBe('a');
    // 보안: 세미콜론 없는 XSS 패턴
    expect(decodeHtmlEntities('jav&#x61script:')).toBe('javascript:');
  });

  it('엔티티가 없는 일반 문자열은 그대로 반환한다', () => {
    expect(decodeHtmlEntities('hello world')).toBe('hello world');
    expect(decodeHtmlEntities('')).toBe('');
  });
});

describe('normalizePolicyValue()', () => {
  it('앞뒤 따옴표를 제거하고 소문자로 정규화한다', () => {
    expect(normalizePolicyValue('"JavaScript"')).toBe('javascript');
    expect(normalizePolicyValue("'HTTPS'")).toBe('https');
    expect(normalizePolicyValue('\\"test\\"')).toBe('test');
  });

  it('엔티티 인코딩된 URL 스킴을 정규화한다', () => {
    // jav&#x61;script: → javascript:
    expect(normalizePolicyValue('jav&#x61;script:')).toBe('javascript:');
    expect(normalizePolicyValue('jav&#97;script:')).toBe('javascript:');
  });

  it('공백 문자와 제어 문자를 제거한다', () => {
    // codePoint <= 0x20 또는 0x7f~0x9f 범위 문자 제거
    expect(normalizePolicyValue('java\x00script')).toBe('javascript');
    expect(normalizePolicyValue('java\x09script')).toBe('javascript');
    expect(normalizePolicyValue('java\x0ascript')).toBe('javascript');
    expect(normalizePolicyValue('java\x80script')).toBe('javascript');
  });
});

describe('decodeCssEscapes()', () => {
  it('CSS hex escape \\61 을 a로 복원한다', () => {
    expect(decodeCssEscapes('\\61 ')).toBe('a');
  });

  it('CSS hex escape \\000061 을 a로 복원한다', () => {
    expect(decodeCssEscapes('\\000061')).toBe('a');
  });

  it('일반 문자 escape \\. 을 . 으로 복원한다', () => {
    expect(decodeCssEscapes('\\.')).toBe('.');
  });

  it('일반 문자열은 그대로 반환한다', () => {
    expect(decodeCssEscapes('hello')).toBe('hello');
    expect(decodeCssEscapes('')).toBe('');
  });
});

describe('getCssPolicyValueVariants()', () => {
  it('원본, CSS decode, 복합 decode 세 후보를 반환한다', () => {
    const variants = getCssPolicyValueVariants('\\61');
    expect(variants).toHaveLength(3);
    // 원본
    expect(variants[0]).toBe('\\61');
    // CSS decode
    expect(variants[1]).toBe('a');
    // HTML 엔티티 decode 후 CSS decode
    expect(variants[2]).toBe('a');
  });

  it('이미 디코딩된 값은 중복 후보를 포함할 수 있다', () => {
    const variants = getCssPolicyValueVariants('javascript');
    expect(variants).toHaveLength(3);
    // 세 후보 모두 동일한 값
    expect(variants[0]).toBe('javascript');
    expect(variants[1]).toBe('javascript');
    expect(variants[2]).toBe('javascript');
  });
});

describe('visitCssUrlValues()', () => {
  it('url("...") 패턴에서 내부 값을 방문한다', () => {
    const visited: string[] = [];
    visitCssUrlValues('background: url("https://example.com/img.png")', (value) => {
      visited.push(value);
    });
    expect(visited).toEqual(['https://example.com/img.png']);
  });

  it("url('...') 패턴에서 내부 값을 방문한다", () => {
    const visited: string[] = [];
    visitCssUrlValues("background: url('https://example.com/img.png')", (value) => {
      visited.push(value);
    });
    expect(visited).toEqual(['https://example.com/img.png']);
  });

  it('url(...) 따옴표 없는 패턴에서 내부 값을 방문한다', () => {
    const visited: string[] = [];
    visitCssUrlValues('background: url(https://example.com/img.png)', (value) => {
      visited.push(value);
    });
    expect(visited).toEqual(['https://example.com/img.png']);
  });

  it('여러 url() 호출이 있으면 모두 방문한다', () => {
    const visited: string[] = [];
    visitCssUrlValues('background: url("a.png"); border-image: url("b.png")', (value) => {
      visited.push(value);
    });
    expect(visited).toEqual(['a.png', 'b.png']);
  });

  it('url()이 없으면 visitor를 호출하지 않는다', () => {
    const visitor = vi.fn();
    visitCssUrlValues('background: red; color: blue;', visitor);
    expect(visitor).not.toHaveBeenCalled();
  });
});

describe('replaceCssUrlValues()', () => {
  it('url() 내부 값을 replacer 반환값으로 치환한다', () => {
    const result = replaceCssUrlValues('background: url("original.png")', (value) => {
      return `url("replaced.png")`;
    });
    expect(result).toBe('background: url("replaced.png")');
  });

  it('여러 url()이 있으면 모두 치환한다', () => {
    const result = replaceCssUrlValues(
      'background: url("a.png"); border-image: url("b.png")',
      (value) => `url("safe-${value}")`
    );
    expect(result).toBe('background: url("safe-a.png"); border-image: url("safe-b.png")');
  });

  it('url()이 없으면 원본 문자열을 반환한다', () => {
    const original = 'background: red; color: blue;';
    const result = replaceCssUrlValues(original, (value) => `url("${value}")`);
    expect(result).toBe(original);
  });
});
