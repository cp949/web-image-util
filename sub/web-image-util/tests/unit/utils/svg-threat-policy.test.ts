/**
 * 위협 정책 모듈의 술어·정제 골격 단위 테스트.
 *
 * 모드별 판정의 실측 계약은 tests/security/sanitizer-equivalence.corpus.ts가
 * 엔진 통과 기준으로 고정한다 — 여기서는 술어 자체의 경계를 검증한다.
 */

import { describe, expect, it } from 'vitest';

import {
  classifyUriRef,
  isAllowedCssUrl,
  isEventHandlerAttributeName,
  sanitizeCssValue,
  sanitizeUriValue,
} from '../../../src/utils/svg-threat-policy.internal';

describe('위협 정책 — classifyUriRef', () => {
  /** 판정 근거만 뽑는다. 문자열 매칭이 아니라 이유 코드로 단언한다. */
  const reasonOf = (value: string, mode: 'strict' | 'lightweight') => classifyUriRef(value, mode).reason;
  const verdictOf = (value: string, mode: 'strict' | 'lightweight') => classifyUriRef(value, mode).verdict;

  it('내부 fragment는 두 모드 모두 위협이 아니다', () => {
    for (const mode of ['strict', 'lightweight'] as const) {
      expect(classifyUriRef('#frag', mode)).toEqual({ verdict: 'no-threat', reason: 'internal-fragment' });
    }
  });

  it('strict는 문자참조를 디코드하지 않아 모드별로 근거가 갈린다', () => {
    expect(reasonOf('&#35;frag', 'strict')).toBe('external');
    expect(reasonOf('&#35;frag', 'lightweight')).toBe('internal-fragment');
  });

  it('lightweight는 문자참조·노이즈 우회를 무력화한다', () => {
    expect(reasonOf('JaVaScRiPt:alert(1)', 'lightweight')).toBe('external');
    expect(reasonOf(' jav\nascript:alert(1)', 'lightweight')).toBe('external');
    expect(reasonOf('jav&#x61;script:alert(1)', 'lightweight')).toBe('external');
  });

  it('원본 trim이 빈 값과 정규화하면 비는 값을 구분한다', () => {
    expect(reasonOf('', 'lightweight')).toBe('empty');
    expect(reasonOf('  ', 'lightweight')).toBe('empty');
    expect(reasonOf('&#32;', 'lightweight')).toBe('normalized-empty');
    expect(reasonOf('&quot;', 'lightweight')).toBe('normalized-empty');
  });

  it('빈 값은 위협이 아니다 — intake guard가 통과시키는 근거다', () => {
    expect(verdictOf('', 'lightweight')).toBe('no-threat');
    expect(verdictOf('&#32;', 'lightweight')).toBe('no-threat');
  });

  it('경계 따옴표로 시작하는 값은 위협이다', () => {
    expect(classifyUriRef('"#frag"', 'lightweight')).toEqual({ verdict: 'threat', reason: 'boundary-quote' });
    expect(reasonOf('&quot;#frag&quot;', 'lightweight')).toBe('boundary-quote');
    expect(reasonOf("'#f'", 'lightweight')).toBe('boundary-quote');
    expect(reasonOf('\\#f', 'lightweight')).toBe('boundary-quote');
  });

  it('data: 계열을 안전 raster·canonical·재정제 대상·그 외로 가른다', () => {
    const canonicalSvg = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')}`;
    expect(reasonOf('data:image/png;base64,iVBORw0KGgo=', 'lightweight')).toBe('safe-raster-data');
    expect(reasonOf(canonicalSvg, 'lightweight')).toBe('canonical-svg-data');
    expect(reasonOf('data:image/svg+xml;utf8,%3Csvg%2F%3E', 'lightweight')).toBe('nested-svg-data');
    expect(reasonOf('data:text/html,x', 'lightweight')).toBe('unsafe-data');
    expect(reasonOf('data:image/png', 'lightweight')).toBe('unsafe-data');
  });

  it('안전 raster와 canonical svg만 위협이 아니다', () => {
    const canonicalSvg = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')}`;
    expect(verdictOf('data:image/png;base64,iVBORw0KGgo=', 'lightweight')).toBe('no-threat');
    expect(verdictOf(canonicalSvg, 'lightweight')).toBe('no-threat');
    expect(verdictOf('data:image/svg+xml;utf8,%3Csvg%2F%3E', 'lightweight')).toBe('threat');
    expect(verdictOf('data:text/html,x', 'lightweight')).toBe('threat');
  });

  it('data: 감지는 원본 값 기준이다 — 문자참조로 감춘 스킴은 external이다', () => {
    expect(reasonOf('&#100;ata:image/png;base64,iVBORw0KGgo=', 'lightweight')).toBe('external');
  });

  it('따옴표가 감싼 data:는 data 분기를 타지 않는다', () => {
    expect(reasonOf('"data:image/png;base64,iVBORw0KGgo="', 'lightweight')).toBe('boundary-quote');
  });

  it('상대 경로·절대 경로·미지 스킴은 external이다', () => {
    for (const value of [
      './a.png',
      '../a.png',
      '/a.png',
      'a.png',
      '//cdn.example.com/a.png',
      'vbscript:alert(1)',
      'file:///etc/passwd',
    ]) {
      expect(classifyUriRef(value, 'lightweight')).toEqual({ verdict: 'threat', reason: 'external' });
    }
  });
});

