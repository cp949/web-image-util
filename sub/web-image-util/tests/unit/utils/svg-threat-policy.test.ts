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
  sanitizeUriValue,
} from '../../../src/utils/svg-threat-policy.internal';

describe('위협 정책 — isAllowedUri', () => {
  it('lightweight는 denylist 스킴만 차단한다', () => {
    expect(isAllowedUri('http://evil.example.com/a.png', 'lightweight')).toBe(false);
    expect(isAllowedUri('https://evil.example.com/a.png', 'lightweight')).toBe(false);
    expect(isAllowedUri('//evil.example.com/a.png', 'lightweight')).toBe(false);
    expect(isAllowedUri('javascript:alert(1)', 'lightweight')).toBe(false);
    expect(isAllowedUri('data:text/html,x', 'lightweight')).toBe(false);
  });

  it('lightweight는 정규화 우회(대소문자·공백·문자참조)를 무력화한다', () => {
    expect(isAllowedUri('JaVaScRiPt:alert(1)', 'lightweight')).toBe(false);
    expect(isAllowedUri(' jav\nascript:alert(1)', 'lightweight')).toBe(false);
    expect(isAllowedUri('jav&#x61;script:alert(1)', 'lightweight')).toBe(false);
  });

  it('lightweight는 denylist 밖 값을 보존한다 — 코퍼스에 등재된 알려진 구멍 포함', () => {
    expect(isAllowedUri('#frag', 'lightweight')).toBe(true);
    expect(isAllowedUri('./a.png', 'lightweight')).toBe(true);
    expect(isAllowedUri('a.png', 'lightweight')).toBe(true);
    expect(isAllowedUri('', 'lightweight')).toBe(true);
    // 알려진 구멍: 미지 스킴 통과 (sanitizer-equivalence.corpus.ts divergence 항목)
    expect(isAllowedUri('vbscript:alert(1)', 'lightweight')).toBe(true);
    expect(isAllowedUri('file:///etc/passwd', 'lightweight')).toBe(true);
  });

  it('strict는 내부 fragment만 허용한다', () => {
    expect(isAllowedUri('#frag', 'strict')).toBe(true);
    expect(isAllowedUri('  #frag', 'strict')).toBe(true);
    expect(isAllowedUri('', 'strict')).toBe(false);
    expect(isAllowedUri('./a.png', 'strict')).toBe(false);
    expect(isAllowedUri('vbscript:alert(1)', 'strict')).toBe(false);
    expect(isAllowedUri('http://evil.example.com/a.png', 'strict')).toBe(false);
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

  it('모드별 판정에 따라 보존하거나 제거 의도(null)를 반환한다', () => {
    expect(sanitizeUriValue('#frag', 'strict', 0, passthroughNested)).toBe('#frag');
    expect(sanitizeUriValue('http://evil.example.com/x', 'lightweight', 0, passthroughNested)).toBeNull();
    expect(sanitizeUriValue('./a.png', 'lightweight', 0, passthroughNested)).toBe('./a.png');
    expect(sanitizeUriValue('./a.png', 'strict', 0, passthroughNested)).toBeNull();
  });
});

describe('위협 정책 — isBlockedPipelineUriRef', () => {
  it('경량 denylist에 상대·절대 경로를 더해 차단한다', () => {
    expect(isBlockedPipelineUriRef('http://evil.example.com/a.png')).toBe(true);
    expect(isBlockedPipelineUriRef('./a.png')).toBe(true);
    expect(isBlockedPipelineUriRef('../a.png')).toBe(true);
    expect(isBlockedPipelineUriRef('/a.png')).toBe(true);
  });

  it('bare 상대 경로와 fragment는 차단하지 않는다', () => {
    expect(isBlockedPipelineUriRef('a.png')).toBe(false);
    expect(isBlockedPipelineUriRef('#frag')).toBe(false);
  });

  it('sanitizer가 보존한 안전한 raster data URL은 차단하지 않는다', () => {
    expect(isBlockedPipelineUriRef('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==')).toBe(false);
    expect(isBlockedPipelineUriRef('data:text/html,x')).toBe(true);
  });
});

describe('위협 정책 — isAllowedCssUrl', () => {
  it('내부 fragment는 양쪽 모드 모두 허용한다', () => {
    expect(isAllowedCssUrl('#g', 'lightweight')).toBe(true);
    expect(isAllowedCssUrl('#g', 'strict')).toBe(true);
    expect(isAllowedCssUrl('"#g"', 'strict')).toBe(true);
  });

  it('외부 http URL은 양쪽 모드 모두 차단한다', () => {
    expect(isAllowedCssUrl('http://evil.example.com/a.png', 'lightweight')).toBe(false);
    expect(isAllowedCssUrl('http://evil.example.com/a.png', 'strict')).toBe(false);
  });

  it('상대 경로는 lightweight만 허용한다 — 코퍼스에 등재된 알려진 구멍', () => {
    expect(isAllowedCssUrl('a.png', 'lightweight')).toBe(true);
    expect(isAllowedCssUrl('a.png', 'strict')).toBe(false);
  });

  it('lightweight는 CSS escape 변형도 함께 판정한다', () => {
    expect(isAllowedCssUrl('\\68ttp://evil.example.com/a.png', 'lightweight')).toBe(false);
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
