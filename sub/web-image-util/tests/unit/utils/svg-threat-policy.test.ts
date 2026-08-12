/**
 * 위협 정책 모듈의 술어·정제 골격 단위 테스트.
 *
 * 모드별 판정의 실측 계약은 tests/security/sanitizer-equivalence.corpus.ts가
 * 엔진 통과 기준으로 고정한다 — 여기서는 술어 자체의 경계를 검증한다.
 */

import { describe, expect, it } from 'vitest';

import {
  isAllowedCssUrl,
  isAllowedUri,
  isBlockedPipelineUriRef,
  isEventHandlerAttributeName,
  sanitizeCssValue,
  sanitizeUriValue,
} from '../../../src/utils/svg-threat-policy.internal';

describe('위협 정책 — isAllowedUri', () => {
  it('두 모드 모두 내부 fragment만 허용한다', () => {
    for (const mode of ['lightweight', 'strict'] as const) {
      expect(isAllowedUri('#frag', mode)).toBe(true);
      expect(isAllowedUri('', mode)).toBe(false);
      expect(isAllowedUri('./a.png', mode)).toBe(false);
      expect(isAllowedUri('a.png', mode)).toBe(false);
      expect(isAllowedUri('/a.png', mode)).toBe(false);
      expect(isAllowedUri('vbscript:alert(1)', mode)).toBe(false);
      expect(isAllowedUri('file:///etc/passwd', mode)).toBe(false);
      expect(isAllowedUri('http://evil.example.com/a.png', mode)).toBe(false);
      expect(isAllowedUri('javascript:alert(1)', mode)).toBe(false);
      expect(isAllowedUri('data:text/html,x', mode)).toBe(false);
    }
  });

  it('lightweight는 정규화 우회(대소문자·공백·문자참조)를 무력화한다', () => {
    expect(isAllowedUri('JaVaScRiPt:alert(1)', 'lightweight')).toBe(false);
    expect(isAllowedUri(' jav\nascript:alert(1)', 'lightweight')).toBe(false);
    expect(isAllowedUri('jav&#x61;script:alert(1)', 'lightweight')).toBe(false);
  });

  it('strict는 선행 공백 뒤의 fragment를 허용한다', () => {
    expect(isAllowedUri('  #frag', 'strict')).toBe(true);
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

describe('위협 정책 — isBlockedPipelineUriRef', () => {
  it('fragment 외 모든 참조를 차단한다 — sanitizer 제거 판정의 거울', () => {
    expect(isBlockedPipelineUriRef('http://evil.example.com/a.png')).toBe(true);
    expect(isBlockedPipelineUriRef('./a.png')).toBe(true);
    expect(isBlockedPipelineUriRef('../a.png')).toBe(true);
    expect(isBlockedPipelineUriRef('/a.png')).toBe(true);
    expect(isBlockedPipelineUriRef('a.png')).toBe(true);
    expect(isBlockedPipelineUriRef('vbscript:alert(1)')).toBe(true);
  });

  it('fragment와 빈 값은 차단하지 않는다 — 빈 값은 fetch/실행 대상이 없다', () => {
    expect(isBlockedPipelineUriRef('#frag')).toBe(false);
    expect(isBlockedPipelineUriRef('')).toBe(false);
    expect(isBlockedPipelineUriRef('  ')).toBe(false);
  });

  it('sanitizer가 보존한 안전한 raster data URL은 차단하지 않는다', () => {
    expect(isBlockedPipelineUriRef('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==')).toBe(false);
    expect(isBlockedPipelineUriRef('data:text/html,x')).toBe(true);
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