describe('위협 정책 — sanitizeUriValue', () => {
  const passthroughNested = (svg: string): string => svg;

  it('안전한 raster data URL은 모드와 무관하게 원본 보존한다', () => {
    const raster = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
    expect(sanitizeUriValue(raster, 'lightweight', 0, passthroughNested)).toBe(raster);
    expect(sanitizeUriValue(raster, 'strict', 0, passthroughNested)).toBe(raster);
  });

  it('nested SVG data URL은 콜백 정제 후 base64로 재인코딩하고 depth를 증가시킨다', () => {
    const nested = 'data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E';
    const depths: number[] = [];
    const result = sanitizeUriValue(nested, 'lightweight', 0, (svg, depth) => {
      depths.push(depth);
      return svg;
    });
    expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(depths).toEqual([1]);
  });

  it('nested SVG 재귀 깊이 상한에서는 제거한다', () => {
    const nested = 'data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E';
    expect(sanitizeUriValue(nested, 'lightweight', 5, passthroughNested)).toBeNull();
  });

  it('URI allowlist 판정에 따라 보존하거나 제거 의도(null)를 반환한다', () => {
    expect(sanitizeUriValue('#frag', 'strict', 0, passthroughNested)).toBe('#frag');
    expect(sanitizeUriValue('#frag', 'lightweight', 0, passthroughNested)).toBe('#frag');
    expect(sanitizeUriValue('http://evil.example.com/x', 'lightweight', 0, passthroughNested)).toBeNull();
    expect(sanitizeUriValue('./a.png', 'lightweight', 0, passthroughNested)).toBeNull();
    expect(sanitizeUriValue('./a.png', 'strict', 0, passthroughNested)).toBeNull();
  });
});

describe('위협 정책 — isAllowedCssUrl', () => {
  it('내부 fragment만 허용한다 — 모드 무관', () => {
    expect(isAllowedCssUrl('#g')).toBe(true);
    expect(isAllowedCssUrl('"#g"')).toBe(true);
    expect(isAllowedCssUrl('http://evil.example.com/a.png')).toBe(false);
    expect(isAllowedCssUrl('a.png')).toBe(false);
    expect(isAllowedCssUrl('')).toBe(false);
    expect(isAllowedCssUrl('\\68ttp://evil.example.com/a.png')).toBe(false);
  });
});

describe('위협 정책 — sanitizeCssValue', () => {
  it('내부 fragment url()은 보존하고 외부 url()은 none으로 치환한다', () => {
    expect(sanitizeCssValue('fill:url(#g)')).toBe('fill:url(#g)');
    expect(sanitizeCssValue('fill:url(http://evil.example.com/a.png)')).toBe('fill:none');
    expect(sanitizeCssValue('fill:url(a.png)')).toBe('fill:none');
  });

  it('@import·expression·image-set·-moz-binding 구문을 제거한다', () => {
    expect(sanitizeCssValue('@import "https://evil.example.com/a.css";color:red')).toBe('color:red');
    expect(sanitizeCssValue('width:expression(alert(1))')).toBe('width:)');
    expect(sanitizeCssValue("background:image-set('https://e.example/a.png' 1x)")).toBe('background:');
    expect(sanitizeCssValue('-moz-binding:url(http://e.example/x);fill:red')).toBe('fill:red');
  });

  it('escape 디코드 후 위험 구문이 드러나면 값 전체를 폐기한다', () => {
    expect(sanitizeCssValue('fill:\\75rl(http://evil.example.com/a.png)')).toBe('');
  });
});

describe('위협 정책 — isEventHandlerAttributeName', () => {
  it('on 접두 + 본문이 있는 속성만 이벤트 핸들러로 판정한다', () => {
    expect(isEventHandlerAttributeName('onclick')).toBe(true);
    expect(isEventHandlerAttributeName('onLoad')).toBe(true);
    expect(isEventHandlerAttributeName('on')).toBe(false);
    expect(isEventHandlerAttributeName('fill')).toBe(false);
  });
});
